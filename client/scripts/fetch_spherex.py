"""Download real NASA SPHEREx spectral-image cutouts for the AstroBlink preset targets.

Source: SPHEREx Quick Release spectral images, NASA/IPAC Infrared Science Archive (IRSA).
DOIs: 10.26131/IRSA652 (QR2), 10.26131/IRSA662 (QR3).

Every frame of a target is reprojected onto ONE common north-up TAN grid centred on the target
(same size and pixel scale for all frames), so blink and difference images line up and only real
changes show. Target flux comes from aperture photometry that skips flagged, saturated and empty
pixels; the spectrum has one point per frame.

Re-runnable: frames already on disk are skipped (use --force to redo them), new epochs are appended,
and every manifest, spectrum and the top-level index are rebuilt from the files on disk.

Writes client/public/data/<preset-id>/ (float32 pixels, uint8 glitch mask, per-frame JSON,
manifest.json, spectrum.json) and client/public/data/index.json.

Usage (from client/):
    <venv>/Scripts/python.exe scripts/fetch_spherex.py
    <venv>/Scripts/python.exe scripts/fetch_spherex.py --release QR2,QR3 --targets wise-0855,barnard
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"
TAP = "https://irsa.ipac.caltech.edu/TAP/sync"

PIXEL_SCALE_ARCSEC = 6.2
GRID_SIZE = 145  # 145 × 6.2″ ≈ 15′, the largest field of view in the viewer
DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"]
DOIS = {"QR2": "10.26131/IRSA652", "QR3": "10.26131/IRSA662"}

# Aperture photometry (pixels on the common grid).
APERTURE_RADIUS = 2.0  # ≈ 12″, about two SPHEREx PSF widths
ANNULUS = (5.0, 8.0)  # background ring
MAX_MASKED_FRACTION = 0.25  # more masked aperture pixels than this → no flux (saturated or off-image)
PIXEL_SR = (PIXEL_SCALE_ARCSEC / 206264.806) ** 2  # pixel solid angle, steradian

# Ids match the preset ids in client/src/data/presets.ts, so the app can route by id.
#
# Positions are catalogue positions at a reference epoch, with proper motions (mas/yr; pmra includes cos dec).
# The grid is centred on each target's position at DISPLAY_EPOCH (≈ the middle of the SPHEREx data), and
# the photometry aperture follows the star to each frame's own epoch.
# SIMBAD was unreachable when this was written, so positions come from:
#   Barnard's Star, Epsilon Indi B: Gaia DR3 (gaiadr3.gaia_source, epoch 2016.0).
#   WISE 0855: CatWISE2020 at IRSA (J085507.96-071439.3, epoch MJD 57338.57 = 2015.87).
#   R Draconis, RW Aurigae: the team brief; their proper motion is negligible here.
DISPLAY_EPOCH = 2025.9
TARGETS = [
    {"id": "wise-0855", "name": "WISE J085510.83-071442.5",
     "ra0": 133.7831722, "dec0": -7.2442516, "pmra": -8021.2, "pmdec": 1035.7, "epoch0": 2015.87},
    {"id": "barnard", "name": "Barnard's Star",
     "ra0": 269.44850252543836, "dec0": 4.739420051112412, "pmra": -801.551, "pmdec": 10362.394, "epoch0": 2016.0},
    {"id": "eps-indi-b", "name": "Epsilon Indi B",
     "ra0": 331.07645259656397, "dec0": -56.79381206688221, "pmra": 3981.977, "pmdec": -2466.832, "epoch0": 2016.0},
    {"id": "r-dra", "name": "R Draconis", "ra0": 248.16667, "dec0": 66.755, "pmra": 0.0, "pmdec": 0.0, "epoch0": 2000.0},
    {"id": "rw-aur", "name": "RW Aurigae", "ra0": 76.95625, "dec0": 30.40139, "pmra": 0.0, "pmdec": 0.0, "epoch0": 2000.0},
]

HEADERS = {"User-Agent": "AstroBlink-data-fetch/2.0 (educational, NASA Space Apps)"}
PAUSE_BETWEEN_DOWNLOADS = 1.0  # seconds; keeps the load on IRSA polite

# SPHEREx FLAGS is a 32-bit mask; bit numbers come from the MP_* keywords in the FLAGS header.
# These bits mark unreliable pixels (glitches). Informational bits are ignored:
# MP_SOURCE (21, "part of a detected source"), MP_REFERENCE (5), MP_DICHROIC (7), MP_FULLSAMPLE (12).
GLITCH_BITS = {
    "MP_TRANSIENT": 0,  # cosmic ray or other transient
    "MP_OVERFLOW": 1,  # saturated
    "MP_SUR_ERROR": 2,
    "MP_PHANTOM": 4,
    "MP_NONFUNC": 6,  # dead pixel
    "MP_MISSING_DATA": 9,
    "MP_HOT": 10,
    "MP_COLD": 11,
    "MP_PHANMISS": 14,
    "MP_NONLINEAR": 15,
    "MP_PERSIST": 17,  # persistence from an earlier bright source
    "MP_OUTLIER": 19,
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
    parser.add_argument("--release", default="QR2,QR3",
                        help="Comma-separated SPHEREx releases to include, e.g. QR2,QR3 (any future name works).")
    parser.add_argument("--targets", default=",".join(t["id"] for t in TARGETS),
                        help="Comma-separated preset ids to fetch. Default: all five.")
    parser.add_argument("--per-detector", type=int, default=10,
                        help="Frames per detector, spread across the observing period. Default 10.")
    parser.add_argument("--size", type=float, default=0.25,
                        help="Cutout size in degrees requested from IRSA. Default 0.25 (covers the 15′ grid).")
    parser.add_argument("--force", action="store_true",
                        help="Download again even if a frame is already on disk.")
    return parser.parse_args()


def get_with_retry(url: str, *, data=None, method="GET", attempts=5):
    """Retries HTTP 5xx and network errors with exponential backoff. 4xx is returned to the caller."""
    delay = 4
    last = None
    for attempt in range(1, attempts + 1):
        try:
            resp = requests.request(method, url, data=data, headers=HEADERS, timeout=300)
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
    resp = get_with_retry(TAP, data={"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": adql},
                          method="POST")
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
    """All observations covering the position. IRSA sometimes answers with an empty table by mistake,
    so an empty answer is asked again before it is believed."""
    adql = (
        "SELECT 'https://irsa.ipac.caltech.edu/' || a.uri AS url, p.time_bounds_lower AS mjd "
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
    for part in url.lower().split("/"):
        if part.startswith("qr") and part[2:].isdigit():
            return part.upper()
    return "unknown"


def mjd_to_iso(mjd: float) -> str:
    return Time(mjd, format="mjd", scale="utc").to_datetime().replace(tzinfo=timezone.utc).strftime("%Y-%m-%d")


def mjd_to_year(mjd: float) -> float:
    return float(Time(mjd, format="mjd", scale="utc").decimalyear)


def pick_spread(rows: list[dict], count: int) -> list[dict]:
    """Evenly spaced picks over time, so the frames cover the whole observing period."""
    if count <= 0 or len(rows) <= count:
        return rows
    step = (len(rows) - 1) / (count - 1) if count > 1 else 0
    return [rows[round(i * step)] for i in range(count)]


def frame_id_for(tid: str, det: str, mjd: float) -> str:
    """Stable per observation, so re-runs skip it and new epochs get new ids."""
    return f"{tid}-{det}-{int(round(mjd * 1e5))}"


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


def nearest(src: np.ndarray, x: np.ndarray, y: np.ndarray, fill=0) -> np.ndarray:
    h, w = src.shape
    xi = np.rint(x).astype(np.int64)
    yi = np.rint(y).astype(np.int64)
    inside = (xi >= 0) & (yi >= 0) & (xi < w) & (yi < h)
    out = np.full(x.shape, fill, dtype=src.dtype)
    out[inside] = src[yi[inside], xi[inside]]
    return out


def aperture_photometry(img: np.ndarray, var: np.ndarray, bad: np.ndarray, cx: float, cy: float) -> dict:
    """Background-subtracted flux in a circular aperture, skipping flagged / NaN pixels.
    Returns flux and error in mJy (images are MJy/sr), or flux None when too much is masked."""
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    r = np.hypot(xx - cx, yy - cy)
    unusable = bad | ~np.isfinite(img)
    ap = r <= APERTURE_RADIUS
    ring = (r >= ANNULUS[0]) & (r <= ANNULUS[1]) & ~unusable
    n_ap = int(ap.sum())
    good = ap & ~unusable
    masked = 1 - good.sum() / max(n_ap, 1)
    if ring.sum() < 8 or masked > MAX_MASKED_FRACTION:
        return {"flux": None, "fluxErr": None, "maskedFraction": round(float(masked), 3), "saturated": bool(masked > MAX_MASKED_FRACTION)}
    bg = float(np.nanmedian(img[ring]))
    bg_err = float(np.nanstd(img[ring]) / math.sqrt(ring.sum()))
    # Scale up for the few masked pixels so partially flagged frames stay comparable.
    scale = n_ap / good.sum()
    total = float(np.nansum(img[good] - bg)) * scale
    var_sum = float(np.nansum(var[good])) * scale if var is not None else 0.0
    err = math.sqrt(max(var_sum, 0.0) + (bg_err * n_ap) ** 2)
    to_mjy = PIXEL_SR * 1e9  # MJy/sr × sr → MJy → mJy
    return {"flux": total * to_mjy, "fluxErr": err * to_mjy, "maskedFraction": round(float(masked), 3), "saturated": False}


def process_cutout(path: Path, frame_id: str, det: str, mjd: float, release: str,
                   target: dict, tdir: Path) -> dict | None:
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
        log(f"    {frame_id}: unreadable FITS ({type(exc).__name__}); skipped")
        return None

    mask = 0
    for name, default_bit in GLITCH_BITS.items():
        mask |= 1 << int(flag_header.get(name, default_bit))
    glitch = ((flags & mask) != 0).astype(np.uint8)

    # Output grid → sky → input pixels (the input WCS includes the SIP distortion).
    out_wcs = grid_wcs(target["ra"], target["dec"])
    yy, xx = np.mgrid[0:GRID_SIZE, 0:GRID_SIZE]
    ra_g, dec_g = out_wcs.pixel_to_world_values(xx.astype(np.float64), yy.astype(np.float64))
    x_in, y_in = in_wcs.world_to_pixel_values(ra_g, dec_g)
    img_g = bilinear(image, x_in, y_in).astype(np.float32)
    var_g = bilinear(variance, x_in, y_in) if variance is not None else None
    glitch_g = nearest(glitch, x_in, y_in, fill=0)
    if not np.isfinite(img_g).any():
        log(f"    {frame_id}: no overlap with the grid; skipped")
        return None

    # Where the star is at this frame's own epoch (it moves across the grid for high proper motion).
    epoch = mjd_to_year(mjd)
    ra_t, dec_t = propagate(target, epoch)
    tx, ty = out_wcs.world_to_pixel_values(ra_t, dec_t)
    tx, ty = float(tx), float(ty)
    x_src, y_src = in_wcs.world_to_pixel_values(ra_t, dec_t)
    wl, _ = spectral.pixel_to_world_values(float(x_src), float(y_src))
    wavelength_um = float(wl) * 1e6 if float(wl) < 1e-3 else float(wl)

    phot = aperture_photometry(img_g, var_g, glitch_g.astype(bool), tx, ty)

    img_g.astype("<f4").tofile(tdir / f"{frame_id}.f32")
    glitch_g.astype(np.uint8).tofile(tdir / f"{frame_id}.u8")
    centre = (GRID_SIZE - 1) // 2
    return {
        "id": frame_id,
        "obsDate": mjd_to_iso(mjd),
        "mjd": mjd,
        "detector": det,
        "wavelengthUm": round(wavelength_um, 4),
        "width": GRID_SIZE,
        "height": GRID_SIZE,
        "pixelScaleArcsec": PIXEL_SCALE_ARCSEC,
        "hasFlags": True,
        "flaggedPixels": int(glitch_g.sum()),
        "centrePixel": {"x": centre, "y": centre},
        "targetPixel": {"x": round(tx, 2), "y": round(ty, 2)},
        "flux": phot["flux"],
        "fluxErr": phot["fluxErr"],
        "fluxUnit": "mJy",
        "apertureMaskedFraction": phot["maskedFraction"],
        "saturated": phot["saturated"],
        "release": release,
        "files": {"pixels": f"{frame_id}.f32", "flags": f"{frame_id}.u8"},
    }


def download_target(target: dict, releases: list[str], per_detector: int, size_deg: float,
                    force: bool) -> tuple[list[str], dict]:
    tid, ra, dec = target["id"], target["ra"], target["dec"]
    tdir = OUT / tid
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
        by_release: dict = {}
        for row in rows:
            rel = release_of(row.get("url", ""))
            by_release.setdefault(rel, []).append(float(row["mjd"]))
        coverage[det] = {rel: {"count": len(v), "first": mjd_to_iso(min(v)), "last": mjd_to_iso(max(v))}
                         for rel, v in sorted(by_release.items())}
        picks = pick_spread(rows, per_detector)
        summary = ", ".join(f"{rel} {c['count']} ({c['first']}..{c['last']})" for rel, c in coverage[det].items())
        log(f"  {det}: {len(rows)} observations [{summary or 'none'}]; using {len(picks)}")
        for row in picks:
            try:
                mjd = float(row["mjd"])
            except (KeyError, ValueError):
                skipped.append(f"{det}: bad row")
                continue
            frame_id = frame_id_for(tid, det, mjd)
            if not force and (tdir / f"{frame_id}.json").exists() and (tdir / f"{frame_id}.f32").exists():
                continue
            try:
                resp = get_with_retry(row["url"] + f"?center={ra},{dec}d&size={size_deg}")
            except RuntimeError as exc:
                log(f"    {frame_id}: download failed ({exc}); skipped")
                skipped.append(frame_id)
                continue
            if resp.status_code != 200:
                log(f"    {frame_id}: HTTP {resp.status_code}; skipped")
                skipped.append(frame_id)
                continue
            tmp = tdir / f"{frame_id}.fits"
            tmp.write_bytes(resp.content)
            meta = process_cutout(tmp, frame_id, det, mjd, release_of(row["url"]), target, tdir)
            tmp.unlink(missing_ok=True)
            if meta is None:
                skipped.append(frame_id)
                continue
            (tdir / f"{frame_id}.json").write_text(json.dumps(meta, indent=2))
            flux = "saturated" if meta["saturated"] else (f"{meta['flux']:.3g} mJy" if meta["flux"] is not None else "no flux")
            log(f"    {frame_id}: {meta['obsDate']} {meta['release']} {meta['wavelengthUm']:.3f} um {flux}")
            time.sleep(PAUSE_BETWEEN_DOWNLOADS)
    return skipped, coverage


def rebuild_target_files(target: dict, skipped: list[str], coverage: dict) -> dict | None:
    """Manifest and spectrum come from every frame on disk, so earlier runs and new epochs merge."""
    tid = target["id"]
    tdir = OUT / tid
    if not tdir.exists():
        return None
    frames = []
    for path in sorted(tdir.glob(f"{tid}-D*.json")):
        meta = json.loads(path.read_text())
        # Only frames produced by this (reprojecting) pipeline belong in the manifest.
        if "targetPixel" in meta and (tdir / meta["files"]["pixels"]).exists():
            frames.append(meta)
    if not frames:
        return None
    frames.sort(key=lambda f: (f["obsDate"], f["detector"]))

    # One spectrum point per frame with a usable flux, sorted by wavelength.
    spectrum = [
        {"wavelengthUm": f["wavelengthUm"], "flux": f["flux"], "fluxErr": f["fluxErr"],
         "detector": f["detector"], "obsDate": f["obsDate"], "frameId": f["id"]}
        for f in frames if f.get("flux") is not None
    ]
    spectrum.sort(key=lambda p: p["wavelengthUm"])
    (tdir / "spectrum.json").write_text(json.dumps(spectrum, indent=2))

    old = {}
    if (tdir / "manifest.json").exists():
        try:
            old = json.loads((tdir / "manifest.json").read_text())
        except json.JSONDecodeError:
            old = {}
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
        "source": "NASA SPHEREx Quick Release spectral images, NASA/IPAC IRSA",
        "releases": releases,
        "doi": [DOIS[r] for r in releases if r in DOIS],
        "detectors": sorted({f["detector"] for f in frames}),
        "dateRange": [frames[0]["obsDate"], frames[-1]["obsDate"]],
        "coverage": coverage or old.get("coverage", {}),
        "spectrumPoints": len(spectrum),
        "frames": frames,
        "skippedLastRun": skipped,
    }
    (tdir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def main() -> int:
    args = parse_args()
    releases = [r.strip().upper() for r in args.release.split(",") if r.strip()]
    wanted = {t.strip() for t in args.targets.split(",") if t.strip()}
    unknown = wanted - {t["id"] for t in TARGETS}
    if unknown:
        log(f"Unknown target ids: {', '.join(sorted(unknown))}")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    results: dict[str, tuple[list[str], dict]] = {}
    for target in TARGETS:
        if target["id"] not in wanted:
            continue
        try:
            results[target["id"]] = download_target(target, releases, args.per_detector, args.size, args.force)
        except Exception as exc:  # noqa: BLE001
            log(f"  target failed: {type(exc).__name__}: {exc}")
            results[target["id"]] = ([f"target failed: {exc}"], {})

    index = []
    for target in TARGETS:
        skipped, coverage = results.get(target["id"], ([], {}))
        manifest = rebuild_target_files(target, skipped, coverage)
        if manifest:
            index.append({
                "id": manifest["id"],
                "name": manifest["name"],
                "raDeg": manifest["raDeg"],
                "decDeg": manifest["decDeg"],
                "frameCount": len(manifest["frames"]),
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
        f"total {total / 1e6:.1f} MB")
    for tid, (skipped, _) in results.items():
        if skipped:
            log(f"  {tid}: {len(skipped)} skipped this run")
    return 0 if index else 1


if __name__ == "__main__":
    sys.exit(main())
