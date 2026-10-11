"""Application configuration via environment variables.

See .env.example for all variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL
    database_url: str = "postgresql+asyncpg://astroblink:astroblink_dev@localhost:5432/astroblink"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MinIO / S3-compatible tile storage
    tile_s3_endpoint: str = "http://localhost:9000"
    tile_s3_bucket: str = "astroblink-tiles"
    tile_s3_access_key: str = "minioadmin"
    tile_s3_secret_key: str = "minioadmin"
    tile_base_url: str = "http://localhost:9000/astroblink-tiles"

    # JWT
    secret_key: str = "dev-secret-change-in-production"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Consensus & Ingestion settings
    consensus_eps_pixels: float = 1.5
    pixel_scale_arcsec: float = 6.15
    min_load_time_ms: int = 3000
    retirement_threshold: int = 10

    # Uvicorn
    port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
