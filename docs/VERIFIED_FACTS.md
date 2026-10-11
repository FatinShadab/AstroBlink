# SPHEREx Verified Facts (Phase D De-Risking)

Generated: `2026-10-11`

This document records facts verified against:
1. One live anonymous `list_objects_v2` call and FITS HDU byte-range inspection on `s3://nasa-irsa-spherex` (`us-east-1`).
2. One live HTTP request to the IRSA SPHEREx Cutout Service (`https://irsa.ipac.caltech.edu/ibe/data/spherex/...`) plus official IRSA documentation.

Anything that could not be confirmed from a live response is explicitly marked **UNCONFIRMED**.

---

## 1. IRSA SPHEREx Cutout Service URL & Parameter Names (OQ-1, OQ-4, OQ-7)

### Verified Endpoint & Query Parameters (from Official IRSA Docs)
- **Base URL Pattern:** `https://irsa.ipac.caltech.edu/ibe/data/spherex/{release_path_to_fits}`
  *(Note: The scaffold placeholder `https://irsa.ipac.caltech.edu/cgi-bin/Cutouts/nph-cutouts?pos=...` is **not** the SPHEREx cutout endpoint and returns `HTTP/1.1 502 Bad Gateway`.)*
- **Real Query Parameter Names:**
  - `center`: Comma-separated RA and Dec in decimal degrees, e.g. `center=156.09328159,-41.64466331` or `center=210.80227,54.34895d`.
  - `size`: Angular cutout size in degrees, e.g. `size=0.1`.
  - Band/detector selection is **not** a cutout query parameter; each SPHEREx Level 2 MEF file is already per-detector (`1D1`..`4D6`), and detector filtering is performed during discovery via TAP (`p.energy_bandpassname = 'SPHEREx-D2'`) or S3 key path (`/2/`).

**Quoted Source 1 (`https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html`):**
> `curl -o cutout.fits "https://irsa.ipac.caltech.edu/ibe/data/spherex/qr/level2/2025W19_2B/l2b-v11-2025-163/3/level2_2025W19_2B_0073_2D3_spx_l2b-v11-2025-163.fits?center=156.09328159,-41.64466331&size=0.1"`

**Quoted Source 2 (`https://raw.githubusercontent.com/Caltech-IPAC/irsa-tutorials/main/tutorials/spherex/spherex_cutouts.md`):**
```sql
SELECT
    'https://irsa.ipac.caltech.edu/' || a.uri || '?center={ra.value},{dec.value}d&size={size.value}' AS uri,
    p.time_bounds_lower
FROM spherex.artifact a
JOIN spherex.plane p ON a.planeid = p.planeid
WHERE 1 = CONTAINS(POINT('ICRS', {ra.value}, {dec.value}), p.poly)
        AND p.energy_bandpassname = '{bandpass}'
ORDER BY p.time_bounds_lower
```

### Live Cutout Service HTTP Response
- **Request:**
  ```text
  GET https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_1D2_spx_l2b-v20-2025-240.fits?center=164.705590379,29.1388961408d&size=0.1
  ```
- **Actual Response:**
  ```http
  HTTP/1.1 503 Service Temporarily Unavailable
  Server: nginx
  Date: Sun, 11 Oct 2026 06:15:51 GMT
  Content-Type: text/html
  Content-Length: 190
  Connection: keep-alive

  <html>
  <head><title>503 Service Temporarily Unavailable</title></head>
  <body>
  <center><h1>503 Service Temporarily Unavailable</h1></center>
  <hr><center>nginx</center>
  </body>
  </html>
  ```
- **Runtime Cutout HDU Preservation (OQ-7):** **UNCONFIRMED** via live cutout response because IRSA's `ibe/data/spherex` upstream returned `503 Service Temporarily Unavailable` at test time. (Per `https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html`, cutouts preserve the MEF extensions while trimming spatial HDUs and updating `WCS-WAVE`, and leaving `PSF` unmodified; however, live cutout payload inspection remains **UNCONFIRMED** until IRSA's IBE service recovers.)

---

## 2. Anonymous S3 Listing & Key Pattern (`nasa-irsa-spherex`, OQ-3)

- **Bucket:** `s3://nasa-irsa-spherex` (Region: `us-east-1`, anonymous `UNSIGNED` access confirmed working).
- **Command Run:**
  ```python
  s3 = boto3.client("s3", region_name="us-east-1", config=Config(signature_version=UNSIGNED))
  resp = s3.list_objects_v2(Bucket="nasa-irsa-spherex", Prefix="qr2/level2/", MaxKeys=10)
  ```
- **Actual Response:**
  ```text
  KeyCount: 10
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_1D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_2D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_3D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_4D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0002_1D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0002_2D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0002_3D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0002_4D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0004_1D2_spx_l2b-v20-2025-240.fits 71634240
  qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0004_2D2_spx_l2b-v20-2025-240.fits 71634240
  ```
- **Verified S3 Key Pattern:**
  ```text
  qr2/level2/{YYYY}W{WW}_{step}/{l2b_pipeline_tag}/{detector}/level2_{YYYY}W{WW}_{step}_{exp_id}_{sub_exp}D{detector}_spx_{l2b_pipeline_tag}.fits
  ```
  - Exact file size: `71,634,240` bytes (~68.32 MiB).
  - Future DR1/DR2 key layout: **UNCONFIRMED** (not yet in bucket).

---

## 3. HDU Names & Structure (Is it `PSF` or `EPSF`?)

Verified directly from the FITS headers of `https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_1D2_spx_l2b-v20-2025-240.fits`:

- **Answer:** HDU 5 is named **`PSF`** (not `EPSF`).
- **Actual HDU Listing from FITS Header Inspection:**
  ```text
  HDU 0: EXTNAME='PRIMARY'  XTENSION='PRIMARY'  BITPIX=8   DIMS=()
  HDU 1: EXTNAME='IMAGE'    XTENSION='IMAGE'    BITPIX=-32 DIMS=(2040, 2040)  BUNIT='MJy / sr'
  HDU 2: EXTNAME='FLAGS'    XTENSION='IMAGE'    BITPIX=32  DIMS=(2040, 2040)  EXTTYPE='MASK'
  HDU 3: EXTNAME='VARIANCE' XTENSION='IMAGE'    BITPIX=-32 DIMS=(2040, 2040)
  HDU 4: EXTNAME='ZODI'     XTENSION='IMAGE'    BITPIX=-32 DIMS=(2040, 2040)
  HDU 5: EXTNAME='PSF'      XTENSION='IMAGE'    BITPIX=-32 DIMS=(101, 101, 121)
  HDU 6: EXTNAME='WCS-WAVE' XTENSION='BINTABLE' BITPIX=8   DIMS=(1056, 1)
  ```
- **WCS-WAVE Binary Table Columns (HDU 6):**
  Note that `WCS-WAVE` does **not** have a column named `CWAVE`; it uses FITS Paper III `WAVE-TAB` lookup table columns `X`, `Y`, and `VALUES`:
  ```text
  ('TFIELDS', 3, 'number of table fields')
  ('EXTNAME', 'WCS-WAVE', '')
  ('TTYPE1', 'X', '')
  ('TFORM1', '11J', '')
  ('TDIM1', '(11)', '')
  ('TTYPE2', 'Y', '')
  ('TFORM2', '11J', '')
  ('TDIM2', '(11)', '')
  ('TTYPE3', 'VALUES', '')
  ('TFORM3', '242E', '')
  ('TDIM3', '(2,11,11)', '')
  ```
  And in `HDU 1`/`HDU 2` alternate WCS `W`:
  ```text
  ('CTYPE1W', 'WAVE-TAB', 'Bilinear lookup table, FITS Paper 3, Sect 6.1')
  ('CTYPE2W', 'WAVE-TAB', 'Bilinear lookup table, FITS Paper 3, Sect 6.1')
  ('CNAME1W', 'Wavelength', 'First output axis is central wavelength')
  ('CNAME2W', 'Bandwidth', 'Second output axis is bandwidth')
  ('CUNIT1W', 'um', 'Wavelength is reported in microns')
  ('CUNIT2W', 'um', 'Bandpass is reported in microns')
  ('PV1_3W', 1, 'Index of wavelength in VALUES array')
  ('PV2_3W', 2, 'Index of bandwidth in VALUES array')
  ```

---

## 4. `FLAGS` Bit Meanings (OQ-2)

Verified directly from `HDU 2 (EXTNAME='FLAGS')` header cards (`MP_*` keywords) in `s3://nasa-irsa-spherex/qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_1D2_spx_l2b-v20-2025-240.fits`:

```text
('MP_TRANSIENT', 0, 'Transient detected during SUR')
('MP_OVERFLOW', 1, 'Overflow detected during SUR')
('MP_SUR_ERROR', 2, 'Error in onboard processing')
('MP_PHANTOM', 4, 'Phantom pixel')
('MP_REFERENCE', 5, 'Reference pixel')
('MP_NONFUNC', 6, 'Permanently unusable')
('MP_DICHROIC', 7, 'Low efficiency due to dichroic')
('MP_MISSING_DATA', 9, 'Onboard data lost')
('MP_HOT', 10, 'Hot pixel')
('MP_COLD', 11, 'Anomalously low signal')
('MP_FULLSAMPLE', 12, 'Pixel full sample history is available')
('MP_PHANMISS', 14, 'Phantom correction was not applied')
('MP_NONLINEAR', 15, 'Nonlinearity correction cannot be applied reliably')
('MP_PERSIST', 17, 'Persistent charge above threshold')
('MP_OUTLIER', 19, 'Pixel flagged by Detect Outliers')
('MP_SOURCE', 21, 'Pixel mapped to a known source')
```

| Bit | Header Keyword | Verified Meaning (from FITS Header Comment) |
|----:|----------------|---------------------------------------------|
| 0 | `MP_TRANSIENT` | Transient detected during SUR |
| 1 | `MP_OVERFLOW` | Overflow detected during SUR |
| 2 | `MP_SUR_ERROR` | Error in onboard processing |
| 3 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) |
| 4 | `MP_PHANTOM` | Phantom pixel |
| 5 | `MP_REFERENCE` | Reference pixel |
| 6 | `MP_NONFUNC` | Permanently unusable |
| 7 | `MP_DICHROIC` | Low efficiency due to dichroic |
| 8 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) |
| 9 | `MP_MISSING_DATA` | Onboard data lost |
| 10 | `MP_HOT` | Hot pixel |
| 11 | `MP_COLD` | Anomalously low signal |
| 12 | `MP_FULLSAMPLE` | Pixel full sample history is available |
| 13 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) |
| 14 | `MP_PHANMISS` | Phantom correction was not applied |
| 15 | `MP_NONLINEAR` | Nonlinearity correction cannot be applied reliably |
| 16 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) |
| 17 | `MP_PERSIST` | Persistent charge above threshold |
| 18 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) |
| 19 | `MP_OUTLIER` | Pixel flagged by Detect Outliers |
| 20 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) |
| 21 | `MP_SOURCE` | Pixel mapped to a known source |
| 22–31 | — | **UNCONFIRMED** in Level 2 `FLAGS` FITS header (not present as `MP_*` cards in this QR2 file) |

---

## 5. Pixel Scale

Verified directly from `HDU 1 (IMAGE)` and `HDU 5 (PSF)` headers of `s3://nasa-irsa-spherex/qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_1D2_spx_l2b-v20-2025-240.fits`:

1. **Nominal Detector Pixel Scale (`6.15 arcsec/px`):**
   From `HDU 5 (PSF)` header:
   ```text
   ('CDELT1', 0.615, '[arcsec] Coordinate increment at reference poin')
   ('CDELT2', 0.615, '[arcsec] Coordinate increment at reference poin')
   ('CUNIT1', 'arcsec', 'Units of coordinate increment and value')
   ('CUNIT2', 'arcsec', 'Units of coordinate increment and value')
   ('OVERSAMP', 10, '')
   ```
   Since the PSF cube is oversampled by `OVERSAMP = 10` at `0.615 arcsec` per oversampled pixel, the nominal native detector pixel scale is `0.615 * 10 = 6.15 arcsec/pixel`.

2. **WCS-derived Pixel Scale in `HDU 1 (IMAGE)`:**
   Note: SPHEREx Level 2 headers use `PC1_1`, `PC1_2`, `PC2_1`, `PC2_2` with `CDELT1 = 1.0 deg`, `CDELT2 = 1.0 deg` (not `CD1_1`..`CD2_2`):
   ```text
   ('PC1_1', 0.00154389700165, 'Coordinate transformation matrix element')
   ('PC1_2', -0.000720527610548, 'Coordinate transformation matrix element')
   ('PC2_1', -0.000720941111231, 'Coordinate transformation matrix element')
   ('PC2_2', -0.00154621993133, 'Coordinate transformation matrix element')
   ('CDELT1', 1.0, '[deg] Coordinate increment at reference point')
   ('CDELT2', 1.0, '[deg] Coordinate increment at reference point')
   ('CTYPE1', 'RA---TAN-SIP', 'TAN (gnomonic) projection + SIP distortions')
   ('CTYPE2', 'DEC--TAN-SIP', 'TAN (gnomonic) projection + SIP distortions')
   ```
   Computed via `astropy.wcs.utils.proj_plane_pixel_scales(WCS(hdr)) * 3600.0`:
   ```text
   IMAGE Pixel scales (arcsec/px): [6.1341444  6.14109365]
   ```
