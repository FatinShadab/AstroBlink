"""Unit tests for user reliability weighting and gold-standard evaluation (Phase C3)."""

from app.services.consensus import (
    MarkInput,
    compute_updated_reliability,
    evaluate_gold_classification,
)


def test_reliability_bayesian_update():
    """Verify reliability update from gold-standard subject performance."""
    # Prior is 0.5 with prior_weight=2.0
    # Initial state (0 total): returns prior (0.5)
    assert compute_updated_reliability(0, 0) == 0.5

    # 1 gold total, 1 hit: (1 + 1) / (1 + 2) = 2/3 ≈ 0.6667
    r1 = compute_updated_reliability(1, 1)
    assert 0.66 <= r1 <= 0.67

    # 1 gold total, 0 hit: (0 + 1) / (1 + 2) = 1/3 ≈ 0.3333
    r0 = compute_updated_reliability(1, 0)
    assert 0.33 <= r0 <= 0.34

    # Perfect user over 20 gold subjects: (20 + 1) / (20 + 2) = 21/22 ≈ 0.9545
    r_high = compute_updated_reliability(20, 20)
    assert r_high > 0.95

    # Spammer user over 20 gold subjects: (0 + 1) / (20 + 2) = 1/22 ≈ 0.0455 -> clamped to min 0.05
    r_low = compute_updated_reliability(20, 0)
    assert r_low == 0.05


def test_gold_classification_evaluation_hit():
    """User correctly identifies gold subject category and coordinates."""
    gold_expected = {
        "category": "asteroid_neo",
        "positions": [
            {"epoch": 1, "ra_deg": 180.0020, "dec_deg": -2.4980},
            {"epoch": 2, "ra_deg": 180.0050, "dec_deg": -2.4950},
        ],
    }

    # User marks within 5 arcsec
    user_marks = [
        MarkInput(user_id="u1", epoch=1, ra_deg=180.0022, dec_deg=-2.4981),
        MarkInput(user_id="u1", epoch=2, ra_deg=180.0048, dec_deg=-2.4952),
    ]

    is_hit = evaluate_gold_classification("asteroid_neo", user_marks, gold_expected, position_tolerance_arcsec=15.0)
    assert is_hit is True


def test_gold_classification_evaluation_miss_wrong_category():
    """User identifies wrong category on gold subject."""
    gold_expected = {
        "category": "asteroid_neo",
        "positions": [
            {"epoch": 1, "ra_deg": 180.0020, "dec_deg": -2.4980},
        ],
    }
    user_marks = [
        MarkInput(user_id="u1", epoch=1, ra_deg=180.0020, dec_deg=-2.4980),
    ]
    is_hit = evaluate_gold_classification("comet", user_marks, gold_expected)
    assert is_hit is False


def test_gold_classification_evaluation_miss_distant_marks():
    """User marks distant location (e.g. noise or wrong target)."""
    gold_expected = {
        "category": "asteroid_neo",
        "positions": [
            {"epoch": 1, "ra_deg": 180.0020, "dec_deg": -2.4980},
        ],
    }
    user_marks = [
        MarkInput(user_id="u1", epoch=1, ra_deg=180.0500, dec_deg=-2.4980),  # > 150 arcsec away
    ]
    is_hit = evaluate_gold_classification("asteroid_neo", user_marks, gold_expected, position_tolerance_arcsec=15.0)
    assert is_hit is False
