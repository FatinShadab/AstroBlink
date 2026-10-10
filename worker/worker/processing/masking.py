"""FLAGS bitmask and airglow masking.

Known FLAGS bits: 0 TRANSIENT, 1 OVERFLOW, 2 SUR_ERROR, 6 NONFUNC,
7 DICHROIC, 9 MISSING_DATA, 25 STREAK, 26 BLOOM, 27 SNOWBALL,
28 HALO, 29 SATELLITE_HALO.

[VERIFY: OQ-2] Bits 3-5, 8, 10-24 undocumented. Mask conservatively.
He I 1.083 µm airglow: mask CWAVE in [1.075, 1.091] µm.
See ARCHITECTURE.md §2.3, ROADMAP P1-10.
"""

KNOWN_FLAG_BITS = {
    0: "TRANSIENT", 1: "OVERFLOW", 2: "SUR_ERROR",
    6: "NONFUNC", 7: "DICHROIC", 9: "MISSING_DATA",
    25: "STREAK", 26: "BLOOM", 27: "SNOWBALL",
    28: "HALO", 29: "SATELLITE_HALO",
}

HE_AIRGLOW_RANGE = (1.075, 1.091)


def apply_flags_mask(flags_data):
    """Create boolean mask from FLAGS bitmask. Stub."""
    raise NotImplementedError("FLAGS masking not yet implemented.")


def apply_airglow_mask(cwave_map):
    """Mask pixels in the He I 1.083 µm airglow band. Stub."""
    raise NotImplementedError("Airglow masking not yet implemented.")
