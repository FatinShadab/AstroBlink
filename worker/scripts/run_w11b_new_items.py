"""Programmatic Evidence Collector & Table Generator for W11b New Items 1-5.

Writes all raw computed output to `/scratch/w11b_new_items.json` and renders all Markdown
tables directly into `/scratch/w11b_new_items_tables.md`.
"""
from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import json
import math
import os
import statistics
import urllib.parse
import urllib.request
from typing import Any

from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
import numpy as np
from reproject import reproject_interp
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage import label as ndimage_label
from scipy.spatial import cKDTree

from worker.config import settings
from worker.processing.masking import (
    apply_airglow_mask,
    apply_flags_mask,
    apply_shared_wavelength_mask,
    combine_masks,
    extract_transient_outlier_overlay,
)
from worker.processing.reproject import build_target_wcs
from worker.render.tiles import render_tile_image
from worker.sources.irsa import (
    cluster_exposures_into_epochs,
    cutout_coverage_fraction,
    detector_for_wavelength,
    parse_poly_wkb,
)
from worker.sources.s3 import fetch_ranged_cutout, get_spherex_s3_client

TARGETS = [
    {"id": "Target 1", "ra": 15.0, "dec": -20.0, "is_cvz": False},
    {"id": "Target 2 (CVZ)", "ra": 269.5, "dec": 66.5, "is_cvz": True},
    {"id": "Target 3", "ra": 180.0, "dec": 0.0, "is_cvz": False},
    {"id": "Target 4", "ra": 45.0, "dec": -45.0, "is_cvz": False},
    {"id": "Target 5", "ra": 120.0, "dec": 30.0, "is_cvz": False},
]

# Selected Epoch 1 & Epoch 2 matched pairs across the 5 targets (15 pairs = 30 files)
SELECTED_PAIRS = [
    # Target 1
    ("Target 1", 15.0, -20.0, 1.0, "D1",
     "qr2/level2/2025W25_1B/l2b-v20-2025-253/1/level2_2025W25_1B_0173_4D1_spx_l2b-v20-2025-253.fits",
     "qr2/level2/2025W52_2A/l2b-v22-2026-006/1/level2_2025W52_2A_0107_1D1_spx_l2b-v22-2026-006.fits"),
    ("Target 1", 15.0, -20.0, 2.0, "D3",
     "qr2/level2/2025W27_2A/l2b-v20-2025-259/3/level2_2025W27_2A_0373_1D3_spx_l2b-v20-2025-259.fits",
     "qr2/level2/2025W51_1A/l2b-v21-2025-354/3/level2_2025W51_1A_0732_1D3_spx_l2b-v21-2025-354.fits"),
    ("Target 1", 15.0, -20.0, 4.0, "D5",
     "qr2/level2/2025W27_1A/l2b-v20-2025-258/5/level2_2025W27_1A_0157_3D5_spx_l2b-v20-2025-258.fits",
     "qr2/level2/2025W52_1A/l2b-v21-2025-363/5/level2_2025W52_1A_0503_2D5_spx_l2b-v21-2025-363.fits"),
    # Target 2 (CVZ)
    ("Target 2 (CVZ)", 269.5, 66.5, 1.0, "D1",
     "qr2/level2/2025W19_2B/l2b-v20-2025-247/1/level2_2025W19_2B_0484_1D1_spx_l2b-v20-2025-247.fits",
     "qr2/level2/2026W01_1A/l2b-v22-2026-007/1/level2_2026W01_1A_0019_1D1_spx_l2b-v22-2026-007.fits"),
    ("Target 2 (CVZ)", 269.5, 66.5, 2.0, "D3",
     "qr2/level2/2025W22_1B/l2b-v20-2025-250/3/level2_2025W22_1B_0128_1D3_spx_l2b-v20-2025-250.fits",
     "qr2/level2/2026W04_1A/l2b-v23-2026-023/3/level2_2026W04_1A_0672_4D3_spx_l2b-v23-2026-023.fits"),
    ("Target 2 (CVZ)", 269.5, 66.5, 4.0, "D5",
     "qr2/level2/2025W38_2C/l2b-v20-2025-269/5/level2_2025W38_2C_0244_2D5_spx_l2b-v20-2025-269.fits",
     "qr2/level2/2026W15_2A/l2b-v24-2026-105/5/level2_2026W15_2A_0199_2D5_spx_l2b-v24-2026-105.fits"),
    # Target 3
    ("Target 3", 180.0, 0.0, 1.0, "D1",
     "qr2/level2/2025W21_1B/l2b-v20-2025-248/1/level2_2025W21_1B_0594_3D1_spx_l2b-v20-2025-248.fits",
     "qr2/level2/2025W52_1A/l2b-v21-2025-363/1/level2_2025W52_1A_0014_1D1_spx_l2b-v21-2025-363.fits"),
    ("Target 3", 180.0, 0.0, 2.0, "D3",
     "qr2/level2/2025W20_2D/l2b-v20-2025-247/3/level2_2025W20_2D_0313_1D3_spx_l2b-v20-2025-247.fits",
     "qr2/level2/2025W52_2A/l2b-v22-2026-006/3/level2_2025W52_2A_0158_1D3_spx_l2b-v22-2026-006.fits"),
    ("Target 3", 180.0, 0.0, 4.0, "D5",
     "qr2/level2/2025W21_1B/l2b-v20-2025-248/5/level2_2025W21_1B_0570_2D5_spx_l2b-v20-2025-248.fits",
     "qr2/level2/2025W52_1A/l2b-v21-2025-363/5/level2_2025W52_1A_0081_2D5_spx_l2b-v21-2025-363.fits"),
    # Target 4
    ("Target 4", 45.0, -45.0, 1.0, "D1",
     "qr2/level2/2025W26_2A/l2b-v20-2025-257/1/level2_2025W26_2A_0150_4D1_spx_l2b-v20-2025-257.fits",
     "qr2/level2/2026W01_2A/l2b-v23-2026-008/1/level2_2026W01_2A_0319_1D1_spx_l2b-v23-2026-008.fits"),
    ("Target 4", 45.0, -45.0, 2.0, "D3",
     "qr2/level2/2025W28_2A/l2b-v20-2025-260/3/level2_2025W28_2A_0271_4D3_spx_l2b-v20-2025-260.fits",
     "qr2/level2/2025W51_2A/l2b-v21-2025-357/3/level2_2025W51_2A_0084_3D3_spx_l2b-v21-2025-357.fits"),
    ("Target 4", 45.0, -45.0, 4.0, "D5",
     "qr2/level2/2025W27_1A/l2b-v20-2025-258/5/level2_2025W27_1A_0301_2D5_spx_l2b-v20-2025-258.fits",
     "qr2/level2/2025W52_1A/l2b-v21-2025-363/5/level2_2025W52_1A_0361_2D5_spx_l2b-v21-2025-363.fits"),
    # Target 5
    ("Target 5", 120.0, 30.0, 1.0, "D1",
     "qr2/level2/2025W42_2A/l2b-v20-2025-293/1/level2_2025W42_2A_0601_3D1_spx_l2b-v20-2025-293.fits",
     "qr2/level2/2026W15_2A/l2b-v24-2026-105/1/level2_2026W15_2A_0748_3D1_spx_l2b-v24-2026-105.fits"),
    ("Target 5", 120.0, 30.0, 2.0, "D3",
     "qr2/level2/2025W43_1A/l2b-v20-2025-299/3/level2_2025W43_1A_0525_3D3_spx_l2b-v20-2025-299.fits",
     "qr2/level2/2026W14_2A/l2b-v24-2026-098/3/level2_2026W14_2A_0659_3D3_spx_l2b-v24-2026-098.fits"),
    ("Target 5", 120.0, 30.0, 4.0, "D5",
     "qr2/level2/2025W42_2A/l2b-v20-2025-293/5/level2_2025W42_2A_0684_4D5_spx_l2b-v20-2025-293.fits",
     "qr2/level2/2026W15_1A/l2b-v24-2026-104/5/level2_2026W15_1A_0138_4D5_spx_l2b-v24-2026-104.fits"),
]


def fetch_header_and_wcswave(s3_client, key: str) -> tuple[bytes, bytes, fits.Header, RegularGridInterpolator]:
    bucket = settings.spherex_s3_bucket
    r_head = s3_client.get_object(Bucket=bucket, Key=key, Range="bytes=0-31679")["Body"].read()
    r_tail = s3_client.get_object(Bucket=bucket, Key=key, Range="bytes=-11520")["Body"].read()

    idx_img = r_head.find(b"XTENSION= 'IMAGE   '")
    pos = idx_img
    hdr_end = min(len(r_head), idx_img + 2880 * 8)
    while pos < len(r_head):
        card = r_head[pos : pos + 80]
        pos += 80
        if card.startswith(b"END     "):
            hdr_end = ((pos + 2879) // 2880) * 2880
            break
    img_hdr = fits.Header.fromstring(r_head[idx_img:hdr_end].decode("ascii", errors="ignore"))

    idx_wave = r_tail.find(b"XTENSION= 'BINTABLE'")
    hdu_wave = fits.BinTableHDU.fromstring(r_tail[idx_wave : idx_wave + 2880 * 2])
    wave_table = hdu_wave.data
    x_knots = np.squeeze(wave_table["X"])
    y_knots = np.squeeze(wave_table["Y"])
    vals = np.squeeze(wave_table["VALUES"])
    wave_grid = vals[:, :, 0]
    interp = RegularGridInterpolator(
        (y_knots, x_knots), wave_grid, method="linear", bounds_error=False, fill_value=None
    )
    return r_head, r_tail, img_hdr, interp


def collect_item1_explain(s3_client) -> list[dict[str, Any]]:
    """Verify the exact code change that shifted cutout wavelength ranges by ~0.0004 um."""
    test_keys = [
        ("qr2/level2/2025W52_2A/l2b-v22-2026-006/1/level2_2025W52_2A_0107_1D1_spx_l2b-v22-2026-006.fits", 15.0, -20.0, 1.0),
        ("qr2/level2/2026W01_1A/l2b-v22-2026-007/1/level2_2026W01_1A_0005_1D1_spx_l2b-v22-2026-007.fits", 15.0, -20.0, 1.0),
    ]
    results = []
    for key, ra, dec, w0 in test_keys:
        r_head, r_tail, img_hdr_full, interp = fetch_header_and_wcswave(s3_client, key)
        idx_img = r_head.find(b"XTENSION= 'IMAGE   '")
        variants = {}
        for label, nbytes, clamp_max in [
            ("4_blocks_11520B (pre-fix: idx_img + 2880*4, clamp 2047)", 2880 * 4, 2047),
            ("5_blocks_14400B (idx_img + 2880*5, clamp 2039)", 2880 * 5, 2039),
            ("full_END_scan_20160B (post-fix: idx_img:hdr_end, clamp 2039)", len(img_hdr_full.tostring().encode("ascii")), 2039),
        ]:
            hdr_sub = fits.Header.fromstring(r_head[idx_img : idx_img + nbytes].decode("ascii", errors="ignore"))
            w = WCS(hdr_sub)
            half = 0.05
            cos_d = max(math.cos(math.radians(dec)), 0.01)
            corners = [
                (ra - half / cos_d, dec - half),
                (ra + half / cos_d, dec - half),
                (ra + half / cos_d, dec + half),
                (ra - half / cos_d, dec + half),
            ]
            pix = [w.world_to_pixel_values(cra, cdec) for cra, cdec in corners]
            xs = [float(p[0]) for p in pix]
            ys = [float(p[1]) for p in pix]
            x_min, x_max = max(0, int(min(xs))), min(clamp_max, int(max(xs)))
            y_min, y_max = max(0, int(min(ys))), min(clamp_max, int(max(ys)))
            gy, gx = np.meshgrid(np.linspace(y_min, y_max, 5), np.linspace(x_min, x_max, 5), indexing="ij")
            cw = interp((gy, gx))
            wmin, wmax = float(np.min(cw)), float(np.max(cw))
            wmid = 0.5 * (wmin + wmax)
            variants[label] = {
                "header_bytes_parsed": nbytes,
                "has_BP_ORDER": "BP_ORDER" in hdr_sub,
                "has_B_ORDER": "B_ORDER" in hdr_sub,
                "x_range": [x_min, x_max],
                "y_range": [y_min, y_max],
                "w_range": [round(wmin, 6), round(wmax, 6)],
                "w_mid": round(wmid, 6),
                "err_um": round(abs(wmid - w0), 6),
            }
        results.append({
            "filename": os.path.basename(key),
            "actual_image_header_bytes": len(img_hdr_full.tostring().encode("ascii")),
            "variants": variants,
        })
    return results


def collect_item2_and_item3(s3_client) -> dict[str, Any]:
    """Compute Wide Cutout (0.1, 0.25, 0.5 deg) across all 5 targets (Item 2) and Per-Pixel Mask on Target 1 (Item 3)."""
    unique_keys = sorted(list({p[5] for p in SELECTED_PAIRS} | {p[6] for p in SELECTED_PAIRS}))
    cache: dict[str, tuple[fits.Header, RegularGridInterpolator]] = {}

    def _load(k: str):
        _, _, hdr, interp = fetch_header_and_wcswave(s3_client, k)
        return k, hdr, interp

    with ThreadPoolExecutor(max_workers=15) as pool:
        for k, hdr, interp in pool.map(_load, unique_keys):
            cache[k] = (hdr, interp)

    wide_rows = []
    for tgt_id, ra, dec, w0, det, key1, key2 in SELECTED_PAIRS:
        hdr1, interp1 = cache[key1]
        hdr2, interp2 = cache[key2]
        wcs1 = WCS(hdr1)
        wcs2 = WCS(hdr2)
        nx1, ny1 = int(hdr1.get("NAXIS1", 2040)), int(hdr1.get("NAXIS2", 2040))
        nx2, ny2 = int(hdr2.get("NAXIS1", 2040)), int(hdr2.get("NAXIS2", 2040))

        for sz in (0.1, 0.25, 0.5):
            target_wcs, target_shape = build_target_wcs(ra, dec, sz)
            ty_grid, tx_grid = np.meshgrid(
                np.arange(target_shape[0], dtype=np.float64),
                np.arange(target_shape[1], dtype=np.float64),
                indexing="ij",
            )
            sky_ra, sky_dec = target_wcs.pixel_to_world_values(tx_grid, ty_grid)

            px1, py1 = wcs1.world_to_pixel_values(sky_ra, sky_dec)
            in_det1 = (px1 >= 0) & (px1 < nx1) & (py1 >= 0) & (py1 < ny1)
            wmap1 = np.full(target_shape, np.nan, dtype=np.float64)
            wmap1[in_det1] = interp1((py1[in_det1], px1[in_det1]))

            px2, py2 = wcs2.world_to_pixel_values(sky_ra, sky_dec)
            in_det2 = (px2 >= 0) & (px2 < nx2) & (py2 >= 0) & (py2 < ny2)
            wmap2 = np.full(target_shape, np.nan, dtype=np.float64)
            wmap2[in_det2] = interp2((py2[in_det2], px2[in_det2]))

            w1_min, w1_max = float(np.nanmin(wmap1)), float(np.nanmax(wmap1))
            w2_min, w2_max = float(np.nanmin(wmap2)), float(np.nanmax(wmap2))
            span1 = w1_max - w1_min
            span2 = w2_max - w2_min

            sh_min = max(w1_min, w2_min)
            sh_max = min(w1_max, w2_max)
            sh_span = max(0.0, sh_max - sh_min)

            valid1 = np.isfinite(wmap1)
            valid2 = np.isfinite(wmap2)
            in_sh1 = valid1 & (wmap1 >= sh_min) & (wmap1 <= sh_max)
            in_sh2 = valid2 & (wmap2 >= sh_min) & (wmap2 <= sh_max)
            in_sh_both = in_sh1 & in_sh2

            n_tot = int(target_shape[0] * target_shape[1])
            n_val1 = max(1, int(np.sum(valid1)))
            n_val2 = max(1, int(np.sum(valid2)))

            wide_rows.append({
                "target": tgt_id,
                "wavelength_um": w0,
                "detector": det,
                "size_deg": sz,
                "grid_shape": list(target_shape),
                "ep1_range_um": [round(w1_min, 4), round(w1_max, 4)],
                "ep1_span_um": round(span1, 4),
                "ep2_range_um": [round(w2_min, 4), round(w2_max, 4)],
                "ep2_span_um": round(span2, 4),
                "shared_range_um": [round(sh_min, 4), round(sh_max, 4)] if sh_span > 0 else None,
                "shared_span_um": round(sh_span, 4),
                "ep1_in_shared_frac": round(float(np.sum(in_sh1)) / n_val1, 4) if sh_span > 0 else 0.0,
                "ep2_in_shared_frac": round(float(np.sum(in_sh2)) / n_val2, 4) if sh_span > 0 else 0.0,
                "joint_sky_in_shared_frac": round(float(np.sum(in_sh_both)) / n_tot, 4) if sh_span > 0 else 0.0,
                "ep1_footprint_frac": round(float(np.sum(valid1)) / n_tot, 4),
                "ep2_footprint_frac": round(float(np.sum(valid2)) / n_tot, 4),
            })

    # Item 2 part B + Item 3:
    # Fetch the 6 Target 1 exposures ONCE at size_deg=0.5 in parallel (covers 0.1, 0.25, and 0.5 deg!),
    # prototype per-pixel shared-wavelength masking (Item 3) on Target 1 across 0.1, 0.25, 0.5 deg,
    # and measure 0.5 deg WebP tile sizes (native 293x293 vs 2x downsampled 147x147).
    t1_pairs = [p for p in SELECTED_PAIRS if p[0] == "Target 1"]
    t1_keys = sorted(list({p[5] for p in t1_pairs} | {p[6] for p in t1_pairs}))

    t1_cutouts: dict[str, dict[str, Any]] = {}
    for k in t1_keys:
        t1_cutouts[k] = fetch_ranged_cutout(k, 15.0, -20.0, size_deg=0.5, margin=8, s3_client=s3_client)
    print("  2b/4 Fetched 6 Target-1 0.5-deg cutouts via S3 row-strips...")

    # Build full-detector arrays once per Target 1 exposure (6 exposures total)
    t1_full_img: dict[str, np.ndarray] = {}
    t1_full_flg: dict[str, np.ndarray] = {}
    t1_full_wave: dict[str, np.ndarray] = {}
    for k in t1_keys:
        hdr_k, interp_k = cache[k]
        res_k = t1_cutouts[k]
        bb = res_k["bbox"]
        f_img = np.full((bb["ny"], bb["nx"]), np.nan, dtype=np.float32)
        f_img[bb["y0"] : bb["y1"], bb["x0"] : bb["x1"]] = res_k["image_cutout"]
        t1_full_img[k] = f_img

        f_flg = np.zeros((bb["ny"], bb["nx"]), dtype=np.uint32)
        f_flg[bb["y0"] : bb["y1"], bb["x0"] : bb["x1"]] = res_k["flags_cutout"]
        t1_full_flg[k] = f_flg

        ny_g, nx_g = np.meshgrid(
            np.arange(bb["y0"], bb["y1"], dtype=np.float64),
            np.arange(bb["x0"], bb["x1"], dtype=np.float64),
            indexing="ij",
        )
        f_wave = np.full((bb["ny"], bb["nx"]), np.nan, dtype=np.float64)
        f_wave[bb["y0"] : bb["y1"], bb["x0"] : bb["x1"]] = interp_k((ny_g, nx_g))
        t1_full_wave[k] = f_wave

    per_pixel_mask_rows = []
    webp_05deg_rows = []

    for sz in (0.1, 0.25, 0.5):
        target_wcs, target_shape = build_target_wcs(15.0, -20.0, sz)
        ty_grid, tx_grid = np.meshgrid(
            np.arange(target_shape[0], dtype=np.float64),
            np.arange(target_shape[1], dtype=np.float64),
            indexing="ij",
        )
        sky_ra, sky_dec = target_wcs.pixel_to_world_values(tx_grid, ty_grid)
        n_tot = int(target_shape[0] * target_shape[1])

        ep_reproj_bands: dict[int, dict[float, tuple[np.ndarray, np.ndarray]]] = {1: {}, 2: {}}

        for _, ra, dec, w0, det, key1, key2 in t1_pairs:
            hdr1, interp1 = cache[key1]
            hdr2, interp2 = cache[key2]
            wcs1 = WCS(hdr1)
            wcs2 = WCS(hdr2)
            b1 = t1_cutouts[key1]["bbox"]
            b2 = t1_cutouts[key2]["bbox"]

            # Map target grid pixels directly to detector coordinates using WCS
            px1, py1 = wcs1.world_to_pixel_values(sky_ra, sky_dec)
            in1 = (px1 >= 0) & (px1 < b1["nx"]) & (py1 >= 0) & (py1 < b1["ny"])
            w_t1 = np.full(target_shape, np.nan)
            w_t1[in1] = interp1((py1[in1], px1[in1]))

            px2, py2 = wcs2.world_to_pixel_values(sky_ra, sky_dec)
            in2 = (px2 >= 0) & (px2 < b2["nx"]) & (py2 >= 0) & (py2 < b2["ny"])
            w_t2 = np.full(target_shape, np.nan)
            w_t2[in2] = interp2((py2[in2], px2[in2]))

            sh_min = max(float(np.nanmin(w_t1)), float(np.nanmin(w_t2)))
            sh_max = min(float(np.nanmax(w_t1)), float(np.nanmax(w_t2)))

            w_nat1 = t1_full_wave[key1][b1["y0"] : b1["y1"], b1["x0"] : b1["x1"]]
            w_nat2 = t1_full_wave[key2][b2["y0"] : b2["y1"], b2["x0"] : b2["x1"]]
            m_base_1 = combine_masks(apply_flags_mask(t1_cutouts[key1]["flags_cutout"]), apply_airglow_mask(w_nat1))
            m_base_2 = combine_masks(apply_flags_mask(t1_cutouts[key2]["flags_cutout"]), apply_airglow_mask(w_nat2))

            f1 = t1_full_img[key1].copy()
            c1 = t1_cutouts[key1]["image_cutout"].copy()
            c1[m_base_1] = np.nan
            f1[b1["y0"] : b1["y1"], b1["x0"] : b1["x1"]] = c1

            f2 = t1_full_img[key2].copy()
            c2 = t1_cutouts[key2]["image_cutout"].copy()
            c2[m_base_2] = np.nan
            f2[b2["y0"] : b2["y1"], b2["x0"] : b2["x1"]] = c2

            rep1_base, _ = reproject_interp((f1, wcs1), target_wcs, shape_out=target_shape)
            rep2_base, _ = reproject_interp((f2, wcs2), target_wcs, shape_out=target_shape)

            # Prototype per-pixel shared wavelength mask using apply_shared_wavelength_mask
            sh_mask_1 = apply_shared_wavelength_mask(w_t1, sh_min, sh_max)
            sh_mask_2 = apply_shared_wavelength_mask(w_t2, sh_min, sh_max)
            rep1_sh = rep1_base.copy()
            rep1_sh[sh_mask_1] = np.nan
            rep2_sh = rep2_base.copy()
            rep2_sh[sh_mask_2] = np.nan

            v1_base = float(np.sum(np.isfinite(rep1_base))) / n_tot
            v2_base = float(np.sum(np.isfinite(rep2_base))) / n_tot
            v_joint_base = float(np.sum(np.isfinite(rep1_base) & np.isfinite(rep2_base))) / n_tot

            v1_sh = float(np.sum(np.isfinite(rep1_sh))) / n_tot
            v2_sh = float(np.sum(np.isfinite(rep2_sh))) / n_tot
            v_joint_sh = float(np.sum(np.isfinite(rep1_sh) & np.isfinite(rep2_sh))) / n_tot

            per_pixel_mask_rows.append({
                "size_deg": sz,
                "grid_shape": list(target_shape),
                "wavelength_um": w0,
                "detector": det,
                "shared_range_um": [round(sh_min, 4), round(sh_max, 4)],
                "ep1_valid_frac_before": round(v1_base, 4),
                "ep2_valid_frac_before": round(v2_base, 4),
                "joint_valid_frac_before": round(v_joint_base, 4),
                "ep1_valid_frac_after_shared_mask": round(v1_sh, 4),
                "ep2_valid_frac_after_shared_mask": round(v2_sh, 4),
                "joint_valid_frac_after_shared_mask": round(v_joint_sh, 4),
            })

            if sz == 0.5:
                ep_reproj_bands[1][w0] = (rep1_base, ~np.isfinite(rep1_base))
                ep_reproj_bands[2][w0] = (rep2_base, ~np.isfinite(rep2_base))

        if sz == 0.5:
            # Measure WebP KB at native 293x293 (1x) and 2x downsampled 147x147
            for ep in (1, 2):
                for w0 in (1.0, 2.0, 4.0):
                    img_arr, m_arr = ep_reproj_bands[ep][w0]
                    webp_full = render_tile_image(img_arr, m_arr, fmt="webp", quality=85)
                    img_ds2 = img_arr[::2, ::2]
                    m_ds2 = m_arr[::2, ::2]
                    webp_ds2 = render_tile_image(img_ds2, m_ds2, fmt="webp", quality=85)
                    webp_05deg_rows.append({
                        "epoch": ep,
                        "tile": f"{ep}_{w0:.1f}um.webp",
                        "native_shape": list(img_arr.shape),
                        "native_webp_kb": round(len(webp_full) / 1024.0, 2),
                        "downsampled_2x_shape": list(img_ds2.shape),
                        "downsampled_2x_webp_kb": round(len(webp_ds2) / 1024.0, 2),
                    })
                # Also RGB composite at 0.5 deg
                rgb_stack = np.stack([
                    ep_reproj_bands[ep][4.0][0],
                    ep_reproj_bands[ep][2.0][0],
                    ep_reproj_bands[ep][1.0][0],
                ], axis=0)
                rgb_mask = (
                    ep_reproj_bands[ep][4.0][1]
                    | ep_reproj_bands[ep][2.0][1]
                    | ep_reproj_bands[ep][1.0][1]
                )
                webp_rgb_full = render_tile_image(rgb_stack, rgb_mask, fmt="webp", quality=85)
                webp_rgb_ds2 = render_tile_image(rgb_stack[:, ::2, ::2], rgb_mask[::2, ::2], fmt="webp", quality=85)
                webp_05deg_rows.append({
                    "epoch": ep,
                    "tile": f"{ep}_rgb.webp",
                    "native_shape": list(rgb_mask.shape),
                    "native_webp_kb": round(len(webp_rgb_full) / 1024.0, 2),
                    "downsampled_2x_shape": list(rgb_mask[::2, ::2].shape),
                    "downsampled_2x_webp_kb": round(len(webp_rgb_ds2) / 1024.0, 2),
                })

    return {
        "wide_rows": wide_rows,
        "per_pixel_mask_rows": per_pixel_mask_rows,
        "webp_05deg_rows": webp_05deg_rows,
    }


def collect_item4_intra_epoch_rungs(s3_client) -> list[dict[str, Any]]:
    """Rerun intra-epoch pair counts for tolerances 0.02 / 0.05 / 0.1 / 0.2 um with NO fixed 1/2/4 um centres."""
    from worker.sources.irsa import fetch_cutout_wavelength_range

    all_inspected_by_tgt: dict[str, list[dict[str, Any]]] = {}

    for tgt in TARGETS:
        ra, dec = tgt["ra"], tgt["dec"]
        req_detectors = ["SPHEREx-D1", "SPHEREx-D3", "SPHEREx-D5"]
        det_list_sql = ", ".join(f"'{d}'" for d in req_detectors)
        query = f"""
        SELECT a.uri, p.energy_bandpassname, p.time_bounds_lower, p.poly, p.energy_resolvingpower
        FROM spherex.artifact a
        JOIN spherex.plane p ON a.planeid = p.planeid
        WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly)
          AND p.energy_bandpassname IN ({det_list_sql})
        ORDER BY p.time_bounds_lower
        """.strip()
        params = urllib.parse.urlencode({"QUERY": query, "REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "json"})
        url = f"https://irsa.ipac.caltech.edu/TAP/sync?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "AstroBlink-Worker/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        rows = data["VOTABLE"]["RESOURCE_ARRAY"][0]["TABLE"]["DATA"]["TABLEDATA"]
        raw_items = []
        for r in rows:
            uri, bandpass, mjd_str, poly_hex, r_str = r[0], r[1], r[2], r[3], r[4]
            s3_key = uri[len("ibe/data/spherex/") :] if uri.startswith("ibe/data/spherex/") else uri
            verts = parse_poly_wkb(poly_hex) if poly_hex else []
            cov = cutout_coverage_fraction(ra, dec, verts, size_deg=0.1) if verts else 1.0
            if cov < settings.min_cutout_coverage:
                continue
            raw_items.append({
                "s3_key": s3_key,
                "filename": os.path.basename(s3_key),
                "bandpass": bandpass,
                "detector": bandpass.replace("SPHEREx-", ""),
                "mjd": float(mjd_str),
            })
        clusters = cluster_exposures_into_epochs(raw_items, gap_days=settings.survey_epoch_gap_days)
        to_inspect = []
        for ep in (1, 2):
            if ep not in clusters:
                continue
            by_det = defaultdict(list)
            for it in clusters[ep]:
                by_det[it["bandpass"]].append(it)
            for det, d_list in by_det.items():
                d_sorted = sorted(d_list, key=lambda x: (x["mjd"], x["s3_key"]))
                if tgt["is_cvz"] and len(d_sorted) > 30:
                    idx = np.linspace(0, len(d_sorted) - 1, 30, dtype=int)
                    sampled = [d_sorted[i] for i in dict.fromkeys(idx)]
                else:
                    sampled = d_sorted
                to_inspect.extend(sampled)

        def _insp(it):
            w_res = fetch_cutout_wavelength_range(
                s3_client, settings.spherex_s3_bucket, it["s3_key"], ra, dec, size_deg=0.1
            )
            if w_res is None:
                return None
            it["w_min"], it["w_max"], it["w_mid"] = w_res
            return it

        with ThreadPoolExecutor(max_workers=25) as pool:
            all_inspected_by_tgt[tgt["id"]] = [r for r in pool.map(_insp, to_inspect) if r is not None]
        print(f"  3/4 Inspected {len(all_inspected_by_tgt[tgt['id']])} exposures for {tgt['id']}...")

    rung_rows = []
    for tol_um in (0.02, 0.05, 0.10, 0.20):
        all_dts_for_tol = []
        for tgt in TARGETS:
            tid = tgt["id"]
            items = all_inspected_by_tgt[tid]
            by_ep_det = defaultdict(list)
            for it in items:
                by_ep_det[(it["epoch"], it["detector"])].append(it)

            tgt_dts = []
            for (ep, det), group in sorted(by_ep_det.items()):
                g_sorted = sorted(group, key=lambda x: (x["mjd"], x["s3_key"]))
                for i in range(len(g_sorted)):
                    for j in range(i + 1, len(g_sorted)):
                        if abs(g_sorted[i]["w_mid"] - g_sorted[j]["w_mid"]) <= tol_um:
                            dt = abs(g_sorted[j]["mjd"] - g_sorted[i]["mjd"])
                            tgt_dts.append(dt)
                            all_dts_for_tol.append(dt)

            rung_rows.append({
                "tolerance_um": tol_um,
                "target": tid,
                "n_pairs": len(tgt_dts),
                "dt_min": round(min(tgt_dts), 4) if tgt_dts else None,
                "dt_median": round(statistics.median(tgt_dts), 4) if tgt_dts else None,
                "dt_max": round(max(tgt_dts), 4) if tgt_dts else None,
                "count_lt_02d": sum(1 for d in tgt_dts if d < 0.2),
                "count_02_to_1d": sum(1 for d in tgt_dts if 0.2 <= d < 1.0),
                "count_1_to_5d": sum(1 for d in tgt_dts if 1.0 <= d < 5.0),
                "count_5_to_30d": sum(1 for d in tgt_dts if 5.0 <= d <= 30.0),
                "count_gt_30d": sum(1 for d in tgt_dts if d > 30.0),
            })

        rung_rows.append({
            "tolerance_um": tol_um,
            "target": "ALL 5 TARGETS TOTAL",
            "n_pairs": len(all_dts_for_tol),
            "dt_min": round(min(all_dts_for_tol), 4) if all_dts_for_tol else None,
            "dt_median": round(statistics.median(all_dts_for_tol), 4) if all_dts_for_tol else None,
            "dt_max": round(max(all_dts_for_tol), 4) if all_dts_for_tol else None,
            "count_lt_02d": sum(1 for d in all_dts_for_tol if d < 0.2),
            "count_02_to_1d": sum(1 for d in all_dts_for_tol if 0.2 <= d < 1.0),
            "count_1_to_5d": sum(1 for d in all_dts_for_tol if 1.0 <= d < 5.0),
            "count_5_to_30d": sum(1 for d in all_dts_for_tol if 5.0 <= d <= 30.0),
            "count_gt_30d": sum(1 for d in all_dts_for_tol if d > 30.0),
        })

    return rung_rows


def collect_item5_flags_clustering(s3_client) -> dict[str, Any]:
    """Analyze clustering of the 494 Bit-0 pixels on Target 1, Epoch 2, 1.0 um and prototype flagged-but-visible."""
    key = "qr2/level2/2025W52_2A/l2b-v22-2026-006/1/level2_2025W52_2A_0107_1D1_spx_l2b-v22-2026-006.fits"
    res = fetch_ranged_cutout(key, 15.0, -20.0, size_deg=0.1, margin=8, s3_client=s3_client)
    flg = res["flags_cutout"]
    img = res["image_cutout"]
    hdr = res["image_header"]
    bbox = res["bbox"]

    overlays = extract_transient_outlier_overlay(flg)
    bit0 = overlays["bit0_mask"]
    bit19 = overlays["bit19_mask"]
    comb = overlays["overlay_mask"]

    def _analyze_mask(mask_bool: np.ndarray, img_arr: np.ndarray, name: str) -> dict[str, Any]:
        # 8-connectivity structure
        struct8 = np.ones((3, 3), dtype=int)
        labeled8, n_comp8 = ndimage_label(mask_bool, structure=struct8)
        labeled4, n_comp4 = ndimage_label(mask_bool)
        sizes8 = sorted(
            [int(np.sum(labeled8 == c)) for c in range(1, n_comp8 + 1)],
            reverse=True,
        )
        sizes4 = sorted(
            [int(np.sum(labeled4 == c)) for c in range(1, n_comp4 + 1)],
            reverse=True,
        )
        # Find bounding boxes and flux stats of top 5 8-connected clusters
        top_clusters = []
        for comp_id in range(1, n_comp8 + 1):
            ys, xs = np.where(labeled8 == comp_id)
            cnt = len(ys)
            top_clusters.append({
                "size_px": int(cnt),
                "bbox_y": [int(np.min(ys)), int(np.max(ys))],
                "bbox_x": [int(np.min(xs)), int(np.max(xs))],
                "span_yx": [int(np.max(ys) - np.min(ys) + 1), int(np.max(xs) - np.min(xs) + 1)],
                "max_flux_mjy_sr": round(float(np.nanmax(img_arr[ys, xs])), 2),
                "median_flux_mjy_sr": round(float(np.nanmedian(img_arr[ys, xs])), 2),
            })
        top_clusters.sort(key=lambda x: x["size_px"], reverse=True)

        pts = np.column_stack(np.where(mask_bool))
        if len(pts) >= 2:
            tree = cKDTree(pts)
            dists, _ = tree.query(pts, k=2)
            nn_dists = dists[:, 1]
            nn_med = round(float(np.median(nn_dists)), 3)
            nn_mean = round(float(np.mean(nn_dists)), 3)
            nn_le_sqrt2_frac = round(float(np.mean(nn_dists <= 1.42)), 4)
        else:
            nn_med, nn_mean, nn_le_sqrt2_frac = 0.0, 0.0, 0.0

        total_px = int(np.sum(mask_bool))
        return {
            "name": name,
            "total_flagged_px": total_px,
            "n_components_8conn": int(n_comp8),
            "n_components_4conn": int(n_comp4),
            "singletons_8conn": sum(1 for s in sizes8 if s == 1),
            "px_in_clusters_ge_5px": sum(s for s in sizes8 if s >= 5),
            "frac_in_clusters_ge_5px": round(sum(s for s in sizes8 if s >= 5) / max(1, total_px), 4),
            "px_in_largest_cluster": sizes8[0] if sizes8 else 0,
            "frac_in_largest_cluster": round((sizes8[0] if sizes8 else 0) / max(1, total_px), 4),
            "top_10_cluster_sizes_8conn": sizes8[:10],
            "top_5_clusters_detail": top_clusters[:5],
            "nn_dist_median_px": nn_med,
            "nn_dist_mean_px": nn_mean,
            "frac_with_8conn_neighbor": nn_le_sqrt2_frac,
        }

    # Also render prototype "flagged but visible" tile on Target 1, Epoch 2, 1.0 um
    target_wcs, target_shape = build_target_wcs(15.0, -20.0, 0.1)
    defect_mask_no_0_19 = apply_flags_mask(flg, mask_transient_and_outlier=False)

    full_img = np.full((bbox["ny"], bbox["nx"]), np.nan, dtype=np.float32)
    arr_kept = img.copy()
    arr_kept[defect_mask_no_0_19] = np.nan
    full_img[bbox["y0"] : bbox["y1"], bbox["x0"] : bbox["x1"]] = arr_kept
    reproj_img, _ = reproject_interp((full_img, WCS(hdr)), target_wcs, shape_out=target_shape)

    full_ov = np.zeros((bbox["ny"], bbox["nx"]), dtype=np.float32)
    full_ov[bbox["y0"] : bbox["y1"], bbox["x0"] : bbox["x1"]] = comb.astype(np.float32)
    reproj_ov, _ = reproject_interp((full_ov, WCS(hdr)), target_wcs, shape_out=target_shape)
    reproj_ov_mask = np.isfinite(reproj_ov) & (reproj_ov >= 0.25)

    reproj_defect_mask = ~np.isfinite(reproj_img)
    webp_flagged_vis = render_tile_image(
        reproj_img,
        reproj_defect_mask,
        fmt="webp",
        quality=85,
        flagged_visible_mask=reproj_ov_mask,
    )

    # Check whether stationary stars in Target 1 Epoch 1 (2025W25_1B_0173_4D1) also have Bit 19 / Bit 0 set
    res_ep1 = fetch_ranged_cutout(
        "qr2/level2/2025W25_1B/l2b-v20-2025-253/1/level2_2025W25_1B_0173_4D1_spx_l2b-v20-2025-253.fits",
        15.0,
        -20.0,
        size_deg=0.1,
        margin=8,
        s3_client=s3_client,
    )
    ov_ep1 = extract_transient_outlier_overlay(res_ep1["flags_cutout"])
    img_ep1 = res_ep1["image_cutout"]

    return {
        "file": os.path.basename(key),
        "cutout_shape": list(flg.shape),
        "bit0_analysis": _analyze_mask(bit0, img, "Bit 0 (MP_TRANSIENT)"),
        "bit19_analysis": _analyze_mask(bit19, img, "Bit 19 (MP_OUTLIER)"),
        "combined_0_19_analysis": _analyze_mask(comb, img, "Bit 0 | Bit 19"),
        "ep1_bit0_analysis": _analyze_mask(ov_ep1["bit0_mask"], img_ep1, "Ep1 Bit 0 (MP_TRANSIENT)"),
        "ep1_bit19_analysis": _analyze_mask(ov_ep1["bit19_mask"], img_ep1, "Ep1 Bit 19 (MP_OUTLIER)"),
        "prototype_tile": {
            "tile_shape": list(target_shape),
            "valid_science_px": int(np.sum(~reproj_defect_mask)),
            "flagged_visible_overlay_px": int(np.sum(reproj_ov_mask & (~reproj_defect_mask))),
            "hatched_defect_px": int(np.sum(reproj_defect_mask)),
            "webp_bytes": len(webp_flagged_vis),
            "webp_kb": round(len(webp_flagged_vis) / 1024.0, 2),
        },
    }


def render_all_markdown(data: dict[str, Any]) -> str:
    lines: list[str] = []

    # Item 1
    lines.append("### Item 1: Proof of Why Cutout Wavelength Ranges Shifted by `~0.0004 µm`")
    lines.append("")
    lines.append("| Exposure Filename | Header Slice Variant | Header Bytes Parsed | `B_ORDER` / `BP_ORDER` Present? | Cutout Pixel Box `[x0..x1], [y0..y1]` | Cutout Wavelength Range `[w_min, w_max]` ($\\mu\\text{m}$) | Midpoint $w_{\\text{mid}}$ ($\\mu\\text{m}$) | Error $|w_{\\text{mid}} - 1.0|$ ($\\mu\\text{m}$) |")
    lines.append("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |")
    for item in data["item1"]:
        fn = item["filename"]
        for vname, v in item["variants"].items():
            lines.append(
                f"| `{fn}` | `{vname}` | `{v['header_bytes_parsed']}` | `{v['has_B_ORDER']} / {v['has_BP_ORDER']}` | "
                f"`x={v['x_range']}, y={v['y_range']}` | `[{v['w_range'][0]:.5f}, {v['w_range'][1]:.5f}]` | "
                f"`{v['w_mid']:.6f}` | **`{v['err_um']:.6f}`** |"
            )

    # Item 2A
    lines.append("")
    lines.append("### Item 2A: Wide Cutout (`size_deg = 0.1°, 0.25°, 0.5°`) Wavelength Span & Shared-Range Pixel Fractions Across All 5 Targets")
    lines.append("")
    lines.append("| Target | $\\lambda_0$ ($\\mu\\text{m}$) | Det | `size_deg` | Grid `(H, W)` | Ep1 Range & Span $\\Delta\\lambda_1$ ($\\mu\\text{m}$) | Ep2 Range & Span $\\Delta\\lambda_2$ ($\\mu\\text{m}$) | Shared Range & Width $\\Delta\\lambda_{\\text{sh}}$ ($\\mu\\text{m}$) | Ep1 px in Shared | Ep2 px in Shared | **Joint Sky px in Shared** |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for r in data["item2_3"]["wide_rows"]:
        sh_str = f"`[{r['shared_range_um'][0]:.4f}, {r['shared_range_um'][1]:.4f}]` (`{r['shared_span_um']:.4f}`)" if r["shared_range_um"] else "None (`0.0000`)"
        lines.append(
            f"| {r['target']} | `{r['wavelength_um']:.1f}` | `{r['detector']}` | `{r['size_deg']:.2f}°` | `{r['grid_shape'][0]}x{r['grid_shape'][1]}` | "
            f"`[{r['ep1_range_um'][0]:.4f}, {r['ep1_range_um'][1]:.4f}]` (**`{r['ep1_span_um']:.4f}`**) | "
            f"`[{r['ep2_range_um'][0]:.4f}, {r['ep2_range_um'][1]:.4f}]` (**`{r['ep2_span_um']:.4f}`**) | "
            f"{sh_str} | `{100*r['ep1_in_shared_frac']:.1f}%` | `{100*r['ep2_in_shared_frac']:.1f}%` | **`{100*r['joint_sky_in_shared_frac']:.1f}%`** |"
        )

    # Item 2B
    lines.append("")
    lines.append("### Item 2B: `0.5° × 0.5°` Cutout Tile Dimensions & WebP File Sizes (`Target 1`, Budget `< 250 KB`)")
    lines.append("")
    lines.append("| Epoch | Tile Name | Native `1×` Grid (`6.15\"/px`) | Native `1×` WebP Size (KB) | Downsampled `2×` Grid (`12.30\"/px`) | Downsampled `2×` WebP Size (KB) |")
    lines.append("| :---: | :--- | :---: | :---: | :---: | :---: |")
    for w in data["item2_3"]["webp_05deg_rows"]:
        lines.append(
            f"| {w['epoch']} | `{w['tile']}` | `{w['native_shape'][0]}x{w['native_shape'][1]}` | **`{w['native_webp_kb']:.2f} KB`** | "
            f"`{w['downsampled_2x_shape'][0]}x{w['downsampled_2x_shape'][1]}` | **`{w['downsampled_2x_webp_kb']:.2f} KB`** |"
        )

    # Item 3
    lines.append("")
    lines.append("### Item 3: Prototype Per-Pixel Shared-Wavelength Masking on `Target 1` (`size_deg = 0.1°, 0.25°, 0.5°`)")
    lines.append("")
    lines.append("| `size_deg` | Grid `(H, W)` | $\\lambda_0$ ($\\mu\\text{m}$) | Det | Shared Range ($\\mu\\text{m}$) | Ep1 Valid Before $\\to$ After | Ep2 Valid Before $\\to$ After | **Joint `(Ep1 ∩ Ep2)` Valid Before $\\to$ After** |")
    lines.append("| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for m in data["item2_3"]["per_pixel_mask_rows"]:
        lines.append(
            f"| `{m['size_deg']:.2f}°` | `{m['grid_shape'][0]}x{m['grid_shape'][1]}` | `{m['wavelength_um']:.1f}` | `{m['detector']}` | "
            f"`[{m['shared_range_um'][0]:.4f}, {m['shared_range_um'][1]:.4f}]` | "
            f"`{100*m['ep1_valid_frac_before']:.1f}%` $\\to$ **`{100*m['ep1_valid_frac_after_shared_mask']:.1f}%`** | "
            f"`{100*m['ep2_valid_frac_before']:.1f}%` $\\to$ **`{100*m['ep2_valid_frac_after_shared_mask']:.1f}%`** | "
            f"`{100*m['joint_valid_frac_before']:.1f}%` $\\to$ **`{100*m['joint_valid_frac_after_shared_mask']:.1f}%`** |"
        )

    # Item 4
    lines.append("")
    lines.append("### Item 4: Intra-Epoch Pairs Without Fixed `1/2/4 µm` Centres Across Tolerance Rungs (`0.02 / 0.05 / 0.10 / 0.20 µm`)")
    lines.append("")
    lines.append("| Tolerance ($\\mu\\text{m}$) | Target | Total Same-Epoch Pairs | $\\Delta t_{\\min}$ (d) | $\\Delta t_{\\text{med}}$ (d) | $\\Delta t_{\\max}$ (d) | `< 0.2 d` | **`0.2–1 d`** | **`1–5 d`** | **`5–30 d`** | `> 30 d` |")
    lines.append("| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for r in data["item4"]:
        dmin = f"{r['dt_min']:.4f}" if r["dt_min"] is not None else "—"
        dmed = f"{r['dt_median']:.4f}" if r["dt_median"] is not None else "—"
        dmax = f"{r['dt_max']:.4f}" if r["dt_max"] is not None else "—"
        lines.append(
            f"| **`{r['tolerance_um']:.2f}`** | {r['target']} | **{r['n_pairs']}** | `{dmin}` | `{dmed}` | `{dmax}` | "
            f"{r['count_lt_02d']} | **{r['count_02_to_1d']}** | **{r['count_1_to_5d']}** | **{r['count_5_to_30d']}** | {r['count_gt_30d']} |"
        )

    # Item 5
    lines.append("")
    lines.append("### Item 5A: Spatial Clustering Analysis of Bit 0 (`MP_TRANSIENT`) & Bit 19 (`MP_OUTLIER`) on `Target 1`, Epoch 2, `1.0 µm`")
    lines.append("")
    lines.append("| Mask Layer | Flagged Pixels | 8-Conn Components | 4-Conn Components | Isolated 1-px Singletons | Pixels in Clusters $\\ge 5$ px | Largest Cluster Size (px & % of Flagged) | Median Nearest-Neighbor Dist (px) | Fraction With 8-Conn Neighbor |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for k in ("bit0_analysis", "bit19_analysis", "combined_0_19_analysis", "ep1_bit0_analysis", "ep1_bit19_analysis"):
        a = data["item5"][k]
        lines.append(
            f"| {a['name']} | **`{a['total_flagged_px']}`** | `{a['n_components_8conn']}` | `{a['n_components_4conn']}` | "
            f"`{a['singletons_8conn']}` | `{a['px_in_clusters_ge_5px']}` (`{100*a['frac_in_clusters_ge_5px']:.1f}%`) | "
            f"**`{a['px_in_largest_cluster']} px` (`{100*a['frac_in_largest_cluster']:.1f}%`)** | `{a['nn_dist_median_px']:.2f}` | `{100*a['frac_with_8conn_neighbor']:.1f}%` |"
        )

    lines.append("")
    lines.append("### Item 5B: Top 5 Connected Clusters of Bit 0 (`MP_TRANSIENT`, 494 px) in `level2_2025W52_2A_0107_1D1_spx_l2b-v22-2026-006.fits`")
    lines.append("")
    lines.append("| Cluster Rank | Size (px) | Cutout Row Box `[y0, y1]` | Cutout Col Box `[x0, x1]` | Span `(dy, dx)` | Max Flux (`MJy/sr`) | Median Flux (`MJy/sr`) |")
    lines.append("| :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for idx, c in enumerate(data["item5"]["bit0_analysis"]["top_5_clusters_detail"], 1):
        lines.append(
            f"| {idx} | **`{c['size_px']}`** | `{c['bbox_y']}` | `{c['bbox_x']}` | `{c['span_yx'][0]}x{c['span_yx'][1]}` | "
            f"`{c['max_flux_mjy_sr']:.2f}` | `{c['median_flux_mjy_sr']:.2f}` |"
        )

    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    s3_client = get_spherex_s3_client(connect_timeout=10, read_timeout=30, max_retries=4, max_pool_connections=100)
    print("1/4 Running Item 1 (Explain ~0.0004 um wavelength shift)...")
    item1 = collect_item1_explain(s3_client)
    print("2/4 Running Item 2 (Wide Cutout 0.1 / 0.25 / 0.5 deg) & Item 3 (Per-pixel shared wavelength mask)...")
    item2_3 = collect_item2_and_item3(s3_client)
    print("3/4 Running Item 4 (Intra-epoch pairs across tolerance rungs 0.02 / 0.05 / 0.1 / 0.2 um)...")
    item4 = collect_item4_intra_epoch_rungs(s3_client)
    print("4/4 Running Item 5 (FLAGS Bit 0 / 19 clustering & flagged-but-visible prototype)...")
    item5 = collect_item5_flags_clustering(s3_client)

    payload = {
        "item1": item1,
        "item2_3": item2_3,
        "item4": item4,
        "item5": item5,
    }
    json_path = "/scratch/w11b_new_items.json"
    md_path = "/scratch/w11b_new_items_tables.md"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    md_text = render_all_markdown(payload)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_text)
    print(f"Done! Wrote {json_path} and {md_path}.")
