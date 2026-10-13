"""Tile renderer: asinh stretch + WebP/PNG output with masked pixel hatching.

Rules:
- Strictly under 250 KB per epoch per band (asserted at runtime).
- If tile exceeds 250 KB, adjust quality or resize until within budget.
- Lupton et al. asinh stretch for high dynamic range astronomical imagery.
- Distinct hatching pattern for masked / invalid pixels (semi-transparent red diagonal pattern).
- Upload to tile store (MinIO/S3) with env-driven credentials.

See ARCHITECTURE.md §2.3, PRD §6.1, ROADMAP P1-12.
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any

import boto3
import numpy as np
from PIL import Image, ImageDraw

from worker.config import settings

logger = logging.getLogger(__name__)

MAX_TILE_BYTES: int = 250 * 1024  # 250 KB


def asinh_stretch(
    image: np.ndarray,
    nonlinearity: float = 3.0,
    p_low: float = 1.0,
    p_high: float = 99.5,
) -> np.ndarray:
    """Apply arcsinh stretch (Lupton et al.) to normalize an image to [0, 255] uint8.

    Args:
        image: 2D float array.
        nonlinearity: Softening parameter Q.
        p_low: Lower percentile for background subtraction.
        p_high: Upper percentile for scaling.

    Returns:
        2D uint8 array with values in [0, 255].
    """
    valid_pixels = image[np.isfinite(image)]
    if len(valid_pixels) == 0:
        return np.zeros(image.shape, dtype=np.uint8)

    v_min = float(np.percentile(valid_pixels, p_low))
    v_max = float(np.percentile(valid_pixels, p_high))
    if v_max <= v_min:
        v_max = v_min + 1.0

    # Subtract background and scale
    scaled = (image - v_min) / (v_max - v_min)
    scaled = np.clip(scaled, 0.0, None)

    # arcsinh stretch: asinh(Q * x) / asinh(Q)
    stretched = np.arcsinh(nonlinearity * scaled) / np.arcsinh(nonlinearity)
    stretched = np.clip(stretched * 255.0, 0.0, 255.0)

    return np.nan_to_num(stretched, nan=0.0).astype(np.uint8)


def create_hatching_overlay(width: int, height: int, spacing: int = 6) -> Image.Image:
    """Create a semi-transparent red diagonal hatching pattern overlay.

    Args:
        width: Image width in pixels.
        height: Image height in pixels.
        spacing: Pixel distance between diagonal lines.

    Returns:
        RGBA PIL Image.
    """
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    # Semi-transparent red: RGBA(255, 40, 40, 160)
    line_color = (255, 40, 40, 160)

    for offset in range(-height, width + height, spacing):
        draw.line([(offset, 0), (offset + height, height)], fill=line_color, width=1)

    return overlay


def render_tile_image(
    image_data: np.ndarray,
    mask: np.ndarray,
    fmt: str = "webp",
    quality: int = 85,
    flagged_visible_mask: np.ndarray | None = None,
) -> bytes:
    """Render image data + mask to compressed image bytes under 250 KB.

    Args:
        image_data: 2D float array (grayscale) or 3D float array (RGB channels, shape (3, H, W) or (H, W, 3)).
        mask: 2D boolean array (True = masked).
        fmt: Target image format ('webp' or 'png').
        quality: Initial compression quality (for webp).
        flagged_visible_mask: Optional 2D boolean array for 'flagged but visible' pixels
            (e.g. Bit 0 MP_TRANSIENT / Bit 19 MP_OUTLIER) where underlying flux is kept
            and highlighted with a distinct semi-transparent cyan overlay.

    Returns:
        Encoded image bytes, guaranteed < 250 KB.
    """
    ny, nx = mask.shape

    if image_data.ndim == 2:
        # Grayscale single band (SWIR or MWIR)
        stretched = asinh_stretch(image_data)
        base_img = Image.fromarray(stretched, mode="L").convert("RGBA")
    elif image_data.ndim == 3:
        # 3-channel composite
        if image_data.shape[0] == 3 and image_data.shape[1] == ny:
            r = asinh_stretch(image_data[0])
            g = asinh_stretch(image_data[1])
            b = asinh_stretch(image_data[2])
        else:
            r = asinh_stretch(image_data[:, :, 0])
            g = asinh_stretch(image_data[:, :, 1])
            b = asinh_stretch(image_data[:, :, 2])
        rgb = np.stack([r, g, b], axis=-1)
        base_img = Image.fromarray(rgb, mode="RGB").convert("RGBA")
    else:
        raise ValueError(f"Unsupported image shape {image_data.shape}")

    # Draw distinct semi-transparent cyan highlight on 'flagged but visible' pixels (keeping flux visible)
    if flagged_visible_mask is not None and np.any(flagged_visible_mask):
        vis_mask = flagged_visible_mask & (~mask)
        if np.any(vis_mask):
            tint = Image.new("RGBA", (nx, ny), (0, 220, 255, 95))
            alpha_layer = Image.fromarray((vis_mask * 95).astype(np.uint8), mode="L")
            tint.putalpha(alpha_layer)
            base_img = Image.alpha_composite(base_img, tint)

    # Draw hatching on masked pixels
    if np.any(mask):
        hatching = create_hatching_overlay(nx, ny)
        mask_pil = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
        base_img.paste(hatching, (0, 0), mask=mask_pil)

    # Encode and ensure < 250 KB
    cur_fmt = fmt.lower()
    cur_q = quality

    while True:
        buf = io.BytesIO()
        if cur_fmt == "webp":
            base_img.save(buf, format="WEBP", quality=cur_q, method=4)
        else:
            base_img.save(buf, format="PNG", optimize=True)

        data = buf.getvalue()
        if len(data) <= MAX_TILE_BYTES:
            break

        # If too large, reduce quality (webp) or resize if png
        if cur_fmt == "webp" and cur_q > 20:
            cur_q -= 15
            logger.warning("Tile size %d exceeds 250 KB. Reducing WebP quality to %d", len(data), cur_q)
        else:
            new_w = max(16, int(base_img.width * 0.8))
            new_h = max(16, int(base_img.height * 0.8))
            logger.warning("Tile size %d exceeds 250 KB. Resizing to (%d, %d)", len(data), new_w, new_h)
            base_img = base_img.resize((new_w, new_h), Image.Resampling.BILINEAR)

    assert len(data) <= MAX_TILE_BYTES, f"Tile size {len(data)} exceeds 250 KB limit"
    return data


def get_tile_s3_client():
    """Create a boto3 S3 client for the tile object store (MinIO or cloud)."""
    return boto3.client(
        "s3",
        endpoint_url=settings.tile_s3_endpoint,
        aws_access_key_id=settings.tile_s3_access_key,
        aws_secret_access_key=settings.tile_s3_secret_key,
        region_name="us-east-1",
    )


def upload_tile(
    tile_bytes: bytes,
    object_key: str,
    content_type: str = "image/webp",
) -> str:
    """Upload tile image or sidecar JSON to the tile S3 bucket.

    Args:
        tile_bytes: File contents in bytes.
        object_key: S3 object key (e.g. '{subject_id}/{epoch}_{band}.webp').
        content_type: MIME type.

    Returns:
        The object_key stored.
    """
    s3 = get_tile_s3_client()
    s3.put_object(
        Bucket=settings.tile_s3_bucket,
        Key=object_key,
        Body=tile_bytes,
        ContentType=content_type,
    )
    return object_key
