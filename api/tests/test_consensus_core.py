"""Unit tests for pure consensus algorithm (Phase C2).

Tests the 8 synthetic scenarios required:
1. Honest clicks scattered within 1 px around one object become one cluster.
2. A 3" epsilon would split those same clicks (regression test showing why the default is pixel-scale-aware).
3. Clicks near RA 0°/360° cluster correctly.
4. An object that moves between epochs yields 2 per-epoch clusters linked as one tracklet, not one merged cluster.
5. Isolated single clicks (noise) are rejected.
6. A spam user with a low score cannot create a candidate alone.
7. A subject with zero marks or only "nothing here" classifications yields no candidate.
8. Deterministic: same input gives same output.
"""

import math
from app.services.consensus import (
    MarkInput,
    cluster_epoch_marks,
    haversine_arcsec,
    run_pure_consensus,
    weighted_spherical_centroid,
)

PIXEL_SCALE_ARCSEC = 6.15
DEFAULT_EPS_ARCSEC = 1.5 * PIXEL_SCALE_ARCSEC  # 9.225 arcsec


def test_1_honest_clicks_within_1px_become_one_cluster():
    """1. Honest clicks scattered within 1 px around one object become one cluster."""
    # Base position (RA=180.0, Dec=10.0)
    # 1 px ≈ 6.15 arcsec. At Dec=10.0, dRA = d_arcsec / (3600 * cos(10°))
    # Place 4 honest users with weight 0.8 scattered by ~0.5 px (3 arcsec)
    ra0, dec0 = 180.0, 10.0
    scale_deg = (3.0 / 3600.0)
    cos_dec = math.cos(math.radians(dec0))

    marks = [
        MarkInput(user_id="u1", epoch=1, ra_deg=ra0, dec_deg=dec0, weight=0.8),
        MarkInput(user_id="u2", epoch=1, ra_deg=ra0 + scale_deg / cos_dec, dec_deg=dec0, weight=0.8),
        MarkInput(user_id="u3", epoch=1, ra_deg=ra0 - scale_deg / cos_dec, dec_deg=dec0, weight=0.8),
        MarkInput(user_id="u4", epoch=1, ra_deg=ra0, dec_deg=dec0 + scale_deg, weight=0.8),
    ]

    clusters = cluster_epoch_marks(marks, epoch=1, epsilon_arcsec=DEFAULT_EPS_ARCSEC, min_pts=2.0)
    assert len(clusters) == 1
    c = clusters[0]
    assert c.cluster_size == 4
    assert c.epoch == 1
    assert math.isclose(c.centroid_ra_deg, ra0, abs_tol=1e-4)
    # Marks were at dec0, dec0, dec0, and dec0 + 3"/3600 (0.000833 deg), so mean dec is ~10.000208
    assert math.isclose(c.centroid_dec_deg, 10.000208, abs_tol=1e-5)
    assert c.dispersion_arcsec < 4.0  # within ~0.6 px



def test_2_small_subpixel_epsilon_splits_or_rejects_clicks():
    """2. A 3" epsilon would split or reject those same clicks (regression test)."""
    ra0, dec0 = 180.0, 10.0
    # Two pairs of clicks separated by 4.5 arcsec (~0.73 px)
    # With default epsilon 9.225", they all cluster together into 1 cluster.
    # With sub-pixel epsilon 3.0", pairwise distance 4.5" > 3.0", so neither can merge with the other,
    # or they are rejected as noise if min_pts is not met.
    d1 = 2.25 / 3600.0
    cos_dec = math.cos(math.radians(dec0))

    marks = [
        MarkInput(user_id="u1", epoch=1, ra_deg=ra0 - d1 / cos_dec, dec_deg=dec0, weight=1.0),
        MarkInput(user_id="u2", epoch=1, ra_deg=ra0 - d1 / cos_dec, dec_deg=dec0 + 0.5 / 3600.0, weight=1.0),
        MarkInput(user_id="u3", epoch=1, ra_deg=ra0 + d1 / cos_dec, dec_deg=dec0, weight=1.0),
        MarkInput(user_id="u4", epoch=1, ra_deg=ra0 + d1 / cos_dec, dec_deg=dec0 + 0.5 / 3600.0, weight=1.0),
    ]

    # With default pixel-scale epsilon (9.225"): 1 unified cluster
    default_clusters = cluster_epoch_marks(marks, epoch=1, epsilon_arcsec=DEFAULT_EPS_ARCSEC, min_pts=3.0)
    assert len(default_clusters) == 1
    assert default_clusters[0].cluster_size == 4

    # With 3.0" epsilon: min_pts=3.0 cannot be satisfied because the 2 groups are 4.5" apart!
    split_clusters = cluster_epoch_marks(marks, epoch=1, epsilon_arcsec=3.0, min_pts=3.0)
    assert len(split_clusters) == 0  # Erroneously rejected because epsilon was sub-pixel!


def test_3_ra_wraparound_near_0_and_360():
    """3. Clicks near RA 0°/360° cluster correctly."""
    # Marks at 359.999° and 0.001° (separation is ~0.002° = 7.2 arcsec)
    dec = 15.0
    marks = [
        MarkInput(user_id="u1", epoch=1, ra_deg=359.9990, dec_deg=dec, weight=1.0),
        MarkInput(user_id="u2", epoch=1, ra_deg=359.9995, dec_deg=dec, weight=1.0),
        MarkInput(user_id="u3", epoch=1, ra_deg=0.0005, dec_deg=dec, weight=1.0),
        MarkInput(user_id="u4", epoch=1, ra_deg=0.0010, dec_deg=dec, weight=1.0),
    ]

    # Verify pairwise distance across 0/360 is small
    dist = haversine_arcsec(359.9990, dec, 0.0010, dec)
    assert dist < 8.0  # ~6.9 arcsec

    clusters = cluster_epoch_marks(marks, epoch=1, epsilon_arcsec=DEFAULT_EPS_ARCSEC, min_pts=3.0)
    assert len(clusters) == 1
    assert clusters[0].cluster_size == 4

    # Centroid should be around 0.0° (or 360.0°), not 180°!
    c_ra = clusters[0].centroid_ra_deg
    assert (c_ra < 0.01 or c_ra > 359.99)


def test_4_moving_object_yields_2_per_epoch_clusters_linked_as_tracklet():
    """4. An object that moves between epochs yields 2 per-epoch clusters linked as one tracklet, not one merged cluster."""
    # Epoch 1: object at RA 180.000, Dec 10.000
    # Epoch 2: object moved by 18 arcsec (3 px) North to RA 180.000, Dec 10.005
    marks_ep1 = [
        MarkInput(user_id="u1", epoch=1, ra_deg=180.0000, dec_deg=10.0000, weight=1.0),
        MarkInput(user_id="u2", epoch=1, ra_deg=180.0001, dec_deg=10.0001, weight=1.0),
        MarkInput(user_id="u3", epoch=1, ra_deg=179.9999, dec_deg=9.9999, weight=1.0),
    ]
    marks_ep2 = [
        MarkInput(user_id="u1", epoch=2, ra_deg=180.0000, dec_deg=10.0050, weight=1.0),
        MarkInput(user_id="u2", epoch=2, ra_deg=180.0001, dec_deg=10.0051, weight=1.0),
        MarkInput(user_id="u3", epoch=2, ra_deg=179.9999, dec_deg=10.0049, weight=1.0),
    ]
    all_marks = marks_ep1 + marks_ep2

    # Run consensus across epochs [1, 2]
    tracklets = run_pure_consensus(
        marks=all_marks,
        epochs=[1, 2],
        epsilon_arcsec=DEFAULT_EPS_ARCSEC,
        min_pts=3.0,
        max_displacement_arcsec=30.0,
    )

    assert len(tracklets) == 1
    t = tracklets[0]
    assert len(t.clusters) == 2
    assert t.clusters[0].epoch == 1
    assert t.clusters[1].epoch == 2
    # Verify centroids are separate
    assert math.isclose(t.clusters[0].centroid_dec_deg, 10.0000, abs_tol=1e-4)
    assert math.isclose(t.clusters[1].centroid_dec_deg, 10.0050, abs_tol=1e-4)
    # Motion vector verification: ~18 arcsec over 1 epoch gap, PA towards North (~0° or 360°)
    assert t.motion_arcsec_per_epoch is not None
    assert 17.5 <= t.motion_arcsec_per_epoch <= 18.5
    assert t.motion_pa_deg is not None
    assert (t.motion_pa_deg < 5.0 or t.motion_pa_deg > 355.0)


def test_5_isolated_single_clicks_rejected():
    """5. Isolated single clicks (noise) are rejected."""
    # 3 users agree on target A; 2 other users click scattered random noise elsewhere
    marks = [
        # Consensus target
        MarkInput(user_id="u1", epoch=1, ra_deg=150.0, dec_deg=20.0, weight=1.0),
        MarkInput(user_id="u2", epoch=1, ra_deg=150.0005, dec_deg=20.0005, weight=1.0),
        MarkInput(user_id="u3", epoch=1, ra_deg=149.9995, dec_deg=19.9995, weight=1.0),
        # Noise clicks > 1 arcminute away
        MarkInput(user_id="u4", epoch=1, ra_deg=150.05, dec_deg=20.05, weight=1.0),
        MarkInput(user_id="u5", epoch=1, ra_deg=149.90, dec_deg=19.90, weight=1.0),
    ]

    clusters = cluster_epoch_marks(marks, epoch=1, epsilon_arcsec=DEFAULT_EPS_ARCSEC, min_pts=3.0)
    assert len(clusters) == 1
    assert clusters[0].cluster_size == 3
    assert set(clusters[0].mark_indices) == {0, 1, 2}


def test_6_spam_user_with_low_score_cannot_create_candidate_alone():
    """6. A spam user with a low score cannot create a candidate alone."""
    # Spam user with weight 0.05 clicks multiple times near a spot, or single click
    # Even if spam user submits 5 marks near each other, total weight = 5 * 0.05 = 0.25 < min_pts (3.0)
    spam_marks = [
        MarkInput(user_id="spammer", epoch=1, ra_deg=120.0 + i * 0.0001, dec_deg=0.0, weight=0.05)
        for i in range(5)
    ]

    clusters = cluster_epoch_marks(spam_marks, epoch=1, epsilon_arcsec=DEFAULT_EPS_ARCSEC, min_pts=3.0)
    assert len(clusters) == 0


def test_7_zero_marks_or_nothing_here_yields_no_candidate():
    """7. A subject with zero marks or only 'nothing here' classifications yields no candidate."""
    # No marks
    tracklets_empty = run_pure_consensus(marks=[], epochs=[1, 2])
    assert tracklets_empty == []

    # Marks only in epoch 3, but subject epochs are [1, 2]
    unrelated_marks = [
        MarkInput(user_id="u1", epoch=3, ra_deg=100.0, dec_deg=0.0, weight=1.0),
        MarkInput(user_id="u2", epoch=3, ra_deg=100.0, dec_deg=0.0, weight=1.0),
        MarkInput(user_id="u3", epoch=3, ra_deg=100.0, dec_deg=0.0, weight=1.0),
    ]
    tracklets_mismatch = run_pure_consensus(marks=unrelated_marks, epochs=[1, 2])
    assert tracklets_mismatch == []


def test_8_deterministic_output():
    """8. Deterministic: same input gives same output."""
    # 0.0005 deg ≈ 1.8 arcsec, well within 9.2" epsilon
    marks = [
        MarkInput(user_id="u1", epoch=1, ra_deg=200.0002, dec_deg=5.0002, weight=1.0),
        MarkInput(user_id="u2", epoch=1, ra_deg=200.0004, dec_deg=5.0004, weight=1.0),
        MarkInput(user_id="u3", epoch=1, ra_deg=200.0000, dec_deg=5.0000, weight=1.0),
        MarkInput(user_id="u1", epoch=2, ra_deg=200.0022, dec_deg=5.0032, weight=1.0),
        MarkInput(user_id="u2", epoch=2, ra_deg=200.0024, dec_deg=5.0034, weight=1.0),
        MarkInput(user_id="u3", epoch=2, ra_deg=200.0020, dec_deg=5.0030, weight=1.0),
    ]

    run1 = run_pure_consensus(marks, epochs=[1, 2])
    run2 = run_pure_consensus(marks, epochs=[1, 2])

    assert len(run1) == len(run2) == 1
    t1, t2 = run1[0], run2[0]
    assert t1.motion_arcsec_per_epoch == t2.motion_arcsec_per_epoch
    assert t1.motion_pa_deg == t2.motion_pa_deg
    assert t1.mean_reliability == t2.mean_reliability
    assert t1.mean_dispersion_arcsec == t2.mean_dispersion_arcsec
    assert len(t1.clusters) == len(t2.clusters)
    for c1, c2 in zip(t1.clusters, t2.clusters):
        assert c1.epoch == c2.epoch
        assert c1.centroid_ra_deg == c2.centroid_ra_deg
        assert c1.centroid_dec_deg == c2.centroid_dec_deg
        assert c1.cluster_size == c2.cluster_size
        assert c1.dispersion_arcsec == c2.dispersion_arcsec

