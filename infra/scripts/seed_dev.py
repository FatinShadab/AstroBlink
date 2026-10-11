#!/usr/bin/env python3
"""Seed script for local development (Phase C1).

Creates 2 fake subjects, each with 2 epochs (epochs 1 and 2).
Generates simple 128x128 PNG images (deterministic star/noise field with a
bright source dot that moves between epochs 1 and 2), uploads them to MinIO,
and upserts the subject rows (plus a default demo user) into PostgreSQL.

Idempotent: safe to run multiple times.
"""

from __future__ import annotations

import json
import os
import random
import struct
import zlib

import boto3
import psycopg2

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

SUBJECTS = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "ra_deg": 180.0,
        "dec_deg": -2.5,
        "size_deg": 0.1,
        "epochs": [1, 2],
        "dot_positions": {1: (48, 56), 2: (76, 68)},
        "seed": 101,
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "ra_deg": 215.5,
        "dec_deg": 12.25,
        "size_deg": 0.1,
        "epochs": [1, 2],
        "dot_positions": {1: (82, 44), 2: (54, 72)},
        "seed": 202,
    },
]

BANDS = ["swir", "mwir", "rgb"]


def _make_png(width: int, height: int, dot_x: int, dot_y: int, band: str, rng_seed: int) -> bytes:
    """Generate a valid RGB PNG image with a noise/star background and a moving bright dot."""
    rng = random.Random(rng_seed)

    # Band tint multipliers so bands look visually distinct while keeping the same band comparable across epochs
    tint = {
        "swir": (0.8, 0.9, 1.0),
        "mwir": (1.0, 0.85, 0.65),
        "rgb": (0.9, 1.0, 0.9),
    }.get(band, (1.0, 1.0, 1.0))

    # Pre-generate static background stars for this subject
    stars = [(rng.randint(4, width - 5), rng.randint(4, height - 5), rng.randint(140, 210)) for _ in range(18)]

    raw_rows = bytearray()
    for y in range(height):
        raw_rows.append(0)  # PNG filter type 0 (None)
        for x in range(width):
            # Subtle deterministic noise
            noise = ((x * 37 + y * 53 + rng_seed * 17) % 19) + 10
            r = int(noise * tint[0])
            g = int(noise * tint[1])
            b = int(noise * tint[2])

            # Static background stars
            for sx, sy, sbright in stars:
                if abs(x - sx) <= 1 and abs(y - sy) <= 1:
                    r = min(255, int(sbright * tint[0]))
                    g = min(255, int(sbright * tint[1]))
                    b = min(255, int(sbright * tint[2]))

            # Moving target dot (bright core + soft halo)
            dx = x - dot_x
            dy = y - dot_y
            dist_sq = dx * dx + dy * dy
            if dist_sq <= 4:
                r, g, b = 255, 255, 255
            elif dist_sq <= 16:
                r = min(255, int(220 * tint[0]))
                g = min(255, int(220 * tint[1]))
                b = min(255, int(220 * tint[2]))

            raw_rows.extend((r, g, b))

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(bytes(raw_rows), level=6)
    return b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", idat) + _chunk(b"IEND", b"")


def main() -> None:
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://astroblink:astroblink_dev@postgres:5432/astroblink",
    ).replace("postgresql+asyncpg://", "postgresql://")

    s3_endpoint = os.environ.get("TILE_S3_ENDPOINT", "http://minio:9000")
    s3_bucket = os.environ.get("TILE_S3_BUCKET", "astroblink-tiles")
    s3_access_key = os.environ.get("TILE_S3_ACCESS_KEY", "minioadmin")
    s3_secret_key = os.environ.get("TILE_S3_SECRET_KEY", "minioadmin")

    s3 = boto3.client(
        "s3",
        endpoint_url=s3_endpoint,
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
        region_name="us-east-1",
    )

    # Ensure bucket exists
    existing_buckets = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
    if s3_bucket not in existing_buckets:
        s3.create_bucket(Bucket=s3_bucket)

    conn = psycopg2.connect(db_url)
    try:
        with conn, conn.cursor() as cur:
            # Upsert default demo user for unauthenticated MVP classifications
            cur.execute(
                """
                INSERT INTO users (id, display_name, email, role, reliability)
                VALUES (%s, %s, %s, 'volunteer', 0.8)
                ON CONFLICT (id) DO NOTHING
                """,
                (DEMO_USER_ID, "demo-classifier", "demo@astroblink.local"),
            )

            for subj in SUBJECTS:
                subject_id = subj["id"]
                tile_urls: dict[str, str] = {}

                for epoch in subj["epochs"]:
                    dot_x, dot_y = subj["dot_positions"][epoch]
                    for band in BANDS:
                        png_bytes = _make_png(128, 128, dot_x, dot_y, band, subj["seed"])
                        object_key = f"{subject_id}/{epoch}_{band}.png"
                        s3.put_object(
                            Bucket=s3_bucket,
                            Key=object_key,
                            Body=png_bytes,
                            ContentType="image/png",
                        )
                        tile_urls[f"{epoch}_{band}"] = object_key

                cur.execute(
                    """
                    INSERT INTO subjects (
                        id, position, ra_deg, dec_deg, size_deg,
                        epochs, tile_urls, is_gold_standard, retired, classification_count
                    )
                    VALUES (
                        %s,
                        spoint(radians(%s), radians(%s)),
                        %s, %s, %s,
                        %s, %s::jsonb, FALSE, FALSE, 0
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        position = EXCLUDED.position,
                        ra_deg = EXCLUDED.ra_deg,
                        dec_deg = EXCLUDED.dec_deg,
                        size_deg = EXCLUDED.size_deg,
                        epochs = EXCLUDED.epochs,
                        tile_urls = EXCLUDED.tile_urls
                    """,
                    (
                        subject_id,
                        subj["ra_deg"],
                        subj["dec_deg"],
                        subj["ra_deg"],
                        subj["dec_deg"],
                        subj["size_deg"],
                        subj["epochs"],
                        json.dumps(tile_urls),
                    ),
                )
                print(f"Seeded subject {subject_id} with {len(tile_urls)} tiles in s3://{s3_bucket}/{subject_id}/")
    finally:
        conn.close()

    print("Seed complete.")


if __name__ == "__main__":
    main()
