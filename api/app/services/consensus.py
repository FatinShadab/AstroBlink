"""Pure consensus algorithm for AstroBlink.

Fully typed, no I/O, no DB, no FastAPI dependencies.
Implements:
- Haversine angular distance (handles RA wraparound at 0°/360° and cos(Dec) scaling).
- Reliability-weighted DBSCAN per epoch.
- Weighted spherical centroid and dispersion calculation.
- Tracklet linking across epochs with configurable maximum displacement.
- Motion vector computation (motion_arcsec_per_epoch and position angle).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class MarkInput:
    """Input mark for consensus clustering."""
    user_id: str
    epoch: int
    ra_deg: float
    dec_deg: float
    weight: float = 1.0


@dataclass(frozen=True)
class EpochClusterResult:
    """Output cluster for a single epoch."""
    epoch: int
    centroid_ra_deg: float
    centroid_dec_deg: float
    cluster_size: int
    dispersion_arcsec: float
    mean_reliability: float
    mark_indices: list[int]


@dataclass(frozen=True)
class TrackletResult:
    """Linked sequence of per-epoch clusters forming a motion candidate."""
    clusters: list[EpochClusterResult]
    motion_arcsec_per_epoch: float | None
    motion_pa_deg: float | None
    total_marks: int
    distinct_users_count: int
    mean_reliability: float
    mean_dispersion_arcsec: float



def haversine_arcsec(ra1_deg: float, dec1_deg: float, ra2_deg: float, dec2_deg: float) -> float:
    """Angular distance in arcseconds between two celestial coordinates.

    Handles RA wraparound (e.g. 359.99° vs 0.01°) and Dec curvature natively
    via spherical trigonometry.
    """
    ra1 = math.radians(ra1_deg)
    dec1 = math.radians(dec1_deg)
    ra2 = math.radians(ra2_deg)
    dec2 = math.radians(dec2_deg)

    d_ra = ra2 - ra1
    d_dec = dec2 - dec1

    sin_half_ddec = math.sin(d_dec / 2.0)
    sin_half_dra = math.sin(d_ra / 2.0)

    a = (sin_half_ddec * sin_half_ddec) + math.cos(dec1) * math.cos(dec2) * (sin_half_dra * sin_half_dra)
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.asin(math.sqrt(a))
    return math.degrees(c) * 3600.0


def weighted_spherical_centroid(
    ra_degs: Sequence[float],
    dec_degs: Sequence[float],
    weights: Sequence[float],
) -> tuple[float, float]:
    """Compute the weighted spherical centroid (mean RA, mean Dec in degrees).

    Converts points to 3D Cartesian unit vectors weighted by user reliability,
    sums the vectors, and converts back to spherical coordinates.
    This handles RA wraparound (e.g. 359.9° and 0.1°) seamlessly without edge-case branches.
    """
    if not ra_degs:
        raise ValueError("Cannot compute centroid of empty sequence")

    sum_x = 0.0
    sum_y = 0.0
    sum_z = 0.0

    for ra, dec, w in zip(ra_degs, dec_degs, weights):
        ra_rad = math.radians(ra)
        dec_rad = math.radians(dec)
        cos_dec = math.cos(dec_rad)
        sum_x += w * cos_dec * math.cos(ra_rad)
        sum_y += w * cos_dec * math.sin(ra_rad)
        sum_z += w * math.sin(dec_rad)

    hypot_xy = math.hypot(sum_x, sum_y)
    if hypot_xy == 0.0 and sum_z == 0.0:
        return 0.0, 0.0

    mean_ra_rad = math.atan2(sum_y, sum_x) % (2.0 * math.pi)
    mean_dec_rad = math.atan2(sum_z, hypot_xy)

    return math.degrees(mean_ra_rad), math.degrees(mean_dec_rad)


def weighted_dbscan(
    marks: Sequence[MarkInput],
    epsilon_arcsec: float,
    min_pts: float,
) -> list[list[int]]:
    """Reliability-weighted DBSCAN with haversine distance metric.

    Parameters
    ----------
    marks: sequence of MarkInput (ra_deg, dec_deg, weight)
    epsilon_arcsec: neighborhood radius in arcseconds
    min_pts: minimum sum of weights in an epsilon-neighborhood to form a core point

    Returns
    -------
    list of clusters, where each cluster is a list of indices into `marks`.
    Noise points are omitted.
    """
    n = len(marks)
    if n == 0:
        return []

    # Pre-compute distance matrix or neighbor lists
    # Note: N <= 100 classifications per subject in practice, so O(N^2) haversine is fast (< 1 ms).
    neighbors_of: list[list[int]] = []
    density_of: list[float] = []

    for i in range(n):
        nbrs = []
        density = 0.0
        m_i = marks[i]
        for j in range(n):
            m_j = marks[j]
            dist = haversine_arcsec(m_i.ra_deg, m_i.dec_deg, m_j.ra_deg, m_j.dec_deg)
            if dist <= epsilon_arcsec:
                nbrs.append(j)
                density += m_j.weight
        neighbors_of.append(nbrs)
        density_of.append(density)

    # labels: -1 = unvisited, 0 = noise, >0 = cluster_id
    labels = [-1] * n
    cluster_id = 0

    for i in range(n):
        if labels[i] != -1:
            continue

        if density_of[i] < min_pts:
            labels[i] = 0  # noise
            continue

        cluster_id += 1
        labels[i] = cluster_id
        seed_set = set(neighbors_of[i]) - {i}

        while seed_set:
            q = seed_set.pop()
            if labels[q] == 0:
                labels[q] = cluster_id
            if labels[q] != -1:
                continue

            labels[q] = cluster_id
            if density_of[q] >= min_pts:
                seed_set |= set(neighbors_of[q])

    clusters_dict: dict[int, list[int]] = {}
    for idx, cid in enumerate(labels):
        if cid > 0:
            clusters_dict.setdefault(cid, []).append(idx)

    # Return clusters sorted deterministically by min index
    return [clusters_dict[k] for k in sorted(clusters_dict.keys())]


def cluster_epoch_marks(
    marks: Sequence[MarkInput],
    epoch: int,
    epsilon_arcsec: float,
    min_pts: float,
) -> list[EpochClusterResult]:
    """Cluster all marks for a single epoch.

    Filters input marks to `epoch`, runs weighted DBSCAN, and computes
    centroids and dispersion for each resulting cluster.
    """
    indexed_epoch_marks = [(orig_idx, m) for orig_idx, m in enumerate(marks) if m.epoch == epoch]
    if not indexed_epoch_marks:
        return []

    sub_marks = [m for _, m in indexed_epoch_marks]
    sub_clusters = weighted_dbscan(sub_marks, epsilon_arcsec, min_pts)

    epoch_clusters: list[EpochClusterResult] = []
    for cluster_indices in sub_clusters:
        c_ras = [sub_marks[k].ra_deg for k in cluster_indices]
        c_decs = [sub_marks[k].dec_deg for k in cluster_indices]
        c_weights = [sub_marks[k].weight for k in cluster_indices]
        orig_indices = [indexed_epoch_marks[k][0] for k in cluster_indices]

        mean_ra, mean_dec = weighted_spherical_centroid(c_ras, c_decs, c_weights)

        # Dispersion: weighted RMS angular distance from centroid
        dispersions = [
            haversine_arcsec(mean_ra, mean_dec, r, d)
            for r, d in zip(c_ras, c_decs)
        ]
        sum_weights = sum(c_weights)
        if sum_weights > 0:
            weighted_var = sum(w * (d ** 2) for w, d in zip(c_weights, dispersions)) / sum_weights
            dispersion_arcsec = math.sqrt(weighted_var)
            mean_reliability = sum_weights / len(c_weights)
        else:
            dispersion_arcsec = 0.0
            mean_reliability = 0.0

        epoch_clusters.append(
            EpochClusterResult(
                epoch=epoch,
                centroid_ra_deg=round(mean_ra, 7),
                centroid_dec_deg=round(mean_dec, 7),
                cluster_size=len(cluster_indices),
                dispersion_arcsec=round(dispersion_arcsec, 4),
                mean_reliability=round(mean_reliability, 4),
                mark_indices=orig_indices,
            )
        )

    # Sort deterministically by centroid_ra_deg, then centroid_dec_deg
    epoch_clusters.sort(key=lambda c: (c.centroid_ra_deg, c.centroid_dec_deg))
    return epoch_clusters


def compute_motion_vector(
    first_cluster: EpochClusterResult,
    last_cluster: EpochClusterResult,
) -> tuple[float | None, float | None]:
    """Compute motion magnitude (arcsec/epoch) and position angle (0° to 360°).

    Position angle convention:
    - 0° = North (+Dec)
    - 90° = East (+RA)
    - 180° = South (-Dec)
    - 270° = West (-RA)
    """
    n_epoch_gaps = last_cluster.epoch - first_cluster.epoch
    if n_epoch_gaps <= 0:
        return None, None

    total_disp = haversine_arcsec(
        first_cluster.centroid_ra_deg,
        first_cluster.centroid_dec_deg,
        last_cluster.centroid_ra_deg,
        last_cluster.centroid_dec_deg,
    )
    motion_arcsec_per_epoch = total_disp / float(n_epoch_gaps)

    # Position angle:
    # d_ra is east-west displacement in arcsec (scaled by cos(dec))
    # Note: handle RA wraparound if crossing 0°/360°
    d_ra_deg = (last_cluster.centroid_ra_deg - first_cluster.centroid_ra_deg)
    if d_ra_deg > 180.0:
        d_ra_deg -= 360.0
    elif d_ra_deg < -180.0:
        d_ra_deg += 360.0

    mean_dec_rad = math.radians((first_cluster.centroid_dec_deg + last_cluster.centroid_dec_deg) / 2.0)
    d_ra_arcsec = d_ra_deg * math.cos(mean_dec_rad) * 3600.0
    d_dec_arcsec = (last_cluster.centroid_dec_deg - first_cluster.centroid_dec_deg) * 3600.0

    pa_deg = (math.degrees(math.atan2(d_ra_arcsec, d_dec_arcsec)) + 360.0) % 360.0

    return round(motion_arcsec_per_epoch, 4), round(pa_deg, 2)


def link_tracklets(
    clusters_by_epoch: dict[int, list[EpochClusterResult]],
    max_displacement_arcsec: float,
    marks: Sequence[MarkInput] | None = None,
) -> list[TrackletResult]:
    """Link per-epoch clusters across epochs into motion tracklets.

    Algorithm (ARCHITECTURE.md §5.5):
    - Greedily finds nearest cluster in next epoch within max_displacement_arcsec.
    - Extends to subsequent epochs.
    - Unlinked clusters form single-epoch tracklets.
    - Produces TrackletResult objects with motion vector and aggregated stats.
    """
    sorted_epochs = sorted(clusters_by_epoch.keys())
    if not sorted_epochs:
        return []

    used: set[tuple[int, int]] = set()
    raw_tracklets: list[list[EpochClusterResult]] = []

    if len(sorted_epochs) >= 2:
        for i, epoch_a in enumerate(sorted_epochs[:-1]):
            epoch_b = sorted_epochs[i + 1]
            clusters_a = clusters_by_epoch[epoch_a]
            clusters_b = clusters_by_epoch[epoch_b]

            for ai, ca in enumerate(clusters_a):
                if (epoch_a, ai) in used:
                    continue

                best_bi: int | None = None
                best_dist = float("inf")
                for bi, cb in enumerate(clusters_b):
                    if (epoch_b, bi) in used:
                        continue
                    dist = haversine_arcsec(
                        ca.centroid_ra_deg, ca.centroid_dec_deg,
                        cb.centroid_ra_deg, cb.centroid_dec_deg,
                    )
                    if dist <= max_displacement_arcsec and dist < best_dist:
                        best_dist = dist
                        best_bi = bi

                if best_bi is not None:
                    tracklet = [ca, clusters_b[best_bi]]
                    used.add((epoch_a, ai))
                    used.add((epoch_b, best_bi))

                    current_cluster = clusters_b[best_bi]
                    for j in range(i + 2, len(sorted_epochs)):
                        epoch_c = sorted_epochs[j]
                        clusters_c = clusters_by_epoch[epoch_c]
                        next_best_ci: int | None = None
                        next_best_dist = float("inf")
                        for ci, cc in enumerate(clusters_c):
                            if (epoch_c, ci) in used:
                                continue
                            dist = haversine_arcsec(
                                current_cluster.centroid_ra_deg, current_cluster.centroid_dec_deg,
                                cc.centroid_ra_deg, cc.centroid_dec_deg,
                            )
                            if dist <= max_displacement_arcsec and dist < next_best_dist:
                                next_best_dist = dist
                                next_best_ci = ci

                        if next_best_ci is not None:
                            tracklet.append(clusters_c[next_best_ci])
                            used.add((epoch_c, next_best_ci))
                            current_cluster = clusters_c[next_best_ci]
                        else:
                            break

                    raw_tracklets.append(tracklet)

    # Any unlinked clusters become single-epoch tracklets
    for epoch in sorted_epochs:
        for ci, c in enumerate(clusters_by_epoch[epoch]):
            if (epoch, ci) not in used:
                raw_tracklets.append([c])

    # Convert to TrackletResult
    results: list[TrackletResult] = []
    for t_clusters in raw_tracklets:
        # Sort clusters by epoch
        t_clusters_sorted = sorted(t_clusters, key=lambda c: c.epoch)
        total_marks = sum(c.cluster_size for c in t_clusters_sorted)
        if total_marks > 0:
            mean_rel = sum(c.mean_reliability * c.cluster_size for c in t_clusters_sorted) / total_marks
        else:
            mean_rel = 0.0

        mean_disp = sum(c.dispersion_arcsec for c in t_clusters_sorted) / len(t_clusters_sorted)

        if len(t_clusters_sorted) >= 2:
            motion, pa = compute_motion_vector(t_clusters_sorted[0], t_clusters_sorted[-1])
        else:
            motion, pa = None, None

        if marks is not None:
            contributing_user_ids = {
                marks[m_idx].user_id
                for c in t_clusters_sorted
                for m_idx in c.mark_indices
                if m_idx < len(marks)
            }
            distinct_users = len(contributing_user_ids)
        else:
            distinct_users = max(c.cluster_size for c in t_clusters_sorted)

        results.append(
            TrackletResult(
                clusters=t_clusters_sorted,
                motion_arcsec_per_epoch=motion,
                motion_pa_deg=pa,
                total_marks=total_marks,
                distinct_users_count=distinct_users,
                mean_reliability=round(mean_rel, 4),
                mean_dispersion_arcsec=round(mean_disp, 4),
            )
        )


    # Sort tracklets deterministically: multi-epoch first, then total marks descending
    results.sort(key=lambda t: (-len(t.clusters), -t.total_marks, t.clusters[0].centroid_ra_deg))
    return results


def run_pure_consensus(
    marks: Sequence[MarkInput],
    epochs: Sequence[int],
    epsilon_arcsec: float = 9.2,
    min_pts: float = 3.0,
    max_displacement_arcsec: float = 30.0,
) -> list[TrackletResult]:
    """Run pure consensus on a list of marks across specified epochs.

    Parameters
    ----------
    marks: Sequence of MarkInput
    epochs: Sequence of epoch integers to consider
    epsilon_arcsec: DBSCAN neighborhood radius (default 9.2" = 1.5 px * 6.15"/px)
    min_pts: DBSCAN min weighted density (default 3.0)
    max_displacement_arcsec: Max displacement between consecutive epochs for linking (default 30.0")

    Returns
    -------
    list of TrackletResult objects
    """
    clusters_by_epoch: dict[int, list[EpochClusterResult]] = {}
    for epoch in sorted(epochs):
        clusters = cluster_epoch_marks(marks, epoch, epsilon_arcsec, min_pts)
        if clusters:
            clusters_by_epoch[epoch] = clusters

    if not clusters_by_epoch:
        return []

    return link_tracklets(clusters_by_epoch, max_displacement_arcsec, marks=marks)



def compute_updated_reliability(
    gold_total: int,
    gold_correct: int,
    min_reliability: float = 0.05,
    max_reliability: float = 1.0,
    prior_reliability: float = 0.5,
    prior_weight: float = 2.0,
) -> float:
    """Compute updated user reliability score.

    Uses Bayesian m-estimate / Laplace smoothing:
        reliability = (gold_correct + prior_weight * prior_reliability) / (gold_total + prior_weight)
    clamped to [min_reliability, max_reliability].

    When prior_weight = 0.0 and gold_total > 0:
        reduces to standard empirical accuracy (gold_correct / gold_total).
    """
    if gold_total <= 0:
        return max(min_reliability, min(max_reliability, prior_reliability))

    if prior_weight <= 0.0:
        score = float(gold_correct) / float(gold_total)
    else:
        score = (float(gold_correct) + prior_weight * prior_reliability) / (float(gold_total) + prior_weight)

    return round(max(min_reliability, min(max_reliability, score)), 4)


def evaluate_gold_classification(
    category: str,
    marks: Sequence[MarkInput],
    gold_expected: dict,
    position_tolerance_arcsec: float = 15.0,
) -> bool:
    """Evaluate if a volunteer's classification matches the gold-standard expectation.

    gold_expected format (from seed/MPC):
    {
        "category": "asteroid_neo" | "nothing" | ...,
        "positions": [
            {"epoch": 1, "ra_deg": 180.002, "dec_deg": -2.498},
            {"epoch": 2, "ra_deg": 180.005, "dec_deg": -2.495}
        ]
    }
    """
    expected_category = gold_expected.get("category")
    if expected_category and category != expected_category:
        return False

    expected_positions = gold_expected.get("positions", [])
    if not expected_positions:
        # If no positions expected (e.g. empty or artifact), category match is sufficient
        return True

    # For each expected epoch position, user must have provided at least one mark within tolerance
    for exp in expected_positions:
        exp_epoch = exp.get("epoch")
        exp_ra = float(exp["ra_deg"])
        exp_dec = float(exp["dec_deg"])

        matching_mark = False
        for m in marks:
            if exp_epoch is not None and m.epoch != exp_epoch:
                continue
            dist = haversine_arcsec(exp_ra, exp_dec, m.ra_deg, m.dec_deg)
            if dist <= position_tolerance_arcsec:
                matching_mark = True
                break

        if not matching_mark:
            return False

    return True

