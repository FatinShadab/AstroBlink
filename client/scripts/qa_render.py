"""QA images for the real SPHEREx data: earliest vs latest frame and their difference, per target.

Uses the same frame choice as the viewer: the default detector of each preset, then the largest group
of frames at matching wavelength (spanning the longest time). Writes client/scripts/qa/<preset-id>.png.

Usage (from client/):  <venv>/Scripts/python.exe scripts/qa_render.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
OUT = Path(__file__).resolve().parent / "qa"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qa_check import default_detectors, select_matched_wavelength  # noqa: E402  same selection as the viewer

# Default detector per preset, read from client/src/data/presets.ts.
DEFAULT_DETECTOR = default_detectors()
CROP = 64  # pixels shown (≈ 6.6′)
ZOOM = 6


def matched_group(frames: list[dict]) -> list[dict]:
    return select_matched_wavelength(frames)


def load(tdir: Path, frame: dict) -> np.ndarray:
    return np.fromfile(tdir / frame["files"]["pixels"], dtype="<f4").reshape(frame["height"], frame["width"])


def crop(img: np.ndarray, cx: int, cy: int) -> np.ndarray:
    h = CROP // 2
    return img[cy - h:cy + h, cx - h:cx + h]


def to_grey(img: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """asinh stretch between lo and hi; NaN shown as black."""
    x = np.clip((img - lo) / max(hi - lo, 1e-12), 0, 1)
    y = np.arcsinh(10 * x) / np.arcsinh(10)
    y = np.nan_to_num(y, nan=0.0)
    return (y * 255).astype(np.uint8)


def diff_grey(d: np.ndarray, lim: float) -> np.ndarray:
    y = np.clip(d / max(lim, 1e-12), -1, 1)
    y = np.nan_to_num(y, nan=0.0)
    return ((y + 1) * 127.5).astype(np.uint8)


def panel(arr: np.ndarray) -> Image.Image:
    im = Image.fromarray(arr, mode="L").resize((arr.shape[1] * ZOOM, arr.shape[0] * ZOOM), Image.NEAREST)
    return im.transpose(Image.FLIP_TOP_BOTTOM).convert("RGB")  # north up in the PNG


def mark(im: Image.Image, x: float, y: float, colour) -> None:
    """Circle at array position (x, y) in the cropped panel (flipped so north is up)."""
    draw = ImageDraw.Draw(im)
    px = (x + 0.5) * ZOOM
    py = (CROP - (y + 0.5)) * ZOOM
    r = 3 * ZOOM
    draw.ellipse([px - r, py - r, px + r, py + r], outline=colour, width=2)


def render(tid: str, det: str | None = None) -> dict | None:
    tdir = DATA / tid
    manifest = json.loads((tdir / "manifest.json").read_text())
    is_default = det is None
    det = det or DEFAULT_DETECTOR[tid]
    on_det = [f for f in manifest["frames"] if f["detector"] == det]
    group = matched_group(on_det)
    note = "matched wavelength"
    if not group:
        group = sorted(on_det, key=lambda f: f["obsDate"])
        note = "NO wavelength match - earliest and latest shown anyway"
    if len(group) < 2:
        return None
    a, b = group[0], group[-1]
    cx, cy = a["centrePixel"]["x"], a["centrePixel"]["y"]
    ia, ib = crop(load(tdir, a), cx, cy), crop(load(tdir, b), cx, cy)
    both = np.concatenate([ia[np.isfinite(ia)], ib[np.isfinite(ib)]])
    lo, hi = np.percentile(both, 1), np.percentile(both, 99.7)
    d = ib - ia
    lim = np.nanpercentile(np.abs(d), 99.5)

    pa, pb, pd = panel(to_grey(ia, lo, hi)), panel(to_grey(ib, lo, hi)), panel(diff_grey(d, lim))
    off = CROP // 2
    for im in (pa, pd):
        mark(im, a["targetPixel"]["x"] - cx + off, a["targetPixel"]["y"] - cy + off, (86, 180, 233))
    for im in (pb, pd):
        mark(im, b["targetPixel"]["x"] - cx + off, b["targetPixel"]["y"] - cy + off, (230, 159, 0))

    w, h = pa.size
    title_h = 64
    canvas = Image.new("RGB", (w * 3 + 40, h + title_h + 30), (7, 8, 13))
    font = ImageFont.load_default()
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 8), f"{manifest['name']} - {det} - {note} - crop {CROP}px ({CROP * 6.2 / 60:.1f} arcmin), north up, east left", fill=(232, 230, 225), font=font)
    labels = [
        f"Earliest {a['obsDate']} {a['release']} {a['wavelengthUm']:.3f} um",
        f"Latest {b['obsDate']} {b['release']} {b['wavelengthUm']:.3f} um",
        "Difference (latest - earliest)",
    ]
    for i, (im, label) in enumerate(zip((pa, pb, pd), labels)):
        x = 10 + i * (w + 10)
        draw.text((x, 34), label, fill=(232, 230, 225), font=font)
        canvas.paste(im, (x, title_h))
    draw.text((10, h + title_h + 8), "Blue circle: expected position at the earliest date. Orange: at the latest date.",
              fill=(166, 176, 197), font=font)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / (f"{tid}.png" if is_default else f"{tid}-{det}.png")
    canvas.save(out)

    shift = float(np.hypot(b["targetPixel"]["x"] - a["targetPixel"]["x"], b["targetPixel"]["y"] - a["targetPixel"]["y"]))
    return {"id": tid, "detector": det, "frames": len(group), "note": note, "earliest": a["obsDate"], "latest": b["obsDate"],
            "wavelengths": (a["wavelengthUm"], b["wavelengthUm"]), "expectedShiftPx": round(shift, 2),
            "fluxEarliest": a.get("flux"), "fluxLatest": b.get("flux"), "png": str(out)}


if __name__ == "__main__":
    # --all also renders every detector (qa/<id>-<det>.png), to compare before choosing a default.
    every = "--all" in sys.argv
    # --targets barnard,r-dra limits the run to those presets.
    only = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--targets=")), None)
    for tid in DEFAULT_DETECTOR:
        if only and tid not in only:
            continue
        if (DATA / tid / "manifest.json").exists():
            print(render(tid))
            if every:
                for d in ("D1", "D2", "D3", "D4", "D5", "D6"):
                    print(render(tid, d))
