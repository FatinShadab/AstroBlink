"""Tile renderer: asinh stretch + WebP/PNG output.

Rules: < 250 KB per epoch per band. Masked pixels get hatching.
See ARCHITECTURE.md §2.3, ROADMAP P1-12.
"""

MAX_TILE_BYTES = 250 * 1024


def render_tile(image_data, mask, output_path: str, fmt: str = "webp", quality: int = 85) -> str:
    """Render a co-added image as a WebP/PNG tile. Stub."""
    raise NotImplementedError("Tile renderer not yet implemented.")
