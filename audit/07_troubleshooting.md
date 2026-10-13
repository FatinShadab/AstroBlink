# AstroBlink — Troubleshooting Guide

**Purpose:** Exhaustive catalog of verified failure modes, container errors, Windows-specific environment quirks, astronomical data gotchas, and proven operational fixes.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. Quick Reference: Symptom & Solution Matrix

| # | Symptom / Error Message | Root Cause | Verified Solution |
| :-: | :--- | :--- | :--- |
| **1** | Container exits with code `137` | WSL2 / Docker OOMKilled (out of memory). | Add `memory=8GB` to `C:\Users\<User>\.wslconfig` and restart WSL [VERIFIED]. |
| **2** | `Bind for 0.0.0.0:xxxx failed: port is already allocated` | Port conflict with active stack or Windows Hyper-V reserved range. | Check `Get-NetTCPConnection` and `netsh excludedportrange`; change port offset in `.env` [VERIFIED]. |
| **3** | `docker compose` fails with invalid YAML or `.env` parsing error | PowerShell created `.env` with UTF-16 LE or UTF-8 BOM encoding. | Save `.env` as pure UTF-8 without BOM via `Set-Content -Encoding utf8NoBOM` or VS Code [VERIFIED]. |
| **4** | Vim editor opens unexpectedly during `git merge` | Default Git merge editor on Windows. | Always pass `--no-edit` flag: `git merge <branch> --no-edit` [VERIFIED]. |
| **5** | `'make' is not recognized as an internal or external command` | Windows PowerShell lacks GNU `make`. | Use plain `docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml ...` [VERIFIED]. |
| **6** | Scripts at `/build/scripts/seed_dev.py` not found inside container | Docker Compose only merged `docker-compose.yml`, omitting `override.yml`. | Always pass both `-f infra/docker-compose.yml -f infra/docker-compose.override.yml` [VERIFIED]. |
| **7** | Client browser cannot load tiles (`net::ERR_CONNECTION_REFUSED`) | `TILE_BASE_URL` set to internal container host `http://minio:9000`. | Set `TILE_BASE_URL` to host-accessible port (e.g. `http://localhost:9000/astroblink-tiles`) [VERIFIED]. |
| **8** | Worker container marked `unhealthy` after startup | Local heartbeat file `/tmp/heartbeat` missing or stale (>30s). | Check worker daemon thread logs; ensure background loop has write permissions [VERIFIED]. |
| **9** | IRSA Cutout API returns `502 Bad Gateway` / `503 Service Unavailable` | Caltech/IPAC IBE upstream cutout service downtime or overload. | Worker automatically bypasses IBE using direct anonymous S3 ranged reads [VERIFIED]. |
| **10**| Evaluated wavelengths shift by ~0.0004 µm and pixels shift by ~2.5 px | Astropy read only first 4 FITS blocks (11,520 B), truncating SIP polynomial. | Read header in 2880-byte blocks iteratively through the `END` card [VERIFIED]. |
| **11**| `ERROR: extension "pg_sphere" is not available` on migration | Standard `postgres:16-alpine` image used without pgSphere build. | Build custom postgres image via `infra/postgres/Dockerfile` containing pgSphere [VERIFIED]. |
| **12**| `FileNotFoundError: ingest_job.yaml not found` during worker tests | Standalone worker container lacks `/contracts` directory mount. | Mount `./contracts:/contracts:ro` via `docker-compose.override.yml` [VERIFIED]. |
| **13**| `ModuleNotFoundError: No module named 'jsonschema'` during API tests | `jsonschema` was added in C7 tests but omitted from `requirements-dev.txt`. | Run pytest ignoring contract test: `pytest tests/ --ignore=tests/test_contract_validation.py` [VERIFIED]. |
| **14**| Worker logs `Invalid job payload ... Expecting property name in double quotes` | PowerShell CLI stripped inner double quotes when running `redis-cli lpush`. | Push JSON safely using a python one-liner inside the `api` container [VERIFIED]. |
| **15**| `Invoke-WebRequest` hangs indefinitely on Windows PowerShell | PowerShell 5.1 attempts to initialize Internet Explorer DOM parser. | Pass `-UseBasicParsing` to `Invoke-WebRequest` or use `curl.exe` [VERIFIED]. |
| **16**| Worker job fails with `TimeoutError: Job exceeded per-job time cap (600s)` | Slower network connection (<100 KB/s to `us-east-1`) exceeded 10-minute cap. | Increase `job_timeout_sec` in `worker/worker/config.py` or `.env` to `1200` [VERIFIED]. |
| **17**| Worker crashes with `ScratchBudgetExceededError: Scratch usage > 500 MB` | Accumulated temporary FITS files exceeded scratch limit. | Worker auto-cleans on job start; verify `max_scratch_bytes=524288000` is sufficient [VERIFIED]. |

---

## 2. In-Depth Problem Diagnoses & Solutions

### Issue 1: WSL2 Memory Limit & Exit Code 137 [VERIFIED]
- **Symptoms:** Container abruptly exits with code `137`; Docker daemon crashes during AstroBlink builds.
- **Root Cause:** By default, WSL2 on Windows can consume available host RAM until Windows terminates the WSL2 virtual machine. When AstroBlink compiles the Next.js client or installs heavy Astropy dependencies simultaneously, WSL2 runs out of memory.
- **Solution:**
  1. Create or edit `C:\Users\<Username>\.wslconfig` in Windows:
     ```ini
     [wsl2]
     memory=8GB
     processors=4
     swap=4GB
     ```
  2. Open PowerShell as Administrator and restart WSL:
     ```powershell
     wsl --shutdown
     ```
  3. Restart Docker Desktop.

---

### Issue 2: Windows Port Exclusion Ranges [VERIFIED]
- **Symptoms:** `docker compose up` fails with:
  `Error response from daemon: Ports are not available: listen tcp 0.0.0.0:xxxx: bind: An attempt was made to access a socket in a way forbidden by its access permissions.`
- **Root Cause:** Windows Hyper-V, WSL2, and the Host Network Service (HNS) dynamically reserve large port ranges for internal routing upon every reboot.
- **Diagnosis:**
  View the active exclusion ranges:
  ```powershell
  netsh interface ipv4 show excludedportrange protocol=tcp
  ```
- **Solution:** Select an alternate port offset that does not fall into any reported range and update `.env` (e.g. use `5440` instead of `5432`).

---

### Issue 3: PowerShell `.env` Encoding and UTF-8 BOM [VERIFIED]
- **Symptoms:** `docker compose` fails with errors like:
  `parsing .env: invalid character '\ufeff' at line 1` or fails to recognize variable assignments.
- **Root Cause:** Windows PowerShell 5.1 `Set-Content` and `Out-File` write UTF-16 Little Endian by default, or attach a 3-byte Byte Order Mark (`EF BB BF`) in UTF-8 mode. Docker Compose requires strictly raw ASCII / UTF-8 without BOM.
- **Solution:**
  In PowerShell Core 7+:
  ```powershell
  Set-Content -Path .env -Value $content -Encoding utf8NoBOM
  ```
  In Windows PowerShell 5.1:
  ```powershell
  [System.IO.File]::WriteAllLines((Join-Path (Get-Location) ".env"), $lines, (New-Object System.Text.UTF8Encoding($false)))
  ```

---

### Issue 4: Docker Compose Bind Mounts Missing Without `override.yml` [VERIFIED]
- **Symptoms:**
  - Running `seed_dev.py` fails with: `python: can't open file '/build/scripts/seed_dev.py': [Errno 2] No such file or directory`.
  - Worker tests fail with: `FileNotFoundError: ingest_job.yaml not found`.
- **Root Cause:** When running `docker compose` from the project root with `-f infra/docker-compose.yml`, Docker Compose **does not** automatically look for `infra/docker-compose.override.yml`. It only looks in the current working directory.
- **Solution:** Always pass both files explicitly:
  ```powershell
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p <project> <subcommand>
  ```

---

### Issue 5: Missing `jsonschema` in API Container Tests [VERIFIED]
- **Symptoms:** Running `python -m pytest tests/` inside the `api` container fails during collection:
  `ImportError: No module named 'jsonschema'` in `tests/test_contract_validation.py`.
- **Root Cause:** Commit `61209b8` added `test_contract_validation.py` using `import jsonschema`, but `jsonschema` was never added to `api/requirements-dev.txt`.
- **Solution:** Run pytest ignoring the unbundled contract test until `requirements-dev.txt` is updated:
  ```powershell
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink exec api python -m pytest tests/ --ignore=tests/test_contract_validation.py -v
  ```

---

### Issue 6: PowerShell Double-Quote Stripping on Redis LPUSH [VERIFIED]
- **Symptoms:** Worker logs:
  `[ERROR] worker: Invalid job payload: {job_id:...,ra:...} — Expecting property name enclosed in double quotes`.
- **Root Cause:** PowerShell treats double quotes inside strings as string delimiters and strips them before passing arguments to `docker compose exec`.
- **Solution:** Use Python inside the `api` container to enqueue JSON cleanly via `json.dumps()`:
  ```powershell
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink exec api python -c "import redis, json; r=redis.from_url('redis://redis:6379/0'); r.lpush('astroblink:ingest_jobs', json.dumps({'job_id': '00000000-0000-0000-0000-000000000099', 'ra': 160.61529, 'dec': 30.66915, 'size_deg': 0.5}))"
  ```

---

### Issue 7: Worker Job Time Cap Exceeded (`TimeoutError`) [VERIFIED]
- **Symptoms:** Worker logs:
  `[ERROR] worker: Error processing job ... Job exceeded per-job time cap (645.70s > 600.00s) ... TimeoutError`.
- **Root Cause:** A $0.5^\circ$ cutout downloads ~60 MB across multiple ranged slices from AWS S3 (`us-east-1`). On slower international connections (<100 KB/s), the total download and reprojection time can exceed the default 10-minute cap (`settings.job_timeout_sec = 600.0`).
- **Solution:** Increase the timeout limit in `.env` or `worker/worker/config.py`:
  ```ini
  JOB_TIMEOUT_SEC=1200
  ```

---

### Issue 8: FITS Header Truncation and Wavelength Shifts [VERIFIED]
- **Symptoms:** Reprojected cutouts have pixel positions offset by up to 2.5 pixels and central wavelengths shifted by $\sim 0.0004\text{ }\mu\text{m}$.
- **Root Cause:** SPHEREx Level 2 `IMAGE` headers span 5 FITS blocks (14,400 bytes). Reading only 4 blocks (11,520 bytes) truncates the tail of the `TAN-SIP` distortion polynomials (`A_*_*`, `B_*_*`).
- **Solution:** Always read headers in 2880-byte increments until the `END` card card is encountered (`fits_parser.py::_read_header_until_end`).

---

### Issue 9: Browser vs. Container URLs for Tile Serving [VERIFIED]
- **Symptoms:** Next.js client renders broken image icons for tiles; browser console logs `ERR_NAME_NOT_RESOLVED` for `http://minio:9000/...`.
- **Root Cause:** `minio:9000` is an internal Docker bridge hostname resolvable only inside containers. The user's web browser runs on the host machine and can only resolve `localhost:<MINIO_PORT>`.
- **Solution:** Ensure `TILE_BASE_URL` in `.env` is set to the host-reachable URL (e.g. `http://localhost:9000/astroblink-tiles` or `http://localhost:9100/astroblink-tiles` for worktrees).
