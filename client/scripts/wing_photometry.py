"""Photometry for stars that saturate SPHEREx (Barnard's Star, R Draconis): measure the unsaturated outer ring.

Very bright stars fill the 12" aperture with saturated / flagged pixels, so the normal aperture photometry has
no value. Their outer glow (the PSF wings) is not saturated and scales with the star's brightness. This script
measures, on the reprojected grids already in public/data, the flux in a ring just outside the saturated core:

  - the core radius is the largest radius (over all frames of a detector) at which pixels are NaN or flagged
    near the target; one ring per detector, [core + 1, core + 4] px, so every frame is measured the same way;
  - background from a ring [core + 8, core + 12] px; flagged / NaN pixels are skipped and the sum is scaled up
    for them (more than 25% masked -> no value);
  - error from the scatter of the background ring.

The ring flux is in mJy but is only the part of the star's light that falls in the ring, so it is good for
comparing frames of one detector (light curve) and approximate across detectors (spectrum).
Frames with a normal aperture flux are left as they are. Rewrites manifest.json and spectrum.json.

Usage (from client/):  <venv>/Scripts/python.exe scripts/wing_photometry.py barnard r-dra
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
MAX_MASKED = 0.25


def load(tdir: Path, f: dict) -> tuple[np.ndarray, np.ndarray]:
    img = np.fromfile(tdir / f["files"]["pixels"], dtype="<f4").reshape(f["height"], f["width"]).astype(np.float64)
    bad = np.fromfile(tdir / f["files"]["flags"], dtype=np.uint8).reshape(f["height"], f["width"]) != 0
    return img, bad | ~np.isfinite(img)


def core_radius(bad: np.ndarray, tx: float, ty: float) -> float:
    """Largest radius out to which most of each 1-px ring around the target is unusable."""
    yy, xx = np.mgrid[0:bad.shape[0], 0:bad.shape[1]]
    r = np.hypot(xx - tx, yy - ty)
    core = 0.0
    for k in np.arange(0.5, 12, 0.5):
        ring = (r >= k - 0.5) & (r < k + 0.5)
        if ring.any() and bad[ring].mean() > 0.3:
            core = k
        else:
            break
    return core


def ring_flux(img, bad, tx, ty, r_in, r_out, b_in, b_out, pixel_sr) -> tuple[float | None, float | None, float]:
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    r = np.hypot(xx - tx, yy - ty)
    ap = (r >= r_in) & (r <= r_out)
    good = ap & ~bad
    bg_ring = (r >= b_in) & (r <= b_out) & ~bad
    masked = 1 - good.sum() / max(int(ap.sum()), 1)
    if masked > MAX_MASKED or bg_ring.sum() < 10:
        return None, None, masked
    bg = float(np.median(img[bg_ring]))
    sd = float(1.4826 * np.median(np.abs(img[bg_ring] - bg)))
    n = int(ap.sum())
    total = float(np.sum(img[good] - bg)) * n / good.sum()
    err = math.sqrt(sd ** 2 * n + (sd / math.sqrt(bg_ring.sum()) * n) ** 2)
    to_mjy = pixel_sr * 1e9
    return total * to_mjy, err * to_mjy, masked


def main(targets: list[str]) -> int:
    for tid in targets:
        tdir = DATA / tid
        mpath = tdir / "manifest.json"
        m = json.loads(mpath.read_text())
        pixel_sr = (m["pixelScaleArcsec"] / 206264.806) ** 2
        groups = [m["frames"], m.get("stacks", [])]
        for det in m["detectors"]:
            frames = [f for g in groups for f in g if f["detector"] == det and f.get("flux") is None]
            if not frames:
                continue
            loaded = {f["id"]: load(tdir, f) for f in frames}
            core = max(core_radius(loaded[f["id"]][1], f["targetPixel"]["x"], f["targetPixel"]["y"]) for f in frames)
            r_in, r_out, b_in, b_out = core + 1, core + 4, core + 8, core + 12
            ok = 0
            for f in frames:
                img, bad = loaded[f["id"]]
                flux, err, masked = ring_flux(img, bad, f["targetPixel"]["x"], f["targetPixel"]["y"],
                                              r_in, r_out, b_in, b_out, pixel_sr)
                f["flux"], f["fluxErr"] = flux, err
                f["fluxMethod"] = "wing"
                f["wingRingPx"] = [r_in, r_out]
                f["wingMaskedFraction"] = round(float(masked), 3)
                ok += flux is not None
            fl = [f["flux"] for f in frames if f["flux"] is not None]
            spread = f", range {min(fl):.3g}..{max(fl):.3g} mJy" if fl else ""
            print(f"{tid} {det}: core {core:.1f} px -> ring {r_in:.1f}-{r_out:.1f} px; {ok}/{len(frames)} measured{spread}")
        m["photometry"]["wing"] = ("Saturated stars: flux in the unsaturated ring just outside the core "
                                   "(scripts/wing_photometry.py); compare within one detector.")
        mpath.write_text(json.dumps(m, indent=2))
        spectrum = sorted(
            ({"wavelengthUm": f["wavelengthUm"], "flux": f["flux"], "fluxErr": f["fluxErr"], "detector": f["detector"],
              "obsDate": f["obsDate"], "frameId": f["id"], "method": f.get("fluxMethod", "aperture")}
             for f in m["frames"] if f.get("flux") is not None),
            key=lambda p: p["wavelengthUm"])
        m["spectrumPoints"] = len(spectrum)
        mpath.write_text(json.dumps(m, indent=2))
        (tdir / "spectrum.json").write_text(json.dumps(spectrum, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["barnard", "r-dra"]))
