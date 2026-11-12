"""Download real NASA SPHEREx spectral-image cutouts for the AstroBlink preset targets.

Source: SPHEREx Quick Release spectral images, NASA/IPAC Infrared Science Archive (IRSA).
DOIs: 10.26131/IRSA652 (QR2), 10.26131/IRSA662 (QR3).

Re-runnable: frames already on disk are skipped, new epochs are appended, and every manifest,
spectrum and the top-level index are rebuilt from the files on disk. Run it again whenever IRSA
publishes a new release (pass the new release name to --release).

Writes client/public/data/<preset-id>/ (raw float32 pixels, uint8 flags, per-frame JSON,
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
DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"]
DOIS = {"QR2": "10.26131/IRSA652", "QR3": "10.26131/IRSA662"}

# Ids match the preset ids in client/src/data/presets.ts, so the app can route by id.
#
# Positions are catalogue positions at a reference epoch, with proper motions (mas/yr; pmra includes cos dec).
# Each target is propagated to DISPLAY_EPOCH, roughly the middle of the SPHEREx observations, so the
# moving stars sit near the centre of every frame and their motion shows as a 1–2 pixel shift.
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


def propagate(target: dict, epoch: float) -> tuple[float, float]:
    """Linear proper-motion propagation; accurate to well under a SPHEREx pixel over a decade."""
    dt = epoch - target["epoch0"]
    dec0 = math.radians(target["dec0"])
    dra_deg = target["pmra"] / 1000 / 3600 * dt / math.cos(dec0)
    ddec_deg = target["pmdec"] / 1000 / 3600 * dt
    return (target["ra0"] + dra_deg) % 360, target["dec0"] + ddec_deg


for _t in TARGETS:
    _t["ra"], _t["dec"] = (round(v, 6) for v in propagate(_t, DISPLAY_EPOCH))

HEADERS = {"User-Agent": "AstroBlink-data-fetch/1.1 (educational, NASA Space Apps)"}
PAUSE_BETWEEN_DOWNLOADS = 1.0  # seconds; keeps the load on IRSA polite


def log(msg: str) -> None:
    print(msg, flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--release", default="QR2,QR3",
                        help="Comma-separated SPHEREx releases to include, e.g. QR2,QR3 (any future name works).")
    parser.add_argument("--targets", default=",".join(t["id"] for t in TARGETS),
                        help="Comma-separated preset ids to fetch. Default: all five.")
    parser.add_argument("--per-detector", type=int, default=8,
                        help="Frames per detector, spread across the observing period. Default 8.")
    parser.add_argument("--size", type=float, default=0.25,
                        help="Cutout size in degrees. Default 0.25 (covers the 15 arcmin view).")
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
            # IRSA occasionally appends a status or error line; skip anything that isn't a full row.
            log(f"    ignored a malformed TAP row: {line[:80]!r}")
            continue
        rows.append(dict(zip(header, values)))
    return rows


def release_of(url: str) -> str:
    for part in url.lower().split("/"):
        if part.startswith("qr") and part[2:].isdigit():
            return part.upper()
    return "unknown"


def mjd_to_iso(mjd: float) -> str:
    return Time(mjd, format="mjd", scale="utc").to_datetime().replace(tzinfo=timezone.utc).strftime("%Y-%m-%d")


def pick_spread(rows: list[dict], count: int) -> list[dict]:
    """Evenly spaced picks over time, so the frames cover the whole observing period."""
    if count <= 0 or len(rows) <= count:
        return rows
    step = (len(rows) - 1) / (count - 1) if count > 1 else 0
    return [rows[round(i * step)] for i in range(count)]


def frame_id_for(tid: str, det: str, mjd: float) -> str:
    """Stable per observation, so re-runs skip it and new epochs get new ids."""
    return f"{tid}-{det}-{int(round(mjd * 1e5))}"


def read_cutout(path: Path, frame_id: str, det: str, mjd: float, release: str,
                ra: float, dec: float, tdir: Path, pad_to: int) -> dict | None:
    try:
        with fits.open(path) as hdul:
            image = hdul["IMAGE"].data
            flags = hdul["FLAGS"].data
            header = hdul["IMAGE"].header
            wcs = WCS(header)
            spectral = WCS(header, fobj=hdul, key="W")
            spectral.sip = None
            x, y = wcs.world_to_pixel_values(ra, dec)
            ny, nx = image.shape
            ix, iy = int(round(float(x))), int(round(float(y)))
            wl, _ = spectral.pixel_to_world_values(float(x), float(y))
            wavelength_um = float(wl) * 1e6 if float(wl) < 1e-3 else float(wl)
            img32 = np.asarray(image, dtype=np.float32)
            flg8 = np.clip(np.asarray(flags), 0, 255).astype(np.uint8)
    except Exception as exc:  # noqa: BLE001 - log and skip a bad file
        log(f"    {frame_id}: unreadable FITS ({type(exc).__name__}); skipped")
        return None

    # Pad to a common square size: NaN for missing pixels, 0 (ok) for flags. Views line up across frames.
    if nx > pad_to or ny > pad_to:
        log(f"    {frame_id}: {nx}x{ny} is larger than {pad_to}x{pad_to}; skipped")
        return None
    padded_img = np.full((pad_to, pad_to), np.nan, dtype=np.float32)
    padded_flg = np.zeros((pad_to, pad_to), dtype=np.uint8)
    padded_img[:ny, :nx] = img32
    padded_flg[:ny, :nx] = flg8
    padded_img.astype("<f4").tofile(tdir / f"{frame_id}.f32")
    padded_flg.tofile(tdir / f"{frame_id}.u8")

    centre = None
    if 0 <= ix < nx and 0 <= iy < ny and np.isfinite(img32[iy, ix]):
        centre = float(img32[iy, ix])
    return {
        "id": frame_id,
        "obsDate": mjd_to_iso(mjd),
        "mjd": mjd,
        "detector": det,
        "wavelengthUm": round(wavelength_um, 4),
        "width": pad_to,
        "height": pad_to,
        "pixelScaleArcsec": PIXEL_SCALE_ARCSEC,
        "hasFlags": True,
        "centrePixel": {"x": ix, "y": iy},
        "centreFlux": centre,
        "release": release,
        "files": {"pixels": f"{frame_id}.f32", "flags": f"{frame_id}.u8"},
    }


def download_target(target: dict, releases: list[str], per_detector: int, size_deg: float) -> list[str]:
    tid, ra, dec = target["id"], target["ra"], target["dec"]
    tdir = OUT / tid
    tdir.mkdir(parents=True, exist_ok=True)
    pad_to = int(math.ceil(size_deg * 3600 / PIXEL_SCALE_ARCSEC)) + 2
    log(f"\n== {target['name']} ({tid}) at {ra}, {dec}; releases {','.join(releases)}")

    release_filter = " OR ".join(f"a.uri LIKE '%/{r.lower()}/%'" for r in releases)
    skipped: list[str] = []
    for det in DETECTORS:
        adql = (
            "SELECT 'https://irsa.ipac.caltech.edu/' || a.uri AS url, p.time_bounds_lower AS mjd "
            "FROM spherex.artifact a JOIN spherex.plane p ON a.planeid = p.planeid "
            f"WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly) "
            f"AND p.energy_bandpassname = 'SPHEREx-{det}' AND ({release_filter}) "
            "ORDER BY p.time_bounds_lower"
        )
        try:
            rows = tap_query(adql)
        except (RuntimeError, requests.HTTPError) as exc:
            log(f"  {det}: TAP query failed ({exc}); skipped")
            skipped.append(f"{det}: query failed")
            continue
        picks = pick_spread(rows, per_detector)
        log(f"  {det}: {len(rows)} observations cover the position; using {len(picks)}")
        for row in picks:
            try:
                mjd = float(row["mjd"])
            except (KeyError, ValueError):
                log(f"    {det}: row without a usable time ({row}); skipped")
                skipped.append(f"{det}: bad row")
                continue
            frame_id = frame_id_for(tid, det, mjd)
            if (tdir / f"{frame_id}.json").exists() and (tdir / f"{frame_id}.f32").exists():
                continue  # already downloaded
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
            meta = read_cutout(tmp, frame_id, det, mjd, release_of(row["url"]), ra, dec, tdir, pad_to)
            tmp.unlink(missing_ok=True)
            if meta is None:
                skipped.append(frame_id)
                continue
            (tdir / f"{frame_id}.json").write_text(json.dumps(meta, indent=2))
            log(f"    {frame_id}: {meta['obsDate']} {meta['release']} {meta['wavelengthUm']:.3f} um")
            time.sleep(PAUSE_BETWEEN_DOWNLOADS)
    return skipped


def rebuild_target_files(target: dict, skipped: list[str]) -> dict | None:
    """Manifest and spectrum come from every frame on disk, so earlier runs and new epochs merge."""
    tid = target["id"]
    tdir = OUT / tid
    if not tdir.exists():
        return None
    frames = []
    for path in sorted(tdir.glob(f"{tid}-D*.json")):
        meta = json.loads(path.read_text())
        if (tdir / meta["files"]["pixels"]).exists():
            frames.append(meta)
    if not frames:
        return None
    frames.sort(key=lambda f: (f["obsDate"], f["detector"]))

    spectrum = []
    for det in DETECTORS:
        items = [f for f in frames if f["detector"] == det and f.get("centreFlux") is not None]
        if not items:
            continue
        fluxes = np.array([f["centreFlux"] for f in items], dtype=float)
        spectrum.append({
            "detector": det,
            "wavelengthUm": round(float(np.nanmean([f["wavelengthUm"] for f in items])), 4),
            "flux": float(np.nanmean(fluxes)),
            "fluxErr": float(np.nanstd(fluxes) / math.sqrt(len(fluxes))),
        })
    spectrum.sort(key=lambda p: p["wavelengthUm"])
    (tdir / "spectrum.json").write_text(json.dumps(spectrum, indent=2))

    releases = sorted({f["release"] for f in frames})
    manifest = {
        "id": tid,
        "name": target["name"],
        "raDeg": target["ra"],
        "decDeg": target["dec"],
        "pixelScaleArcsec": PIXEL_SCALE_ARCSEC,
        "source": "NASA SPHEREx Quick Release spectral images, NASA/IPAC IRSA",
        "releases": releases,
        "doi": [DOIS[r] for r in releases if r in DOIS],
        "detectors": sorted({f["detector"] for f in frames}),
        "dateRange": [frames[0]["obsDate"], frames[-1]["obsDate"]],
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

    skipped_by_target: dict[str, list[str]] = {}
    for target in TARGETS:
        if target["id"] not in wanted:
            continue
        try:
            skipped_by_target[target["id"]] = download_target(target, releases, args.per_detector, args.size)
        except Exception as exc:  # noqa: BLE001
            log(f"  target failed: {type(exc).__name__}: {exc}")
            skipped_by_target[target["id"]] = [f"target failed: {exc}"]

    # The index lists every target with data on disk, including ones not fetched in this run.
    index = []
    for target in TARGETS:
        manifest = rebuild_target_files(target, skipped_by_target.get(target["id"], []))
        if manifest:
            index.append({
                "id": manifest["id"],
                "name": manifest["name"],
                "raDeg": manifest["raDeg"],
                "decDeg": manifest["decDeg"],
                "frameCount": len(manifest["frames"]),
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
    for tid, skipped in skipped_by_target.items():
        if skipped:
            log(f"  {tid}: {len(skipped)} skipped this run")
    return 0 if index else 1


if __name__ == "__main__":
    sys.exit(main())
