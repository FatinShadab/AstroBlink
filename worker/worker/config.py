"""Worker configuration via environment variables.

See .env.example for all variables.
The worker connects directly to PostgreSQL (not through the API).
See ARCHITECTURE.md \u00a72.3.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL (direct access — worker does NOT run migrations)
    database_url: str = "postgresql://astroblink:astroblink_dev@localhost:5432/astroblink"

    # Redis (job queue)
    redis_url: str = "redis://localhost:6379/0"

    # MinIO / S3-compatible tile storage
    tile_s3_endpoint: str = "http://localhost:9000"
    tile_s3_bucket: str = "astroblink-tiles"
    tile_s3_access_key: str = "minioadmin"
    tile_s3_secret_key: str = "minioadmin"

    # SPHEREx S3 (anonymous access)
    spherex_s3_bucket: str = "nasa-irsa-spherex"
    spherex_s3_region: str = "us-east-1"

    # IRSA Cutout Service [VERIFY: OQ-1, OQ-4]
    irsa_cutout_base_url: str = (
        "https://irsa.ipac.caltech.edu/cgi-bin/Cutouts/nph-cutouts"
    )

    # Scratch directory for temporary FITS downloads (~500 MB peak)
    fits_scratch_dir: str = "/tmp/astroblink"

    # Redis queue key
    redis_queue_key: str = "astroblink:ingest_jobs"

    # BRPOP timeout in seconds (must be <= 5 per spec)
    brpop_timeout: int = 5

    # Heartbeat file path
    heartbeat_path: str = "/tmp/heartbeat"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
