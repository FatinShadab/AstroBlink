# ==============================================================
# PostgreSQL 16 + pgSphere extension
# ==============================================================
FROM postgres:16-bookworm

# Install pgSphere from Debian packages.
# If postgresql-16-pgsphere is not in the default repos,
# fall back to building from source (see comments below).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-16-pgsphere \
    && rm -rf /var/lib/apt/lists/*

# Fallback: build pgSphere from source (uncomment if apt fails).
# RUN apt-get update \
#     && apt-get install -y --no-install-recommends \
#         build-essential postgresql-server-dev-16 git \
#     && git clone --depth 1 https://github.com/postgrespro/pgsphere.git /tmp/pgsphere \
#     && cd /tmp/pgsphere \
#     && USE_PGXS=1 make \
#     && USE_PGXS=1 make install \
#     && rm -rf /tmp/pgsphere \
#     && apt-get purge -y build-essential postgresql-server-dev-16 git \
#     && apt-get autoremove -y \
#     && rm -rf /var/lib/apt/lists/*

# The extension is created by the Alembic migration:
#   CREATE EXTENSION IF NOT EXISTS pg_sphere;
