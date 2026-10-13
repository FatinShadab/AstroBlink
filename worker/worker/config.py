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

    # IRSA SPHEREx Cutout Service (verified endpoint pattern per docs/VERIFIED_FACTS.md)
    irsa_cutout_base_url: str = (
        "https://irsa.ipac.caltech.edu/ibe/data/spherex"
    )

    # SPHEREx S3 Level 2 prefix pattern (verified qr2/level2/ per docs/VERIFIED_FACTS.md)
    # [VERIFY] Future DR1/DR2 release prefixes are unconfirmed in bucket.
    spherex_level2_prefix: str = "qr2/level2/"

    # Scratch directory for temporary FITS downloads (~500 MB peak)
    fits_scratch_dir: str = "/tmp/astroblink"

    # Redis queue key
    redis_queue_key: str = "astroblink:ingest_jobs"

    # BRPOP timeout in seconds (must be <= 5 per spec)
    brpop_timeout: int = 5

    # Heartbeat file path
    heartbeat_path: str = "/tmp/heartbeat"

    # Data-driven survey epoch clustering thresholds
    # [VERIFY] Empirical gap threshold separating 6-month survey passes (~140-195 days between sweeps)
    survey_epoch_gap_days: float = 30.0
    # [VERIFY] Half-year survey period for Continuous Viewing Zone (CVZ) targets where observations have no 30-day gap
    cvz_epoch_span_days: float = 182.5

    # Wavelength-matched exposure selection
    # Target wavelengths in microns (mapped to D1 ~ 1.0um, D3 ~ 2.0um, D5 ~ 4.0um)
    target_wavelengths_um: list[float] = [1.0, 2.0, 4.0]
    # Per-detector tolerance factor k where tol = k * (lambda / R) using R from TAP
    wavelength_tol_k: float = 1.0
    # Use epochs 1 and 2 only for blinking by default; set True to include epoch 3
    include_epoch_3: bool = False
    # [VERIFY] Maximum evenly-spaced candidate exposures per detector per epoch to inspect (~18-20 steps per LVF sweep)
    max_candidates_per_det_epoch: int = 30
    min_cutout_coverage: float = 0.95
    # Deterministic tie-break threshold (um) and marginal match criteria
    tie_break_tol_um: float = 0.002
    marginal_err_fraction: float = 0.60
    marginal_min_overlap_um: float = 0.01

    # Default cutout angular size in degrees (W12 assumed design: 0.5 deg at native 6.15"/px)
    default_size_deg: float = 0.5

    # FLAGS masking: whether to mask Bit 0 (MP_TRANSIENT) and Bit 19 (MP_OUTLIER) (default: True / masked)
    mask_transient_and_outlier_flags: bool = True

    # S3 ranged read & runtime limits
    s3_connect_timeout: int = 10
    s3_read_timeout: int = 30
    s3_max_retries: int = 4
    s3_parallel_threads: int = 6
    tap_timeout_sec: float = 30.0
    tap_max_retries: int = 3
    max_scratch_bytes: int = 500 * 1024 * 1024  # 500 MiB total scratch budget
    job_timeout_sec: float = 600.0  # Per-job execution time cap in seconds

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
