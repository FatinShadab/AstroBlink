# Database → Managed PostgreSQL + pgSphere

## ⚠️ pgSphere Hosting Constraint

**No major managed PostgreSQL provider supports the pgSphere extension.**

Verified as of October 2026:

| Provider | pgSphere Support | Notes |
|----------|-----------------|-------|
| AWS RDS | ❌ | Not in supported extensions list |
| Google Cloud SQL | ❌ | Not available |
| Azure Database for PostgreSQL | ❌ | Not available |
| Supabase | ❌ | Not in extension catalog |
| Neon | ❌ | Limited extension support |
| Render Managed PostgreSQL | ❌ | No custom extensions |
| DigitalOcean Managed DB | ❌ | No custom extensions |

## Recommended Approach

### Self-hosted PostgreSQL on a VM

1. Provision a VM (e.g., AWS EC2, GCP Compute Engine, DigitalOcean Droplet).
2. Install PostgreSQL 16:
   ```bash
   sudo apt-get install postgresql-16 postgresql-16-pgsphere
   ```
3. Configure `pg_hba.conf` for remote connections (TLS required).
4. Run migrations: `DATABASE_URL=... alembic upgrade head`

### Docker on a VM

Use the custom image from `infra/postgres/Dockerfile`:
```bash
docker build -t astroblink-postgres infra/postgres/
docker run -d \
  -e POSTGRES_USER=astroblink \
  -e POSTGRES_PASSWORD=<strong-password> \
  -e POSTGRES_DB=astroblink \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  astroblink-postgres
```

## Fallback: Drop pgSphere

If self-hosting PostgreSQL is not feasible, the DDL can be modified to:
1. Replace `spoint` columns with `FLOAT` pairs (`ra_rad`, `dec_rad`).
2. Replace GiST spatial indexes with B-tree indexes on `ra_deg`/`dec_deg`.
3. Implement haversine distance in application code (Python/SQL function).

This is functional but loses the elegant spatial indexing.
See ARCHITECTURE.md §3.1 for the pgSphere decision rationale.

## Required Configuration

| Variable | Example |
|----------|---------|
| `POSTGRES_USER` | `astroblink` |
| `POSTGRES_PASSWORD` | `<strong-random-password>` |
| `POSTGRES_DB` | `astroblink` |
| `DATABASE_URL` | `postgresql://astroblink:<password>@<host>:5432/astroblink` |
