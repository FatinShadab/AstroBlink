"""Alignment QA for the real SPHEREx data: measures, does not trust.

For every target and detector it takes the frames the viewer will actually show (the same matched-
wavelength selection as selectMatchedWavelength in src/lib/data/static/staticProvider.ts), then compares
the background star field of the first frame with every other frame:

  - correlation at 0° (after removing the smooth background, with ~30″ around the target masked out),
  - the best-matching rotation angle from a scan over -180°..180° (must be 0°),
  - the measured target shift (centroid near the expected position) between the earliest and latest frame,
    next to the shift expected from the catalogue proper motion.

Writes scripts/qa/qa_check.json and prints a table. Exit code 1 if any frame fails.

Usage (from client/):  <venv>/Scripts/python.exe scripts/qa_check.py [--targets barnard,...]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
OUT = Path(__file__).resolve().parent / "qa"
PRESETS_TS = ROOT / "src" / "data" / "presets.ts"

TARGET_MASK_ARCSEC = 30.0
FIELD_RADIUS_PX = 50  # compare the inner ~10′ of the 15′ grid (outer corners are often empty)
COARSE_STEP_DEG = 5
FINE_STEP_DEG = 1
GOOD_CORR = 0.8  # bright star fields
MIN_CORR = 0.5  # below this the frames do not show the same star field → FAIL
ROTATION_MARGIN = 0.05  # a non-zero angle must beat 0° by this much to count as a rotation
MIN_STAR_PIXELS = 30  # fewer star pixels than this: the field is too sparse to judge ("sparse", not a fail)
TOLERANCE_STEPS = (1, 2, 3, 4)


# ---- frame selection: a direct port of staticProvider.ts -------------------------------------------------

def wavelength_tolerance(det: str) -> float:
    return 0.005 if det in ("D5", "D6") else 0.012


def best_group(frames: list[dict], tol: float) -> list[dict]:
    best: list[dict] = []
    best_span = -1.0
    for anchor in frames:
        group = [f for f in frames if abs(f["wavelengthUm"] - anchor["wavelengthUm"]) / anchor["wavelengthUm"] <= tol]
        days = [f["mjd"] for f in group]
        span = max(days) - min(days)
        if len(group) > len(best) or (len(group) == len(best) and span > best_span):
            best, best_span = group, span
    return best


def select_matched_wavelength(frames: list[dict]) -> list[dict]:
    if len(frames) < 2:
        return []
    base = wavelength_tolerance(frames[0]["detector"])
    fallback: list[dict] = []
    for step in TOLERANCE_STEPS:
        group = best_group(frames, base * step)
        if len(group) >= 3:
            return sorted(group, key=lambda f: f["obsDate"])
        if len(fallback) < 2 and len(group) >= 2:
            fallback = group
    return sorted(fallback, key=lambda f: f["obsDate"]) if len(fallback) >= 2 else []


def default_detectors() -> dict[str, str]:
    """Default detector per preset, read from presets.ts so this check follows the app."""
    text = PRESETS_TS.read_text(encoding="utf-8")
    return dict(re.findall(
        r'id: "([a-z0-9-]+)",\s*name: "[^"]*",\s*kind: "\w+",(?:\s*//[^\n]*)*\s*detector: "(D\d)"', text))


# ---- image helpers --------------------------------------------------------------------------------------

def load(tdir: Path, f: dict) -> np.ndarray:
    """Pixels with flagged (glitch) pixels and their neighbours set to NaN, so cosmic rays never count as stars."""
    img = np.fromfile(tdir / f["files"]["pixels"], dtype="<f4").reshape(f["height"], f["width"]).astype(np.float64)
    flags = np.fromfile(tdir / f["files"]["flags"], dtype=np.uint8).reshape(f["height"], f["width"]) != 0
    grown = flags.copy()
    grown[1:, :] |= flags[:-1, :]
    grown[:-1, :] |= flags[1:, :]
    grown[:, 1:] |= flags[:, :-1]
    grown[:, :-1] |= flags[:, 1:]
    img[grown] = np.nan
    return img


def box_mean(img: np.ndarray, r: int) -> np.ndarray:
    """NaN-aware box mean of half-width r (summed-area table)."""
    valid = np.isfinite(img)
    v = np.where(valid, img, 0.0)
    pad = lambda a: np.pad(a, ((r + 1, r), (r + 1, r)), mode="constant")  # noqa: E731
    s = pad(v).cumsum(0).cumsum(1)
    n = pad(valid.astype(np.float64)).cumsum(0).cumsum(1)
    k = 2 * r + 1
    tot = s[k:, k:] - s[:-k, k:] - s[k:, :-k] + s[:-k, :-k]
    cnt = n[k:, k:] - n[:-k, k:] - n[k:, :-k] + n[:-k, :-k]
    with np.errstate(invalid="ignore", divide="ignore"):
        return tot / cnt


def high_pass(img: np.ndarray, tx: float, ty: float) -> np.ndarray:
    """Star-field image in units of the noise: smooth sky removed, the target's round halo removed (its
    azimuthal median profile), then asinh-compressed so one bright star cannot dominate."""
    hp = img - box_mean(img, 6)
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    r = np.rint(np.hypot(xx - tx, yy - ty)).astype(int)
    for k in range(0, 45):
        ring = (r == k) & np.isfinite(hp)
        if ring.sum() >= 6:
            hp[r == k] -= np.median(hp[ring])
    finite = hp[np.isfinite(hp)]
    sigma = 1.4826 * np.median(np.abs(finite - np.median(finite))) if finite.size else 1.0
    return np.arcsinh(hp / (3 * max(sigma, 1e-12)))


STAR_LEVEL = float(np.arcsinh(5 / 3))  # 5 sigma after the asinh compression


def star_pixels(z: np.ndarray) -> np.ndarray:
    m = np.nan_to_num(z, nan=-1) > STAR_LEVEL
    g = m.copy()
    g[1:, :] |= m[:-1, :]
    g[:-1, :] |= m[1:, :]
    g[:, 1:] |= m[:, :-1]
    g[:, :-1] |= m[:, 1:]
    return g


def rotate(img: np.ndarray, deg: float) -> np.ndarray:
    """Rotates about the grid centre with bilinear sampling; NaN outside."""
    if deg == 0:
        return img
    h, w = img.shape
    cy, cx = (h - 1) / 2, (w - 1) / 2
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    a = math.radians(deg)
    xs = cx + (xx - cx) * math.cos(a) + (yy - cy) * math.sin(a)
    ys = cy - (xx - cx) * math.sin(a) + (yy - cy) * math.cos(a)
    x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
    fx, fy = xs - x0, ys - y0
    ok = (x0 >= 0) & (y0 >= 0) & (x0 + 1 < w) & (y0 + 1 < h)
    out = np.full(img.shape, np.nan)
    xi, yi = x0[ok], y0[ok]
    out[ok] = (img[yi, xi] * (1 - fx[ok]) * (1 - fy[ok]) + img[yi, xi + 1] * fx[ok] * (1 - fy[ok])
               + img[yi + 1, xi] * (1 - fx[ok]) * fy[ok] + img[yi + 1, xi + 1] * fx[ok] * fy[ok])
    return out


def corr(a: np.ndarray, b: np.ndarray, mask: np.ndarray) -> float:
    """Correlation over the star pixels of either image (within the field mask)."""
    ok = mask & np.isfinite(a) & np.isfinite(b) & (star_pixels(a) | star_pixels(b))
    if ok.sum() < MIN_STAR_PIXELS:
        return float("nan")
    x, y = a[ok] - a[ok].mean(), b[ok] - b[ok].mean()
    den = math.sqrt(float((x * x).sum() * (y * y).sum()))
    return float((x * y).sum() / den) if den > 0 else float("nan")


def centroid(img: np.ndarray, x: float, y: float, r: float = 3.0) -> tuple[float, float, float] | None:
    """Flux-weighted centroid within r px of (x, y) after a local background; also returns S/N-ish peak."""
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    d = np.hypot(xx - x, yy - y)
    ring = (d >= 5) & (d <= 9) & np.isfinite(img)
    ap = (d <= r) & np.isfinite(img)
    if ring.sum() < 10 or ap.sum() < 5:
        return None
    bg = np.median(img[ring])
    noise = 1.4826 * np.median(np.abs(img[ring] - bg))
    w = np.clip(img[ap] - bg, 0, None)
    if w.sum() <= 0:
        return None
    peak_snr = float((img[ap] - bg).max() / noise) if noise > 0 else float("inf")
    return float((xx[ap] * w).sum() / w.sum()), float((yy[ap] * w).sum() / w.sum()), peak_snr


# ---- the check ------------------------------------------------------------------------------------------

def check_group(tdir: Path, frames: list[dict]) -> dict:
    ref = frames[0]
    imgs = {f["id"]: load(tdir, f) for f in frames}
    h, w = ref["height"], ref["width"]
    yy, xx = np.mgrid[0:h, 0:w]
    c = (w - 1) / 2
    field = np.hypot(xx - c, yy - c) <= FIELD_RADIUS_PX
    mask_r = TARGET_MASK_ARCSEC / ref["pixelScaleArcsec"]
    for f in frames:  # the target moves, so mask it at every frame's own position
        tp = f["targetPixel"]
        field &= np.hypot(xx - tp["x"], yy - tp["y"]) > mask_r

    ref_hp = high_pass(imgs[ref["id"]], ref["targetPixel"]["x"], ref["targetPixel"]["y"])
    rows = []
    for f in frames[1:]:
        hp = high_pass(imgs[f["id"]], f["targetPixel"]["x"], f["targetPixel"]["y"])
        c0 = corr(ref_hp, hp, field)
        scores = {a: corr(ref_hp, rotate(hp, a), field) for a in range(-180, 180, COARSE_STEP_DEG)}
        coarse = max(scores, key=lambda a: -1 if math.isnan(scores[a]) else scores[a])
        for a in range(coarse - COARSE_STEP_DEG + 1, coarse + COARSE_STEP_DEG):
            scores[a] = corr(ref_hp, rotate(hp, a), field)
        best = max(scores, key=lambda a: -1 if math.isnan(scores[a]) else scores[a])
        rotated = best != 0 and not math.isnan(c0) and scores[best] > c0 + ROTATION_MARGIN
        if math.isnan(c0):
            status = "sparse"
        else:
            status = "FAIL" if (rotated or c0 < MIN_CORR) else ("ok" if c0 >= GOOD_CORR else "weak")
        rows.append({"frame": f["id"], "date": f["obsDate"], "corr0": round(c0, 3),
                     "bestRotationDeg": best if rotated else 0, "corrBest": round(scores[best], 3), "status": status})

    first, last = frames[0], frames[-1]
    exp = math.hypot(last["targetPixel"]["x"] - first["targetPixel"]["x"],
                     last["targetPixel"]["y"] - first["targetPixel"]["y"])
    ca = centroid(imgs[first["id"]], first["targetPixel"]["x"], first["targetPixel"]["y"])
    cb = centroid(imgs[last["id"]], last["targetPixel"]["x"], last["targetPixel"]["y"])
    measured = math.hypot(cb[0] - ca[0], cb[1] - ca[1]) if ca and cb else None
    detect = [round(x[2], 1) if x else None for x in (ca, cb)]
    return {"frames": len(frames), "dates": [first["obsDate"], last["obsDate"]],
            "wavelengths": sorted({round(f["wavelengthUm"], 3) for f in frames}),
            "pairs": rows,
            "minCorr0": min((r["corr0"] for r in rows if not math.isnan(r["corr0"])), default=None),
            "anyRotation": any(r["bestRotationDeg"] != 0 for r in rows),
            "expectedShiftPx": round(exp, 2), "measuredShiftPx": None if measured is None else round(measured, 2),
            "targetPeakSnr": detect,
            "fluxes": [f.get("flux") for f in frames],
            "status": "FAIL" if any(r["status"] == "FAIL" for r in rows) else
                      ("weak" if any(r["status"] == "weak" for r in rows) else "ok")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", default="")
    args = ap.parse_args()
    wanted = {t for t in args.targets.split(",") if t}
    defaults = default_detectors()
    report: dict = {}
    failures = 0
    for mpath in sorted(DATA.glob("*/manifest.json")):
        m = json.loads(mpath.read_text())
        tid = m["id"]
        if wanted and tid not in wanted:
            continue
        report[tid] = {"name": m["name"], "defaultDetector": defaults.get(tid), "detectors": {}}
        print(f"\n== {m['name']} ({tid}); default detector {defaults.get(tid)}")
        for det in m["detectors"]:
            group = select_matched_wavelength([f for f in m["frames"] if f["detector"] == det])
            if len(group) < 2:
                print(f"  {det}: fewer than two matched frames; viewer shows an error for this detector")
                report[tid]["detectors"][det] = {"frames": len(group), "status": "no-match"}
                continue
            res = check_group(mpath.parent, group)
            report[tid]["detectors"][det] = res
            mark = "  <-- default" if det == defaults.get(tid) else ""
            print(f"  {det}: {res['frames']} frames {res['dates'][0]}..{res['dates'][1]} "
                  f"min corr0 {res['minCorr0']}, rotation {'YES' if res['anyRotation'] else '0 deg'}, "
                  f"shift expected {res['expectedShiftPx']} px measured {res['measuredShiftPx']} px, "
                  f"target peak S/N {res['targetPeakSnr']} [{res['status']}]{mark}")
            for r in res["pairs"]:
                if r["status"] == "FAIL":
                    failures += 1
                    print(f"    FAIL {r['frame']} {r['date']}: corr0 {r['corr0']}, best rotation "
                          f"{r['bestRotationDeg']} deg (corr {r['corrBest']})")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "qa_check.json").write_text(json.dumps(report, indent=2))
    print(f"\n{failures} failing frame(s). Report: {OUT / 'qa_check.json'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
