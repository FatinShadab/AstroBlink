"""Compute and verify W11b final items 1, 2, 3 programmatically and render tables."""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import json
import math
import os
import re
import statistics
import urllib.parse
import urllib.request
from typing import Any

from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
import numpy as np

from worker.config import settings
from worker.sources.irsa import (
    cluster_exposures_into_epochs,
    cutout_coverage_fraction,
    detector_for_wavelength,
    fetch_cutout_wavelength_range,
    parse_poly_wkb,
)
from worker.sources.s3 import get_spherex_s3_client

TARGETS = [
    {"id": "Target 1", "ra": 15.0, "dec": -20.0, "is_cvz": False},
    {"id": "Target 2 (CVZ)", "ra": 269.5, "dec": 66.5, "is_cvz": True},
    {"id": "Target 3", "ra": 180.0, "dec": 0.0, "is_cvz": False},
    {"id": "Target 4", "ra": 45.0, "dec": -45.0, "is_cvz": False},
    {"id": "Target 5", "ra": 120.0, "dec": 30.0, "is_cvz": False},
]

TARGET_WAVES = [1.0, 2.0, 4.0]
SIZE_DEG = 0.1


def fetch_all_target_candidates(s3_client):
    """Fetch TAP candidates for all 5 targets and inspect WCS-WAVE ranges."""
    print("Fetching candidate exposures from IRSA TAP across 5 targets...")
    all_target_data = {}

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
            fname = os.path.basename(s3_key)
            # Parse observation pointing ID (week + pointing_num)
            m_pt = re.search(r"level2_([^_]+_[^_]+)_([^_]+)_(\d)D(\d)", fname)
            pt_id = f"{m_pt.group(1)}_{m_pt.group(2)}" if m_pt else fname
            raw_items.append({
                "s3_key": s3_key,
                "filename": fname,
                "bandpass": bandpass,
                "detector": bandpass.replace("SPHEREx-", ""),
                "mjd": float(mjd_str),
                "pointing_id": pt_id,
                "resolving_power": float(r_str) if r_str else 40.0,
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
            it["date_utc"] = Time(it["mjd"], format="mjd", scale="utc").isot[:19] + "Z"
            return it

        with ThreadPoolExecutor(max_workers=25) as pool:
            inspected = [r for r in pool.map(_insp, to_inspect) if r is not None]
        print(f"  Target '{tgt['id']}': {len(inspected)} exposures inspected.")
        all_target_data[tgt["id"]] = inspected

    return all_target_data


def compute_item1_intra_epoch_pairs(all_target_data):
    """
    Rerun item 4 with:
    - same epoch, same detector
    - SHARED WAVELENGTH OVERLAP >= 0.01 um (not just mid-wavelength within tolerance)
    - dt >= 0.2 d
    - Rungs 0.02 / 0.05 / 0.10 um for mid-wavelength tolerance
    - Exclude Target 2 (CVZ) pairs with dt > 30 d
    - Report counts per target in bins 0.2-1, 1-5, 5-30 d
    - State how many pairs would be at the same sky pointing (dither/detector duplicates) and drop them.
    """
    rung_summary = []
    dropped_pointing_stats = []

    for tol_um in (0.02, 0.05, 0.10):
        all_dts_for_tol = []
        for tgt in TARGETS:
            tid = tgt["id"]
            items = all_target_data[tid]
            by_ep_det = defaultdict(list)
            for it in items:
                by_ep_det[(it["epoch"], it["detector"])].append(it)

            valid_pairs = []
            same_pt_pairs_count = 0
            sub_02d_pairs_count = 0
            cvz_gt30d_dropped = 0
            overlap_lt001_dropped = 0

            for (ep, det), group in sorted(by_ep_det.items()):
                g_sorted = sorted(group, key=lambda x: (x["mjd"], x["s3_key"]))
                for i in range(len(g_sorted)):
                    for j in range(i + 1, len(g_sorted)):
                        c1, c2 = g_sorted[i], g_sorted[j]
                        # 1. Mid-wavelength tolerance check
                        if abs(c1["w_mid"] - c2["w_mid"]) > tol_um:
                            continue

                        # 2. Shared wavelength overlap check >= 0.01 um
                        sh_min = max(c1["w_min"], c2["w_min"])
                        sh_max = min(c1["w_max"], c2["w_max"])
                        sh_ov = max(0.0, sh_max - sh_min)
                        if sh_ov < 0.01:
                            overlap_lt001_dropped += 1
                            continue

                        # 3. Same sky pointing check (dither duplicates: same pointing_id or dt < 0.005 d / ~7 min)
                        is_same_pointing = (c1["pointing_id"] == c2["pointing_id"])
                        if is_same_pointing:
                            same_pt_pairs_count += 1
                            continue

                        dt = abs(c2["mjd"] - c1["mjd"])

                        # 4. dt >= 0.2 d requirement
                        if dt < 0.2:
                            sub_02d_pairs_count += 1
                            continue

                        # 5. Exclude Target 2 (CVZ) pairs with dt > 30 d
                        if tgt["is_cvz"] and dt > 30.0:
                            cvz_gt30d_dropped += 1
                            continue

                        valid_pairs.append({
                            "target": tid,
                            "epoch": ep,
                            "detector": det,
                            "c1": c1["filename"],
                            "c2": c2["filename"],
                            "dt": dt,
                            "overlap_um": sh_ov,
                        })
                        all_dts_for_tol.append(dt)

            dts = [p["dt"] for p in valid_pairs]
            rung_summary.append({
                "tolerance_um": tol_um,
                "target": tid,
                "n_valid_pairs": len(valid_pairs),
                "dt_min": round(min(dts), 4) if dts else None,
                "dt_median": round(statistics.median(dts), 4) if dts else None,
                "dt_max": round(max(dts), 4) if dts else None,
                "count_02_to_1d": sum(1 for d in dts if 0.2 <= d < 1.0),
                "count_1_to_5d": sum(1 for d in dts if 1.0 <= d < 5.0),
                "count_5_to_30d": sum(1 for d in dts if 5.0 <= d <= 30.0),
                "same_pointing_dropped": same_pt_pairs_count,
                "sub_02d_dropped": sub_02d_pairs_count,
                "cvz_gt30d_dropped": cvz_gt30d_dropped,
                "overlap_lt001_dropped": overlap_lt001_dropped,
            })

        # Add total row
        rung_summary.append({
            "tolerance_um": tol_um,
            "target": "ALL 5 TARGETS TOTAL",
            "n_valid_pairs": len(all_dts_for_tol),
            "dt_min": round(min(all_dts_for_tol), 4) if all_dts_for_tol else None,
            "dt_median": round(statistics.median(all_dts_for_tol), 4) if all_dts_for_tol else None,
            "dt_max": round(max(all_dts_for_tol), 4) if all_dts_for_tol else None,
            "count_02_to_1d": sum(1 for d in all_dts_for_tol if 0.2 <= d < 1.0),
            "count_1_to_5d": sum(1 for d in all_dts_for_tol if 1.0 <= d < 5.0),
            "count_5_to_30d": sum(1 for d in all_dts_for_tol if 5.0 <= d <= 30.0),
            "same_pointing_dropped": sum(r["same_pointing_dropped"] for r in rung_summary if r["tolerance_um"] == tol_um and r["target"] != "ALL 5 TARGETS TOTAL"),
            "sub_02d_dropped": sum(r["sub_02d_dropped"] for r in rung_summary if r["tolerance_um"] == tol_um and r["target"] != "ALL 5 TARGETS TOTAL"),
            "cvz_gt30d_dropped": sum(r["cvz_gt30d_dropped"] for r in rung_summary if r["tolerance_um"] == tol_um and r["target"] != "ALL 5 TARGETS TOTAL"),
            "overlap_lt001_dropped": sum(r["overlap_lt001_dropped"] for r in rung_summary if r["tolerance_um"] == tol_um and r["target"] != "ALL 5 TARGETS TOTAL"),
        })

    return rung_summary


def compute_item2_selection_comparison(all_target_data):
    """
    Rerun stored selection results (matched pairs per target/wavelength) using the fixed header parsing,
    and compare against the previously stored report results.
    """
    # The 15 previously stored selections reported in previous sessions
    prev_selections = [
        {"target": "Target 1", "wavelength_um": 1.0, "ep1_file": "level2_2025W25_1B_0173_4D1_spx_l2b-v20-2025-253.fits", "ep2_file": "level2_2025W52_2A_0107_1D1_spx_l2b-v22-2026-006.fits"},
        {"target": "Target 1", "wavelength_um": 2.0, "ep1_file": "level2_2025W27_2A_0373_1D3_spx_l2b-v20-2025-259.fits", "ep2_file": "level2_2025W51_1A_0732_1D3_spx_l2b-v21-2025-354.fits"},
        {"target": "Target 1", "wavelength_um": 4.0, "ep1_file": "level2_2025W27_1A_0157_3D5_spx_l2b-v20-2025-258.fits", "ep2_file": "level2_2025W52_1A_0503_2D5_spx_l2b-v21-2025-363.fits"},
        {"target": "Target 2 (CVZ)", "wavelength_um": 1.0, "ep1_file": "level2_2025W19_2B_0484_1D1_spx_l2b-v20-2025-247.fits", "ep2_file": "level2_2026W01_1A_0019_1D1_spx_l2b-v22-2026-007.fits"},
        {"target": "Target 2 (CVZ)", "wavelength_um": 2.0, "ep1_file": "level2_2025W22_1B_0128_1D3_spx_l2b-v20-2025-250.fits", "ep2_file": "level2_2026W04_1A_0672_4D3_spx_l2b-v23-2026-023.fits"},
        {"target": "Target 2 (CVZ)", "wavelength_um": 4.0, "ep1_file": "level2_2025W38_2C_0244_2D5_spx_l2b-v20-2025-269.fits", "ep2_file": "level2_2026W15_2A_0199_2D5_spx_l2b-v24-2026-105.fits"},
        {"target": "Target 3", "wavelength_um": 1.0, "ep1_file": "level2_2025W21_1B_0594_3D1_spx_l2b-v20-2025-248.fits", "ep2_file": "level2_2025W52_1A_0014_1D1_spx_l2b-v21-2025-363.fits"},
        {"target": "Target 3", "wavelength_um": 2.0, "ep1_file": "level2_2025W20_2D_0313_1D3_spx_l2b-v20-2025-247.fits", "ep2_file": "level2_2025W52_2A_0158_1D3_spx_l2b-v22-2026-006.fits"},
        {"target": "Target 3", "wavelength_um": 4.0, "ep1_file": "level2_2025W21_1B_0570_2D5_spx_l2b-v20-2025-248.fits", "ep2_file": "level2_2025W52_1A_0081_2D5_spx_l2b-v21-2025-363.fits"},
        {"target": "Target 4", "wavelength_um": 1.0, "ep1_file": "level2_2025W26_2A_0150_4D1_spx_l2b-v20-2025-257.fits", "ep2_file": "level2_2026W01_2A_0319_1D1_spx_l2b-v23-2026-008.fits"},
        {"target": "Target 4", "wavelength_um": 2.0, "ep1_file": "level2_2025W28_2A_0271_4D3_spx_l2b-v20-2025-260.fits", "ep2_file": "level2_2025W51_2A_0084_3D3_spx_l2b-v21-2025-357.fits"},
        {"target": "Target 4", "wavelength_um": 4.0, "ep1_file": "level2_2025W27_1A_0301_2D5_spx_l2b-v20-2025-258.fits", "ep2_file": "level2_2025W52_1A_0361_2D5_spx_l2b-v21-2025-363.fits"},
        {"target": "Target 5", "wavelength_um": 1.0, "ep1_file": "level2_2025W42_2A_0601_3D1_spx_l2b-v20-2025-293.fits", "ep2_file": "level2_2026W15_2A_0748_3D1_spx_l2b-v24-2026-105.fits"},
        {"target": "Target 5", "wavelength_um": 2.0, "ep1_file": "level2_2025W43_1A_0525_3D3_spx_l2b-v20-2025-299.fits", "ep2_file": "level2_2026W14_2A_0659_3D3_spx_l2b-v24-2026-098.fits"},
        {"target": "Target 5", "wavelength_um": 4.0, "ep1_file": "level2_2025W42_2A_0684_4D5_spx_l2b-v20-2025-293.fits", "ep2_file": "level2_2026W15_1A_0138_4D5_spx_l2b-v24-2026-104.fits"},
    ]

    rerun_comparisons = []
    for prev in prev_selections:
        tid = prev["target"]
        w0 = prev["wavelength_um"]
        det_name = detector_for_wavelength(w0).replace("SPHEREx-", "")
        items = all_target_data[tid]
        by_ep = {
            1: [it for it in items if it["epoch"] == 1 and it["detector"] == det_name],
            2: [it for it in items if it["epoch"] == 2 and it["detector"] == det_name],
        }

        # Filter within tolerance tol = 1.0 * w0 / R
        r_val = by_ep[1][0]["resolving_power"] if by_ep[1] else 40.0
        tol_um = settings.wavelength_tol_k * (w0 / r_val)
        cands1 = [c for c in by_ep[1] if abs(c["w_mid"] - w0) <= tol_um]
        cands2 = [c for c in by_ep[2] if abs(c["w_mid"] - w0) <= tol_um]

        # Best in Ep 1 by min error
        cands1.sort(key=lambda x: (abs(x["w_mid"] - w0), x["mjd"], x["s3_key"]))
        best1 = cands1[0] if cands1 else None

        # Best in Ep 2 with tie break rule: within 0.002 um of min error, order by larger shared overlap with Ep1, then earlier MJD
        cands2.sort(key=lambda x: (abs(x["w_mid"] - w0), x["mjd"], x["s3_key"]))
        if cands2 and best1:
            min_err2 = abs(cands2[0]["w_mid"] - w0)
            near_ties = [c for c in cands2 if (abs(c["w_mid"] - w0) - min_err2) <= settings.tie_break_tol_um]
            ranked = []
            for c in near_ties:
                sh_min = max(c["w_min"], best1["w_min"])
                sh_max = min(c["w_max"], best1["w_max"])
                sh_ov = max(0.0, sh_max - sh_min)
                ranked.append((-round(sh_ov, 8), round(c["mjd"], 8), c))
            ranked.sort(key=lambda x: (x[0], x[1]))
            best2 = ranked[0][2]
        else:
            best2 = cands2[0] if cands2 else None

        sh_min = max(best1["w_min"], best2["w_min"]) if best1 and best2 else 0.0
        sh_max = min(best1["w_max"], best2["w_max"]) if best1 and best2 else 0.0
        sh_ov = max(0.0, sh_max - sh_min)

        rerun_comparisons.append({
            "target": tid,
            "wavelength_um": w0,
            "detector": det_name,
            "prev_ep1_file": prev["ep1_file"],
            "prev_ep2_file": prev["ep2_file"],
            "new_ep1_file": best1["filename"] if best1 else None,
            "new_ep2_file": best2["filename"] if best2 else None,
            "new_ep1_range": [round(best1["w_min"], 4), round(best1["w_max"], 4)] if best1 else None,
            "new_ep2_range": [round(best2["w_min"], 4), round(best2["w_max"], 4)] if best2 else None,
            "new_shared_overlap_um": round(sh_ov, 4),
            "ep1_changed": (prev["ep1_file"] != (best1["filename"] if best1 else None)),
            "ep2_changed": (prev["ep2_file"] != (best2["filename"] if best2 else None)),
            "selection_changed": (prev["ep1_file"] != (best1["filename"] if best1 else None)) or (prev["ep2_file"] != (best2["filename"] if best2 else None)),
        })

    return rerun_comparisons


def compute_item3_wide_mode():
    """
    For inter-epoch mode with size_deg = 0.5:
    - Report shared-wavelength valid fraction and whether the tile is blinkable.
    - Compute from parallax numbers which of 300 / 500 / 1000 AU stay inside 0.5 deg tile
      if the object starts at tile centre in epoch 1 (half-box radius = 0.25 deg = 900 arcsec).
    """
    # 1. Shared wavelength valid fraction from w11b_new_items.json
    p_new = "/scratch/w11b_new_items.json" if os.path.exists("/scratch/w11b_new_items.json") else r"C:\Users\USER\.gemini\antigravity\brain\9fbedac9-6d9a-4101-996d-16700a0e917e\scratch\w11b_new_items.json"
    with open(p_new, encoding="utf-8") as f:
        data_new = json.load(f)

    wide_rows = [r for r in data_new["item2_3"]["wide_rows"] if r["size_deg"] == 0.5]
    valid_fraction_rows = []
    # Blinkable condition: at least 2 epochs each have at least one non-empty band, with at least one band present in both
    # (Here both epochs have valid data in all 3 bands!)
    for r in wide_rows:
        valid_fraction_rows.append({
            "target": r["target"],
            "wavelength_um": r["wavelength_um"],
            "detector": r["detector"],
            "ep1_range_um": r["ep1_range_um"],
            "ep2_range_um": r["ep2_range_um"],
            "shared_range_um": r["shared_range_um"],
            "shared_span_um": r["shared_span_um"],
            "joint_sky_in_shared_frac": r["joint_sky_in_shared_frac"],
            "is_blinkable": (r["shared_span_um"] >= 0.01 and r["joint_sky_in_shared_frac"] > 0.05),
        })

    # 2. Containment of 300, 500, 1000 AU inside 0.5 deg tile starting at center
    p_ev = "/scratch/w11b_evidence.json" if os.path.exists("/scratch/w11b_evidence.json") else r"C:\Users\USER\.gemini\antigravity\brain\9fbedac9-6d9a-4101-996d-16700a0e917e\scratch\w11b_evidence.json"
    with open(p_ev, encoding="utf-8") as f:
        data_ev = json.load(f)

    containment_rows = []
    for r in data_ev["item2"]["synthetic_rows"]:
        if r["dist_au"] in (300.0, 500.0, 1000.0):
            t6_arcsec = r["total_6m_arcsec"]
            t6_deg = r["total_6m_deg"]
            # Tile radius from centre = 0.25 deg = 900 arcsec
            stays_in_radius = (t6_arcsec <= 900.0)
            containment_rows.append({
                "target": r["target"],
                "dist_au": r["dist_au"],
                "dt_epoch_days": r["dt_epoch_days"],
                "baseline_perp_au": r["earth_baseline_perp_au"],
                "parallax_arcsec": r["parallax_6m_arcsec"],
                "pm_arcsec": r["pm_6m_arcsec"],
                "total_disp_arcsec": t6_arcsec,
                "total_disp_deg": t6_deg,
                "tile_radius_arcsec": 900.0,
                "stays_inside_05deg_tile": stays_in_radius,
            })

    return valid_fraction_rows, containment_rows


def render_markdown_report(item1_data, item2_data, item3_valid, item3_contain):
    lines = []

    # Section 1
    lines.append("### 1. Item 1: Intra-Epoch Pairs Filtered by Shared Overlap $\\ge 0.01\\ \\mu\\text{m}$, $\\Delta t \\ge 0.2\\text{ d}$, and Drop Same-Pointing Dithers")
    lines.append("")
    lines.append("| Tolerance ($\mu\\text{m}$) | Target | Usable Pairs ($\Delta t \\ge 0.2\\text{ d}$, ov $\\ge 0.01\\ \\mu\\text{m}$) | $\\Delta t_{\\min}$ (d) | $\\Delta t_{\\text{med}}$ (d) | $\\Delta t_{\\max}$ (d) | **`0.2–1 d`** | **`1–5 d`** | **`5–30 d`** | Dropped Same-Pointing Dithers | Dropped $\\Delta t < 0.2\\text{ d}$ | Dropped CVZ $\\Delta t > 30\\text{ d}$ | Dropped ov $< 0.01\\ \\mu\\text{m}$ |")
    lines.append("| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for r in item1_data:
        dmin = f"{r['dt_min']:.4f}" if r["dt_min"] is not None else "—"
        dmed = f"{r['dt_median']:.4f}" if r["dt_median"] is not None else "—"
        dmax = f"{r['dt_max']:.4f}" if r["dt_max"] is not None else "—"
        lines.append(
            f"| **`{r['tolerance_um']:.2f}`** | {r['target']} | **{r['n_valid_pairs']}** | `{dmin}` | `{dmed}` | `{dmax}` | "
            f"**{r['count_02_to_1d']}** | **{r['count_1_to_5d']}** | **{r['count_5_to_30d']}** | `{r['same_pointing_dropped']}` | `{r['sub_02d_dropped']}` | `{r['cvz_gt30d_dropped']}` | `{r['overlap_lt001_dropped']}` |"
        )

    # Section 2
    lines.append("")
    lines.append("### 2. Item 2: Stored Selection Results (Matched Pairs) with Fixed Header Parsing vs Previous Report")
    lines.append("")
    lines.append("| Target | $\\lambda_0$ ($\mu\\text{m}$) | Det | Previous Epoch 1 File | Previous Epoch 2 File | Rerun Epoch 1 File | Rerun Epoch 2 File | Rerun Overlap ($\mu\\text{m}$) | **Selection Changed?** |")
    lines.append("| :--- | :---: | :---: | :--- | :--- | :--- | :--- | :---: | :---: |")
    for r in item2_data:
        changed_str = "**NO (Identical)**" if not r["selection_changed"] else f"**YES ({'Ep1' if r['ep1_changed'] else ''} {'Ep2' if r['ep2_changed'] else ''})**"
        lines.append(
            f"| {r['target']} | `{r['wavelength_um']:.1f}` | `{r['detector']}` | `{r['prev_ep1_file']}` | `{r['prev_ep2_file']}` | "
            f"`{r['new_ep1_file']}` | `{r['new_ep2_file']}` | `{r['new_shared_overlap_um']:.4f}` | {changed_str} |"
        )

    # Section 3A
    lines.append("")
    lines.append("### 3A. Item 3A: Inter-Epoch Mode at `size_deg = 0.5°` Shared-Wavelength Valid Fraction & Blinkability")
    lines.append("")
    lines.append("| Target | $\\lambda_0$ ($\\mu\\text{m}$) | Det | Ep 1 Range ($\\mu\\text{m}$) | Ep 2 Range ($\\mu\\text{m}$) | Shared Range & Width ($\\mu\\text{m}$) | **Joint Shared Sky Valid Fraction** | **Blinkable?** | Reason / Notes |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |")
    for r in item3_valid:
        sh_str = f"`[{r['shared_range_um'][0]:.4f}, {r['shared_range_um'][1]:.4f}]` (`{r['shared_span_um']:.4f}`)"
        note = r"$\ge 2$ epochs with non-empty band & overlap $\ge 0.01\ \mu\text{m}$"
        lines.append(
            f"| {r['target']} | `{r['wavelength_um']:.1f}` | `{r['detector']}` | `[{r['ep1_range_um'][0]:.4f}, {r['ep1_range_um'][1]:.4f}]` | "
            f"`[{r['ep2_range_um'][0]:.4f}, {r['ep2_range_um'][1]:.4f}]` | {sh_str} | **`{100*r['joint_sky_in_shared_frac']:.1f}%`** | **`{r['is_blinkable']}`** | {note} |"
        )

    # Section 3B
    lines.append("")
    lines.append("### 3B. Item 3B: Parallax Displacement Containment Inside `0.5°` Tile (Object Starting at Centre, Radius $= 0.25° = 900\"$)")
    lines.append("")
    lines.append("| Target | Object ($d$ [ASSUMED]) | $\\Delta t_{\\text{ep}}$ (d) | $|\Delta\\mathbf{r}_{\\oplus,\\perp}|$ (AU [COMPUTED]) | 6-mo Parallax Only | 6-mo Proper Motion | Total 6-mo Displacement | **Stays Inside `0.5°` Tile (Disp $\\le 900\"$)?** | Margin to Tile Boundary |")
    lines.append("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for r in item3_contain:
        margin_arcsec = 900.0 - r["total_disp_arcsec"]
        margin_str = f"`+{margin_arcsec:.1f}\"` (`+{margin_arcsec/3600.0:.3f}°` inside)" if margin_arcsec >= 0 else f"`{margin_arcsec:.1f}\"` (`{margin_arcsec/3600.0:.3f}°` outside)"
        stays_str = f"**`{r['stays_inside_05deg_tile']}`**" if r["stays_inside_05deg_tile"] else f"`{r['stays_inside_05deg_tile']}`"
        lines.append(
            f"| {r['target']} | Hypothetical {r['dist_au']:.0f} AU | `{r['dt_epoch_days']:.1f}` | `{r['baseline_perp_au']:.4f}` | "
            f"`{r['parallax_arcsec']:.1f}\"` | `{r['pm_arcsec']:.1f}\"` | **`{r['total_disp_arcsec']:.1f}\"` (`{r['total_disp_deg']:.3f}°`)** | {stays_str} | {margin_str} |"
        )

    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    s3_client = get_spherex_s3_client(connect_timeout=10, read_timeout=30, max_retries=4, max_pool_connections=50)

    # Fetch candidate data
    all_target_data = fetch_all_target_candidates(s3_client)

    # 1. Intra-epoch pairs
    print("Computing Item 1 (Intra-epoch pairs with overlap >= 0.01 um, dt >= 0.2 d, drop same pointing)...")
    item1_summary = compute_item1_intra_epoch_pairs(all_target_data)

    # 2. Rerun stored selection results
    print("Computing Item 2 (Selection comparison with fixed header parsing)...")
    item2_comparisons = compute_item2_selection_comparison(all_target_data)

    # 3. Inter-epoch wide mode & parallax containment
    print("Computing Item 3 (0.5 deg wide mode valid fraction & parallax containment)...")
    item3_valid, item3_contain = compute_item3_wide_mode()

    # Save to JSON
    payload = {
        "item1_intra_epoch_pairs": item1_summary,
        "item2_selection_comparison": item2_comparisons,
        "item3_wide_valid_fractions": item3_valid,
        "item3_parallax_containment": item3_contain,
    }
    json_path = "/scratch/w11b_final_items.json"
    md_path = "/scratch/w11b_final_tables.md"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    md_text = render_markdown_report(item1_summary, item2_comparisons, item3_valid, item3_contain)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_text)

    print(f"Done! Successfully wrote {json_path} and {md_path}.")
