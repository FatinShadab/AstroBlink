"""Download real NASA SPHEREx spectral-image cutouts for the AstroBlink preset targets.

Source: SPHEREx spectral images (Level 2), NASA/IPAC Infrared Science Archive (IRSA).
Releases: DR1 (which now holds the epochs first published as QR2) and QR3. DOIs: 10.26131/IRSA652 (QR2),
10.26131/IRSA662 (QR3).

What it does, per target and detector:
  1. Lists every exposure covering the target (IRSA TAP), with its footprint on the sky.
  2. Predicts the wavelength each exposure sees at the target (spherex_lvf.py: SPHEREx's filters vary
     across the detector) and chooses a BLINK set: frames that share one wavelength, spread over the longest
     baseline, so blinking shows real change and not colour. A few more frames spread in wavelength are
     added for the spectrum.
  3. Downloads each cutout once into client/.cache/spherex/ (not committed), then reprojects it onto ONE
     common north-up TAN grid centred on the target (same size and pixel scale for all frames).
  4. Aperture photometry (mJy) skips glitch pixels; a pixel on the grid is a glitch if any source pixel
     that contributed to it was flagged as cosmic ray, saturated, non-functional, hot or dead.
  5. Optional per-visit stacks (WISE 0855 D5/D6): frames from the same visit at matching wavelength are
     averaged to lift a faint target out of the noise.

Writes client/public/data/<preset-id>/ (float32 pixels, uint8 glitch mask, per-frame JSON, manifest.json,
spectrum.json) and client/public/data/index.json. --force empties each target's folder first, so no frame
from an earlier run is left mixed in.

Usage (from client/):
    <venv>/Scripts/python.exe scripts/fetch_spherex.py --release DR1,QR3 --force
    <venv>/Scripts/python.exe scripts/fetch_spherex.py --targets wise-0855 --force   (reuses the cache)
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS

sys.path.insert(0, str(Path(__file__).resolve().parent))
from spherex_lvf import LvfModel, detector_uv, parse_poly  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"
CACHE = ROOT / ".cache" / "spherex"
LVF_MODEL = Path(__file__).resolve().parent / "lvf_model.json"
TAP = "https://irsa.ipac.caltech.edu/TAP/sync"

PIXEL_SCALE_ARCSEC = 6.2
GRID_SIZE = 145  # 145 x 6.2" = 15', the largest field of view in the viewer
DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"]
DOIS = {"QR2": "10.26131/IRSA652", "QR3": "10.26131/IRSA662"}

# Frame choice per detector.
BLINK_FRAMES = 8  # frames at one matched wavelength, earliest to latest
SPECTRUM_FRAMES = 4  # extra frames spread in wavelength, for the spectrum
VISIT_GAP_DAYS = 20  # exposures closer than this belong to the same visit
STACK_PER_VISIT = 6  # frames averaged per visit for a stacked frame

# Aperture photometry (pixels on the common grid).
APERTURE_RADIUS = 2.0  # about 12", two SPHEREx PSF widths
ANNULUS = (5.0, 8.0)  # background ring
MAX_MASKED_FRACTION = 0.25  # more masked aperture pixels than this -> no flux (saturated or off-image)
PIXEL_SR = (PIXEL_SCALE_ARCSEC / 206264.806) ** 2  # pixel solid angle, steradian

# Ids match the preset ids in client/src/data/presets.ts, so the app can route by id.
# Positions are catalogue positions at a reference epoch, with proper motions (mas/yr; pmra includes cos dec).
# The grid is centred on each target's position at DISPLAY_EPOCH, and the photometry aperture follows the
# star to each frame's own epoch.
#   Barnard's Star, Epsilon Indi B: Gaia DR3 (gaiadr3.gaia_source, epoch 2016.0).
#   WISE 0855: CatWISE2020 at IRSA (J085507.96-071439.3, epoch MJD 57338.57 = 2015.87).
#   R Draconis, RW Aurigae: the team brief; their proper motion is negligible here.
DISPLAY_EPOCH = 2025.9
TARGETS = [
    {"id": "wise-0855", "name": "WISE J085510.83-071442.5",
     "ra0": 133.7831722, "dec0": -7.2442516, "pmra": -8021.2, "pmdec": 1035.7, "epoch0": 2015.87,
     "stack": ["D5", "D6"]},
    {"id": "barnard", "name": "Barnard's Star",
     "ra0": 269.44850252543836, "dec0": 4.739420051112412, "pmra": -801.551, "pmdec": 10362.394, "epoch0": 2016.0},
    {"id": "eps-indi-b", "name": "Epsilon Indi B",
     "ra0": 331.07645259656397, "dec0": -56.79381206688221, "pmra": 3981.977, "pmdec": -2466.832, "epoch0": 2016.0},
    {"id": "r-dra", "name": "R Draconis", "ra0": 248.16667, "dec0": 66.755, "pmra": 0.0, "pmdec": 0.0, "epoch0": 2000.0},
    {"id": "rw-aur", "name": "RW Aurigae", "ra0": 76.95625, "dec0": 30.40139, "pmra": 0.0, "pmdec": 0.0, "epoch0": 2000.0},
]

HEADERS = {"User-Agent": "AstroBlink-data-fetch/2.0 (educational, NASA Space Apps)"}
PAUSE_BETWEEN_DOWNLOADS = 1.0  # seconds per download thread; keeps the load on IRSA polite
WORKERS = 4  # parallel cutout downloads
REQUEST_TIMEOUT = 60  # seconds per request
RETRIES = 2  # retries after the first attempt; a frame that still fails is skipped and logged

# SPHEREx FLAGS is a 32-bit mask; bit numbers come from the MP_* keywords in the FLAGS header.
# Only genuinely unreliable pixels count as glitches. Informational bits (MP_SOURCE "part of a source",
# MP_NONLINEAR "corrected for non-linearity", MP_REFERENCE, MP_DICHROIC, MP_FULLSAMPLE...) are ignored.
GLITCH_BITS = {
    "MP_TRANSIENT": 0,  # cosmic ray or other transient
    "MP_OVERFLOW": 1,  # saturated
    "MP_NONFUNC": 6,  # non-functional pixel
    "MP_HOT": 10,  # hot pixel
    "MP_COLD": 11,  # dead (cold) pixel
}


def log(msg: str) -> None:
    print(msg, flush=True)


def propagate(target: dict, epoch: float) -> tuple[float, float]:
    """Linear proper-motion propagation; accurate to well under a SPHEREx pixel over a decade."""
    dt = epoch - target["epoch0"]
    dec0 = math.radians(target["dec0"])
    dra_deg = target["pmra"] / 1000 / 3600 * dt / math.cos(dec0)
    ddec_deg = target["pmdec"] / 1000 / 3600 * dt
    return (target["ra0"] + dra_deg) % 360, target["dec0"] + ddec_deg


for _t in TARGETS:
    _t["ra"], _t["dec"] = (round(v, 6) for v in propagate(_t, DISPLAY_EPOCH))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--release", default="DR1,QR3",
                        help="Comma-separated SPHEREx releases to include, e.g. DR1,QR3.")
    parser.add_argument("--targets", default=",".join(t["id"] for t in TARGETS),
                        help="Comma-separated preset ids to fetch. Default: all five.")
    parser.add_argument("--size", type=float, default=0.25,
                        help="Cutout size in degrees requested from IRSA. Default 0.25 (covers the 15' grid).")
    parser.add_argument("--per-detector", type=int, default=BLINK_FRAMES,
                        help=f"Most frames per detector in the matched-wavelength blink set. Default {BLINK_FRAMES}.")
    parser.add_argument("--force", action="store_true",
                        help="Empty each target's output folder and rebuild every frame (cached cutouts are reused).")
    parser.add_argument("--refetch", action="store_true", help="Download cutouts again even if cached.")
    return parser.parse_args()


def get_with_retry(url: str, *, data=None, method="GET", attempts=RETRIES + 1, timeout=REQUEST_TIMEOUT):
    """Retries HTTP 5xx and network errors with exponential backoff. 4xx is returned to the caller."""
    delay = 4
    last = None
    for attempt in range(1, attempts + 1):
        try:
            resp = requests.request(method, url, data=data, headers=HEADERS, timeout=timeout)
            if resp.status_code < 500:
                return resp
            last = f"HTTP {resp.status_code}"
        except requests.RequestException as exc:
            last = type(exc).__name__
        log(f"    retry {attempt}/{attempts} after {last}; waiting {delay}s")
        time.sleep(delay)
        delay *= 2
    raise RuntimeError(f"gave up after {attempts} attempts: {last}")


def tap_query(adql: str) -> list[dict]:
    # TAP searches can take longer than a cutout, so they get a longer timeout.
    resp = get_with_retry(TAP, data={"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": adql},
                          method="POST", timeout=300)
    resp.raise_for_status()
    lines = [line for line in resp.text.splitlines() if line.strip()]
    if not lines:
        return []
    header = lines[0].split(",")
    rows = []
    for line in lines[1:]:
        values = line.split(",")
        if len(values) != len(header):
            log(f"    ignored a malformed TAP row: {line[:80]!r}")
            continue
        rows.append(dict(zip(header, values)))
    return rows


def coverage_query(ra: float, dec: float, det: str, release_filter: str) -> list[dict]:
    """All observations covering the position, with their footprints. IRSA sometimes answers with an empty
    table by mistake, so an empty answer is asked again before it is believed."""
    adql = (
        "SELECT 'https://irsa.ipac.caltech.edu/' || a.uri AS url, p.time_bounds_lower AS mjd, p.poly AS poly "
        "FROM spherex.artifact a JOIN spherex.plane p ON a.planeid = p.planeid "
        f"WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly) "
        f"AND p.energy_bandpassname = 'SPHEREx-{det}' AND ({release_filter}) "
        "ORDER BY p.time_bounds_lower"
    )
    rows: list[dict] = []
    for attempt in range(3):
        rows = tap_query(adql)
        if rows:
            return rows
        time.sleep(10 * (attempt + 1))
    return rows


def release_of(url: str) -> str:
    """Release from the archive path: qr2, qr3, dr1... (IRSA moved the QR2 epochs into DR1 in 2026)."""
    for part in url.lower().split("/"):
        if part[:2] in ("qr", "dr") and part[2:].isdigit():
            return part.upper()
    return "unknown"


def mjd_to_iso(mjd: float) -> str:
    return Time(mjd, format="mjd", scale="utc").to_datetime().replace(tzinfo=timezone.utc).strftime("%Y-%m-%d")


def mjd_to_year(mjd: float) -> float:
    return float(Time(mjd, format="mjd", scale="utc").decimalyear)


def pick_spread(rows: list, count: int) -> list:
    """Evenly spaced picks (first and last included)."""
    if count <= 0 or len(rows) <= count:
        return list(rows)
    step = (len(rows) - 1) / (count - 1) if count > 1 else 0
    return [rows[round(i * step)] for i in range(count)]


def frame_id_for(tid: str, det: str, mjd: float) -> str:
    """Stable per observation."""
    return f"{tid}-{det}-{int(round(mjd * 1e5))}"


def wavelength_tolerance(det: str) -> float:
    """Same as wavelengthTolerance in src/lib/data/static/staticProvider.ts."""
    return 0.005 if det in ("D5", "D6") else 0.012


def visits(rows: list[dict]) -> list[list[dict]]:
    out: list[list[dict]] = []
    for r in sorted(rows, key=lambda r: r["mjd"]):
        if out and r["mjd"] - out[-1][-1]["mjd"] <= VISIT_GAP_DAYS:
            out[-1].append(r)
        else:
            out.append([r])
    return out


def best_wavelength_group(rows: list[dict], tol: float) -> list[dict]:
    """Rows whose predicted wavelength lies within tol of a common centre, chosen for (1) the most visits,
    (2) the longest baseline, (3) the most frames."""
    cands = [r for r in rows if r.get("wlPred")]
    best, best_score = [], None
    for c in cands:
        group = [r for r in cands if abs(r["wlPred"] - c["wlPred"]) / c["wlPred"] <= tol]
        span = max(r["mjd"] for r in group) - min(r["mjd"] for r in group)
        score = (len(visits(group)), round(span / 30), len(group))
        if best_score is None or score > best_score:
            best, best_score = group, score
    return sorted(best, key=lambda r: r["mjd"])


def choose_frames(rows: list[dict], det: str) -> tuple[list[dict], list[dict]]:
    """BLINK_FRAMES at one wavelength across the longest baseline (one per visit first, then filled
    evenly), plus SPECTRUM_FRAMES spread in wavelength. Without wavelength predictions: spread in time."""
    if not any(r.get("wlPred") for r in rows):
        return pick_spread(rows, BLINK_FRAMES), []
    # Half the viewer's tolerance, so a small prediction error still lands inside it.
    group = best_wavelength_group(rows, wavelength_tolerance(det) / 2)
    vis = visits(group)
    chosen = [v[len(v) // 2] for v in vis][:BLINK_FRAMES]
    rest = [r for r in group if r not in chosen]
    chosen += pick_spread(rest, BLINK_FRAMES - len(chosen))
    blink = sorted(chosen, key=lambda r: r["mjd"])
    others = sorted((r for r in rows if r not in blink and r.get("wlPred")), key=lambda r: r["wlPred"])
    return blink, pick_spread(others, SPECTRUM_FRAMES)


def choose_stack(rows: list[dict], det: str) -> list[list[dict]]:
    """Per visit, up to STACK_PER_VISIT frames within twice the viewer's tolerance of one common wavelength."""
    group = best_wavelength_group(rows, wavelength_tolerance(det) * 2)
    return [pick_spread(v, STACK_PER_VISIT) for v in visits(group) if v]


def grid_wcs(ra: float, dec: float) -> WCS:
    """The common north-up TAN grid for a target: east left, north up, centred on the target."""
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra, dec]
    w.wcs.crpix = [(GRID_SIZE + 1) / 2, (GRID_SIZE + 1) / 2]  # FITS 1-based: the centre pixel
    w.wcs.cdelt = [-PIXEL_SCALE_ARCSEC / 3600, PIXEL_SCALE_ARCSEC / 3600]
    return w


def grid_header(ra: float, dec: float) -> dict:
    return {
        "ctype": ["RA---TAN", "DEC--TAN"],
        "crval": [ra, dec],
        "crpix": [(GRID_SIZE + 1) / 2, (GRID_SIZE + 1) / 2],
        "cdelt": [-PIXEL_SCALE_ARCSEC / 3600, PIXEL_SCALE_ARCSEC / 3600],
        "size": [GRID_SIZE, GRID_SIZE],
        "centrePixel": {"x": (GRID_SIZE - 1) // 2, "y": (GRID_SIZE - 1) // 2},
        "note": "crpix is 1-based (FITS); centrePixel is 0-based (array index). North up, east left.",
    }


def bilinear(src: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """NaN-aware bilinear sampling at 0-based pixel coordinates; NaN outside the image or next to a NaN."""
    h, w = src.shape
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx = x - x0
    fy = y - y0
    inside = (x0 >= 0) & (y0 >= 0) & (x0 + 1 < w) & (y0 + 1 < h)
    out = np.full(x.shape, np.nan, dtype=np.float64)
    xi, yi = x0[inside], y0[inside]
    a = src[yi, xi]
    b = src[yi, xi + 1]
    c = src[yi + 1, xi]
    d = src[yi + 1, xi + 1]
    fxi, fyi = fx[inside], fy[inside]
    out[inside] = (a * (1 - fxi) * (1 - fyi) + b * fxi * (1 - fyi)
                   + c * (1 - fxi) * fyi + d * fxi * fyi)
    return out


def any_contributing(mask: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """1 where any of the (up to) four source pixels used by bilinear sampling is flagged, else 0."""
    h, w = mask.shape
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    out = np.zeros(x.shape, dtype=np.uint8)
    for dy in (0, 1):
        for dx in (0, 1):
            xi, yi = x0 + dx, y0 + dy
            inside = (xi >= 0) & (yi >= 0) & (xi < w) & (yi < h)
            out[inside] |= mask[yi[inside], xi[inside]]
    return out


def aperture_photometry(img: np.ndarray, var: np.ndarray | None, bad: np.ndarray, cx: float, cy: float) -> dict:
    """Background-subtracted flux in a circular aperture, skipping glitch / NaN pixels.
    Returns flux and error in mJy (images are MJy/sr), or flux None when too much is masked.
    Without a variance image (stacks), the per-pixel variance comes from the background ring's scatter."""
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    r = np.hypot(xx - cx, yy - cy)
    unusable = bad | ~np.isfinite(img)
    ap = r <= APERTURE_RADIUS
    ring = (r >= ANNULUS[0]) & (r <= ANNULUS[1]) & ~unusable
    n_ap = int(ap.sum())
    good = ap & ~unusable
    masked = 1 - good.sum() / max(n_ap, 1)
    if ring.sum() < 8 or masked > MAX_MASKED_FRACTION:
        return {"flux": None, "fluxErr": None, "maskedFraction": round(float(masked), 3),
                "saturated": bool(masked > MAX_MASKED_FRACTION)}
    bg = float(np.nanmedian(img[ring]))
    ring_sd = float(1.4826 * np.nanmedian(np.abs(img[ring] - bg)))
    bg_err = ring_sd / math.sqrt(ring.sum())
    scale = n_ap / good.sum()  # scale up for the few masked pixels so partly flagged frames stay comparable
    total = float(np.nansum(img[good] - bg)) * scale
    if var is not None:
        var_sum = float(np.nansum(var[good])) * scale
    else:
        var_sum = ring_sd ** 2 * n_ap
    err = math.sqrt(max(var_sum, 0.0) + (bg_err * n_ap) ** 2)
    to_mjy = PIXEL_SR * 1e9  # MJy/sr x sr -> MJy -> mJy
    return {"flux": total * to_mjy, "fluxErr": err * to_mjy, "maskedFraction": round(float(masked), 3),
            "saturated": False}


def reproject(path: Path, target: dict, mjd: float) -> dict | None:
    """Reads a cached cutout and puts it on the common grid. Returns arrays and per-frame values."""
    try:
        with fits.open(path) as hdul:
            image = np.asarray(hdul["IMAGE"].data, dtype=np.float64)
            flags = np.asarray(hdul["FLAGS"].data).astype(np.int64)
            variance = np.asarray(hdul["VARIANCE"].data, dtype=np.float64) if "VARIANCE" in hdul else None
            header = hdul["IMAGE"].header
            in_wcs = WCS(header)
            spectral = WCS(header, fobj=hdul, key="W")
            spectral.sip = None
            flag_header = hdul["FLAGS"].header
    except Exception as exc:  # noqa: BLE001 - log and skip a bad file
        log(f"    {path.name}: unreadable FITS ({type(exc).__name__}); skipped")
        return None

    mask = 0
    for name, default_bit in GLITCH_BITS.items():
        mask |= 1 << int(flag_header.get(name, default_bit))
    glitch = ((flags & mask) != 0).astype(np.uint8)

    # Output grid -> sky -> input pixels (the input WCS includes the SIP distortion).
    out_wcs = grid_wcs(target["ra"], target["dec"])
    yy, xx = np.mgrid[0:GRID_SIZE, 0:GRID_SIZE]
    ra_g, dec_g = out_wcs.pixel_to_world_values(xx.astype(np.float64), yy.astype(np.float64))
    x_in, y_in = in_wcs.world_to_pixel_values(ra_g, dec_g)
    img_g = bilinear(image, x_in, y_in)
    var_g = bilinear(variance, x_in, y_in) if variance is not None else None
    glitch_g = any_contributing(glitch, x_in, y_in)
    if not np.isfinite(img_g).any():
        return None

    # Where the star is at this frame's own epoch (it moves across the grid for high proper motion).
    ra_t, dec_t = propagate(target, mjd_to_year(mjd))
    tx, ty = (float(v) for v in out_wcs.world_to_pixel_values(ra_t, dec_t))
    x_src, y_src = in_wcs.world_to_pixel_values(ra_t, dec_t)
    wl, _ = spectral.pixel_to_world_values(float(x_src), float(y_src))
    wavelength_um = float(wl) * 1e6 if float(wl) < 1e-3 else float(wl)
    return {"img": img_g, "var": var_g, "glitch": glitch_g, "tx": tx, "ty": ty, "wavelengthUm": wavelength_um}


def frame_meta(frame_id: str, det: str, mjd: float, release: str, r: dict) -> dict:
    phot = aperture_photometry(r["img"], r["var"], r["glitch"].astype(bool), r["tx"], r["ty"])
    centre = (GRID_SIZE - 1) // 2
    return {
        "id": frame_id,
        "obsDate": mjd_to_iso(mjd),
        "mjd": mjd,
        "detector": det,
        "wavelengthUm": round(r["wavelengthUm"], 4),
        "width": GRID_SIZE,
        "height": GRID_SIZE,
        "pixelScaleArcsec": PIXEL_SCALE_ARCSEC,
        "hasFlags": True,
        "flaggedPixels": int(r["glitch"].sum()),
        "centrePixel": {"x": centre, "y": centre},
        "targetPixel": {"x": round(r["tx"], 2), "y": round(r["ty"], 2)},
        "flux": phot["flux"],
        "fluxErr": phot["fluxErr"],
        "fluxUnit": "mJy",
        "apertureMaskedFraction": phot["maskedFraction"],
        "saturated": phot["saturated"],
        "release": release,
        "files": {"pixels": f"{frame_id}.f32", "flags": f"{frame_id}.u8"},
    }


def write_frame(tdir: Path, meta: dict, r: dict) -> None:
    r["img"].astype("<f4").tofile(tdir / meta["files"]["pixels"])
    r["glitch"].astype(np.uint8).tofile(tdir / meta["files"]["flags"])
    (tdir / f"{meta['id']}.json").write_text(json.dumps(meta, indent=2))


def cached_cutout(tid: str, row: dict, frame_id: str, ra: float, dec: float, size_deg: float,
                  refetch: bool) -> Path | None:
    cdir = CACHE / tid
    cdir.mkdir(parents=True, exist_ok=True)
    path = cdir / f"{frame_id}.fits"
    if path.exists() and not refetch:
        return path
    try:
        resp = get_with_retry(row["url"] + f"?center={ra},{dec}d&size={size_deg}")
    except RuntimeError as exc:
        log(f"    {frame_id}: download failed ({exc})")
        return None
    if resp.status_code != 200:
        log(f"    {frame_id}: HTTP {resp.status_code}")
        return None
    tmp = path.with_suffix(".part")
    tmp.write_bytes(resp.content)
    tmp.replace(path)
    time.sleep(PAUSE_BETWEEN_DOWNLOADS)
    return path


def stack_visit(results: list[tuple[dict, dict]], target: dict) -> tuple[dict, dict] | None:
    """Average of the frames of one visit (glitch pixels left out); the stacked frame takes the mean date
    and the median wavelength of its members. A pixel is a glitch only if no member has a usable value."""
    if not results:
        return None
    imgs = np.stack([np.where(r["glitch"].astype(bool), np.nan, r["img"]) for _, r in results])
    with np.errstate(invalid="ignore"):
        img = np.nanmean(imgs, axis=0)
    usable = np.isfinite(imgs).any(axis=0)
    covered = np.stack([np.isfinite(r["img"]) for _, r in results]).any(axis=0)
    glitch = (covered & ~usable).astype(np.uint8)
    mjd = float(np.mean([row["mjd"] for row, _ in results]))
    ra_t, dec_t = propagate(target, mjd_to_year(mjd))
    tx, ty = (float(v) for v in grid_wcs(target["ra"], target["dec"]).world_to_pixel_values(ra_t, dec_t))
    wl = float(np.median([r["wavelengthUm"] for _, r in results]))
    return {"mjd": mjd, "members": [row["frameId"] for row, _ in results],
            "release": "+".join(sorted({row["release"] for row, _ in results}))}, \
        {"img": img, "var": None, "glitch": glitch, "tx": tx, "ty": ty, "wavelengthUm": wl}


def process_target(target: dict, releases: list[str], size_deg: float, force: bool, refetch: bool,
                   model: LvfModel | None) -> tuple[list[str], dict]:
    tid, ra, dec = target["id"], target["ra"], target["dec"]
    tdir = OUT / tid
    if force and tdir.exists():
        for p in tdir.iterdir():
            if p.is_file():
                p.unlink()
    tdir.mkdir(parents=True, exist_ok=True)
    log(f"\n== {target['name']} ({tid}) at {ra}, {dec}; releases {','.join(releases)}")

    release_filter = " OR ".join(f"a.uri LIKE '%/{r.lower()}/%'" for r in releases)
    skipped: list[str] = []
    coverage: dict = {}
    for det in DETECTORS:
        try:
            rows = coverage_query(ra, dec, det, release_filter)
        except (RuntimeError, requests.HTTPError) as exc:
            log(f"  {det}: TAP query failed ({exc}); skipped")
            skipped.append(f"{det}: query failed")
            continue
        for row in rows:
            row["mjd"] = float(row["mjd"])
            row["release"] = release_of(row.get("url", ""))
            row["frameId"] = frame_id_for(tid, det, row["mjd"])
            row["wlPred"] = None
            if model and det in model.coef and row.get("poly"):
                try:
                    u, v = detector_uv(parse_poly(row["poly"]), ra, dec)
                    row["wlPred"] = model.predict(det, u, v)
                except (ValueError, IndexError):
                    pass
        by_release: dict = {}
        for row in rows:
            by_release.setdefault(row["release"], []).append(row["mjd"])
        coverage[det] = {rel: {"count": len(v), "first": mjd_to_iso(min(v)), "last": mjd_to_iso(max(v))}
                         for rel, v in sorted(by_release.items())}

        blink, spectral = choose_frames(rows, det)
        stack_visits = choose_stack(rows, det) if det in target.get("stack", []) else []
        summary = ", ".join(f"{rel} {c['count']} ({c['first']}..{c['last']})" for rel, c in coverage[det].items())
        wl = [r["wlPred"] for r in blink if r.get("wlPred")]
        log(f"  {det}: {len(rows)} observations [{summary or 'none'}]; blink {len(blink)} "
            f"({mjd_to_iso(blink[0]['mjd']) if blink else '-'}..{mjd_to_iso(blink[-1]['mjd']) if blink else '-'}"
            f"{f', ~{np.median(wl):.3f} um' if wl else ''}), spectrum +{len(spectral)}"
            f"{f', stacks of {[len(v) for v in stack_visits]}' if stack_visits else ''}")

        singles = {r["frameId"]: r for r in blink + spectral}
        members = {r["frameId"]: r for v in stack_visits for r in v}
        todo = {**members, **singles}

        def run(row: dict) -> tuple[dict, dict | None]:
            path = cached_cutout(tid, row, row["frameId"], ra, dec, size_deg, refetch)
            return row, (reproject(path, target, row["mjd"]) if path else None)

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            done = dict((row["frameId"], (row, res)) for row, res in pool.map(run, todo.values()))

        for fid, row in singles.items():
            res = done[fid][1]
            if res is None:
                skipped.append(fid)
                continue
            meta = frame_meta(fid, det, row["mjd"], row["release"], res)
            write_frame(tdir, meta, res)
            flux = "saturated" if meta["saturated"] else (
                f"{meta['flux']:.3g} mJy" if meta["flux"] is not None else "no flux")
            log(f"    {fid}: {meta['obsDate']} {meta['release']} {meta['wavelengthUm']:.3f} um {flux}, "
                f"glitch {meta['flaggedPixels']} px; reprojected to the {GRID_SIZE}x{GRID_SIZE} north-up TAN grid")

        for visit in stack_visits:
            ok = [(r, done[r["frameId"]][1]) for r in visit if done[r["frameId"]][1] is not None]
            stacked = stack_visit(ok, target)
            if stacked is None:
                continue
            info, res = stacked
            fid = frame_id_for(tid, det, info["mjd"])
            meta = frame_meta(fid, det, info["mjd"], info["release"], res)
            meta["stacked"] = len(info["members"])
            meta["members"] = info["members"]
            write_frame(tdir, meta, res)
            flux = f"{meta['flux']:.3g} mJy" if meta["flux"] is not None else "no flux"
            log(f"    stack {fid}: {meta['obsDate']} of {meta['stacked']} frames, {meta['wavelengthUm']:.3f} um, {flux}")
    return skipped, coverage


def rebuild_target_files(target: dict, skipped: list[str], coverage: dict) -> dict | None:
    """Manifest and spectrum from the frame files on disk."""
    tid = target["id"]
    tdir = OUT / tid
    if not tdir.exists():
        return None
    frames, stacks = [], []
    for path in sorted(tdir.glob(f"{tid}-D*.json")):
        meta = json.loads(path.read_text())
        if "targetPixel" in meta and (tdir / meta["files"]["pixels"]).exists():
            (stacks if meta.get("stacked") else frames).append(meta)
    if not frames:
        return None
    frames.sort(key=lambda f: (f["obsDate"], f["detector"]))
    stacks.sort(key=lambda f: (f["obsDate"], f["detector"]))

    # One spectrum point per single frame with a usable flux, sorted by wavelength.
    spectrum = [
        {"wavelengthUm": f["wavelengthUm"], "flux": f["flux"], "fluxErr": f["fluxErr"],
         "detector": f["detector"], "obsDate": f["obsDate"], "frameId": f["id"]}
        for f in frames if f.get("flux") is not None
    ]
    spectrum.sort(key=lambda p: p["wavelengthUm"])
    (tdir / "spectrum.json").write_text(json.dumps(spectrum, indent=2))

    releases = sorted({f["release"] for f in frames})
    manifest = {
        "id": tid,
        "name": target["name"],
        "raDeg": target["ra"],
        "decDeg": target["dec"],
        "epoch": DISPLAY_EPOCH,
        "pixelScaleArcsec": PIXEL_SCALE_ARCSEC,
        "grid": grid_header(target["ra"], target["dec"]),
        "photometry": {"apertureRadiusPx": APERTURE_RADIUS, "annulusPx": list(ANNULUS),
                       "maxMaskedFraction": MAX_MASKED_FRACTION, "unit": "mJy"},
        "glitchBits": GLITCH_BITS,
        "source": "NASA SPHEREx spectral images (Level 2), NASA/IPAC IRSA",
        "releases": releases,
        "doi": [DOIS[r] for r in releases if r in DOIS],
        "detectors": sorted({f["detector"] for f in frames}),
        "dateRange": [frames[0]["obsDate"], frames[-1]["obsDate"]],
        "coverage": coverage,
        "spectrumPoints": len(spectrum),
        "frames": frames,
        "stacks": stacks,
        "skippedLastRun": skipped,
    }
    (tdir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def load_model() -> LvfModel | None:
    if not LVF_MODEL.exists():
        log("No lvf_model.json: frames are spread in time instead of matched in wavelength.")
        return None
    data = json.loads(LVF_MODEL.read_text())
    m = LvfModel()
    m.coef = {d: np.array(c) for d, c in data["coef"].items()}
    m.rms = data.get("rms", {})
    return m


def main() -> int:
    import warnings

    warnings.filterwarnings("ignore", module="astropy")
    args = parse_args()
    global BLINK_FRAMES
    BLINK_FRAMES = max(2, args.per_detector)
    releases = [r.strip().upper() for r in args.release.split(",") if r.strip()]
    wanted = {t.strip() for t in args.targets.split(",") if t.strip()}
    unknown = wanted - {t["id"] for t in TARGETS}
    if unknown:
        log(f"Unknown target ids: {', '.join(sorted(unknown))}")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    model = load_model()

    for target in TARGETS:
        if target["id"] not in wanted:
            continue
        try:
            skipped, coverage = process_target(target, releases, args.size, args.force, args.refetch, model)
        except Exception as exc:  # noqa: BLE001
            log(f"  target failed: {type(exc).__name__}: {exc}")
            skipped, coverage = [f"target failed: {exc}"], {}
        rebuild_target_files(target, skipped, coverage)
        if skipped:
            log(f"  {target['id']}: {len(skipped)} skipped: {', '.join(skipped)}")

    # The index lists every target with data on disk (including ones not fetched this run).
    index = []
    for target in TARGETS:
        mpath = OUT / target["id"] / "manifest.json"
        if not mpath.exists():
            continue
        manifest = json.loads(mpath.read_text())
        index.append({
            "id": manifest["id"],
            "name": manifest["name"],
            "raDeg": manifest["raDeg"],
            "decDeg": manifest["decDeg"],
            "frameCount": len(manifest["frames"]),
            "stackCount": len(manifest.get("stacks", [])),
            "spectrumPoints": manifest["spectrumPoints"],
            "dateRange": manifest["dateRange"],
            "detectors": manifest["detectors"],
            "releases": manifest["releases"],
            "manifest": f"/data/{manifest['id']}/manifest.json",
        })
    (OUT / "index.json").write_text(json.dumps(
        {"generated": datetime.now(timezone.utc).isoformat(), "targets": index}, indent=2))
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    log(f"\nDone. {len(index)} targets with data, {sum(t['frameCount'] for t in index)} frames, "
        f"{sum(t['stackCount'] for t in index)} stacks, total {total / 1e6:.1f} MB")
    return 0 if index else 1


if __name__ == "__main__":
    sys.exit(main())
