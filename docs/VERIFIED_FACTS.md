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

| Bit | Header Keyword | Verified Meaning (from FITS Header Comment) | Masked by Default (`DEFECT_MASK_BITS`)? |
|----:|----------------|---------------------------------------------|:---------------------------------------:|
| 0 | `MP_TRANSIENT` | Transient detected during SUR | `True` (configurable via `mask_transient_and_outlier_flags`) |
| 1 | `MP_OVERFLOW` | Overflow detected during SUR | `True` |
| 2 | `MP_SUR_ERROR` | Error in onboard processing | `True` |
| 3 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) | `False` |
| 4 | `MP_PHANTOM` | Phantom pixel | `True` |
| 5 | `MP_REFERENCE` | Reference pixel | `True` |
| 6 | `MP_NONFUNC` | Permanently unusable | `True` |
| 7 | `MP_DICHROIC` | Low efficiency due to dichroic | `True` |
| 8 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) | `False` |
| 9 | `MP_MISSING_DATA` | Onboard data lost | `True` |
| 10 | `MP_HOT` | Hot pixel | `True` |
| 11 | `MP_COLD` | Anomalously low signal | `True` |
| 12 | `MP_FULLSAMPLE` | Pixel full sample history is available | `False` (informational quality flag) |
| 13 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) | `False` |
| 14 | `MP_PHANMISS` | Phantom correction was not applied | `True` |
| 15 | `MP_NONLINEAR` | Nonlinearity correction cannot be applied reliably | `True` |
| 16 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) | `False` |
| 17 | `MP_PERSIST` | Persistent charge above threshold | `True` |
| 18 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) | `False` |
| 19 | `MP_OUTLIER` | Pixel flagged by Detect Outliers | `True` (configurable via `mask_transient_and_outlier_flags`) |
| 20 | — | **UNCONFIRMED** (not present in Level 2 `FLAGS` header) | `False` |
| 21 | `MP_SOURCE` | Pixel mapped to a known source | `False` (informational catalog source flag) |
| 22–31 | — | **UNCONFIRMED** in Level 2 `FLAGS` FITS header (not present as `MP_*` cards in this QR2 file) | `False` |

- **Unsigned 32-Bit FITS Encoding (`BZERO`):**
  The `FLAGS` extension header specifies `BITPIX = 32`, `BSCALE = 1`, `BZERO = 2147483648` ($2^{31}$), representing unsigned `uint32` bitmasks via the standard FITS signed-integer offset convention. When slicing raw binary strips directly from S3 (bypassing `astropy.io.fits` automatic scaling), the raw big-endian signed `>i4` values must be converted via `(raw_i32.astype(np.int64) + 2147483648).astype(np.uint32)` before bitwise testing.
- **Do Bits 0 (`MP_TRANSIENT`) or 19 (`MP_OUTLIER`) Mark Moving Objects? (`UNPROVEN`):**
  - **Bit 0 (`MP_TRANSIENT`, `"Transient detected during SUR"`):** Flagged onboard during a single ~112.5 s Sample-Up-the-Ramp (SUR) integration when a single readout sample jumps (e.g., cosmic-ray hit or electronic spike).
  - **Bit 19 (`MP_OUTLIER`, `"Pixel flagged by Detect Outliers"`):** Set by the Level 2 pipeline's spatial/ramp outlier detector (`Detect Outliers`), predominantly flagging sharp high-contrast PSF gradients around stationary bright stars in both epochs.
  - **Moving-Object Claim Status:** **UNPROVEN.** No IRSA/SPHEREx documentation or empirical evidence shows that Bit 0 or Bit 19 selectively marks moving Solar System objects across epochs.

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

---

## 6. Live Ingestion & S3 Object Verification (Phase W9)

Verified via live ingestion through worker pipeline on real targets in `s3://nasa-irsa-spherex`:

1. **IRSA TAP Spatial Discovery Query:**
   ```sql
   SELECT TOP {limit} p.energy_bandpassname, a.uri, p.time_bounds_lower
   FROM spherex.artifact a
   JOIN spherex.plane p ON a.planeid = p.planeid
   WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly)
   ORDER BY p.time_bounds_lower
   ```
   Directly returns valid Level 2 FITS object URIs matching bucket keys under `qr2/level2/`.

2. **Real Target Position Results:**
   - **Target 1:** RA `160.61529°`, Dec `30.66915°`
     - Files: `qr2/level2/2025W17_4B/l2b-v20-2025-241/1/level2_2025W17_4B_0001_1D1_spx_l2b-v20-2025-241.fits`, `qr2/level2/2025W17_4B/l2b-v20-2025-240/4/level2_2025W17_4B_0001_1D4_spx_l2b-v20-2025-240.fits`
     - Epochs: `[1]`
     - Mask Fraction: `66.68%`
     - Tile Sizes: SWIR: `1.6 KiB`, MWIR: `1.0 KiB`, RGB: `1.0 KiB`
     - Subject ID: `7cd1e61f-eb1d-4e57-931b-ca603a959900`
   - **Target 2:** RA `276.26139°`, Dec `64.82577°`
     - Files: `qr2/level2/2025W17_4B/l2b-v20-2025-240/5/level2_2025W17_4B_0030_1D5_spx_l2b-v20-2025-240.fits`, `qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0030_1D2_spx_l2b-v20-2025-240.fits`
     - Epochs: `[1]`
     - Mask Fraction: `33.81%`
     - Tile Sizes: SWIR: `618 B`, MWIR: `360 B`, RGB: `1.0 KiB`
     - Subject ID: `72ea4cc3-d374-480e-9ed3-0e1b7df389bc`
   - **Target 3:** RA `349.78099°`, Dec `-56.49399°`
     - Files: `qr2/level2/2025W18_1B/l2b-v20-2025-241/1/level2_2025W18_1B_0112_2D1_spx_l2b-v20-2025-241.fits`, `qr2/level2/2025W18_1B/l2b-v20-2025-240/4/level2_2025W18_1B_0112_2D4_spx_l2b-v20-2025-240.fits`
     - Epochs: `[1]`
     - Mask Fraction: `90.21%`
     - Tile Sizes: SWIR: `1.6 KiB`, MWIR: `1.0 KiB`, RGB: `1.0 KiB`
     - Subject ID: `5571684b-f5b5-4613-93c1-b5bbe8998fcc`
   - **Target 4:** RA `207.74854°`, Dec `64.95670°`
     - Files: `qr2/level2/2025W18_1B/l2b-v20-2025-240/5/level2_2025W18_1B_0418_1D5_spx_l2b-v20-2025-240.fits`, `qr2/level2/2025W18_1B/l2b-v20-2025-240/2/level2_2025W18_1B_0418_1D2_spx_l2b-v20-2025-240.fits`
     - Epochs: `[1]`
     - Mask Fraction: `33.45%`
     - Tile Sizes: SWIR: `1.7 KiB`, MWIR: `2.2 KiB`, RGB: `1.0 KiB`
     - Subject ID: `b1dbddf3-c52b-4949-bfd3-d82836ed6ea2`
   - **Target 5:** RA `158.73328°`, Dec `45.46230°`
     - Files: `qr2/level2/2025W17_4B/l2b-v20-2025-240/5/level2_2025W17_4B_0146_1D5_spx_l2b-v20-2025-240.fits`, `qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0146_1D2_spx_l2b-v20-2025-240.fits`
     - Epochs: `[1]`
     - Mask Fraction: `33.36%`
     - Tile Sizes: SWIR: `1.7 KiB`, MWIR: `2.1 KiB`, RGB: `1.0 KiB`
     - Subject ID: `d9e856e4-e6f8-43ea-809f-935edcd7fc19`

3. **Status of Unconfirmed Items:**
   - Future DR1/DR2 release prefixes: **UNCONFIRMED** (only QR2 present in bucket).
   - Live IRSA IBE Cutout Service HDU preservation: **UNCONFIRMED** (service returned 502/503; anonymous S3 download fallback functioning reliably).
   - FLAGS bits 3, 8, 13, 16, 18, 20, 22–31: **UNCONFIRMED** (absent in Level 2 header MP cards).

---

## 7. Sky Displacements & Earth-Orbit Parallax Across Survey Epochs (`ASSUMED` vs `COMPUTED`, Phase W11b)

Because SPHEREx observes near solar elongation $\sim 90^\circ$ (quadrature), two survey passes separated by $\Delta t_{\text{ep}} \approx 171\text{--}238\text{ d}$ ($\sim 6\text{ months}$) are taken from opposite sides of Earth's orbit (`[COMPUTED]` perpendicular Earth-baseline shift $|\Delta\mathbf{r}_{\oplus,\perp}| = 1.7817\text{--}1.9885\text{ AU}$ via `astropy.coordinates.get_body_barycentric('earth', t)`).

Consequently, **the naive proper-motion-only claim that objects at $d \gtrsim 400\text{ AU}$ stay inside a `0.1°` (`360"`) cutout over 6 months does NOT hold** once Earth-orbit parallax ($\Delta\theta_{\text{par}} \approx |\Delta\mathbf{r}_{\oplus,\perp}| / d \approx 399"/d_{1000\text{AU}}$) is included: even at $d = 1000\text{ AU}$, the 6-month topocentric shift is `387.5"–407.8"` (`0.108°–0.113°`), exceeding a `0.1°` (`360"`) cutout.

### 7A. Real Horizons Objects Queried at Exact Target Epoch 1 & Epoch 2 Dates (`[COMPUTED: JPL Horizons]`)

| Target | Epoch 1 MJD | Epoch 2 MJD | $\Delta t_{\text{ep}}$ (d) | Object & Provenance | $\Delta\theta$ (`1 d`) | $\Delta\theta$ (`5 d`) | $\Delta\theta$ (`6 mo`) | Inside `0.1°` (`360"`) Over `1d / 5d / 6mo`? |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: |
| Target 1 | `60842.8502` | `61038.0203` | `195.17` | MBA: (1) Ceres (a=2.77 AU [COMPUTED: JPL Horizons]) | `894.4"` (`145.4 px`) | `4369.6"` (`710.5 px`) | `10057.4"` (`2.794°`, `1635.4 px`) | `False / False / False` |
| Target 1 | `60842.8502` | `61038.0203` | `195.17` | NEO: (433) Eros (a=1.46 AU [COMPUTED: JPL Horizons]) | `1811.6"` (`294.6 px`) | `9026.4"` (`1467.7 px`) | `101320.9"` (`28.145°`, `16474.9 px`) | `False / False / False` |
| Target 1 | `60842.8502` | `61038.0203` | `195.17` | KBO (~40 AU): (134340) Pluto (a=39.5 AU [COMPUTED: JPL Horizons]) | `64.2"` (`10.4 px`) | `331.8"` (`53.9 px`) | `2836.4"` (`0.788°`, `461.2 px`) | `True / True / False` |
| Target 2 (CVZ) | `60799.6540` | `61038.0725` | `238.42` | MBA: (1) Ceres (a=2.77 AU [COMPUTED: JPL Horizons]) | `1210.3"` (`196.8 px`) | `5999.1"` (`975.5 px`) | `37197.2"` (`10.332°`, `6048.3 px`) | `False / False / False` |
| Target 2 (CVZ) | `60799.6540` | `61038.0725` | `238.42` | NEO: (433) Eros (a=1.46 AU [COMPUTED: JPL Horizons]) | `1921.4"` (`312.4 px`) | `9584.0"` (`1558.4 px`) | `174867.2"` (`48.574°`, `28433.7 px`) | `False / False / False` |
| Target 2 (CVZ) | `60799.6540` | `61038.0725` | `238.42` | KBO (~40 AU): (134340) Pluto (a=39.5 AU [COMPUTED: JPL Horizons]) | `11.3"` (`1.8 px`) | `60.4"` (`9.8 px`) | `4350.9"` (`1.209°`, `707.5 px`) | `True / True / False` |
| Target 3 | `60816.3292` | `61030.7289` | `214.40` | MBA: (1) Ceres (a=2.77 AU [COMPUTED: JPL Horizons]) | `1113.5"` (`181.1 px`) | `5498.7"` (`894.1 px`) | `13039.7"` (`3.622°`, `2120.3 px`) | `False / False / False` |
| Target 3 | `60816.3292` | `61030.7289` | `214.40` | NEO: (433) Eros (a=1.46 AU [COMPUTED: JPL Horizons]) | `1883.8"` (`306.3 px`) | `9393.9"` (`1527.5 px`) | `143287.3"` (`39.802°`, `23298.8 px`) | `False / False / False` |
| Target 3 | `60816.3292` | `61030.7289` | `214.40` | KBO (~40 AU): (134340) Pluto (a=39.5 AU [COMPUTED: JPL Horizons]) | `30.3"` (`4.9 px`) | `165.9"` (`27.0 px`) | `4838.5"` (`1.344°`, `786.7 px`) | `True / True / False` |
| Target 4 | `60856.6186` | `61034.4316` | `177.81` | MBA: (1) Ceres (a=2.77 AU [COMPUTED: JPL Horizons]) | `740.9"` (`120.5 px`) | `3580.0"` (`582.1 px`) | `23294.0"` (`6.471°`, `3787.6 px`) | `False / False / False` |
| Target 4 | `60856.6186` | `61034.4316` | `177.81` | NEO: (433) Eros (a=1.46 AU [COMPUTED: JPL Horizons]) | `1762.7"` (`286.6 px`) | `8774.1"` (`1426.7 px`) | `80889.3"` (`22.469°`, `13152.7 px`) | `False / False / False` |
| Target 4 | `60856.6186` | `61034.4316` | `177.81` | KBO (~40 AU): (134340) Pluto (a=39.5 AU [COMPUTED: JPL Horizons]) | `76.4"` (`12.4 px`) | `389.0"` (`63.2 px`) | `2241.6"` (`0.623°`, `364.5 px`) | `True / False / False` |
| Target 5 | `60967.7946` | `61139.0427` | `171.25` | MBA: (1) Ceres (a=2.77 AU [COMPUTED: JPL Horizons]) | `691.4"` (`112.4 px`) | `3334.0"` (`542.1 px`) | `125000.6"` (`34.722°`, `20325.3 px`) | `False / False / False` |
| Target 5 | `60967.7946` | `61139.0427` | `171.25` | NEO: (433) Eros (a=1.46 AU [COMPUTED: JPL Horizons]) | `1324.2"` (`215.3 px`) | `6629.1"` (`1077.9 px`) | `292248.5"` (`81.180°`, `47520.1 px`) | `False / False / False` |
| Target 5 | `60967.7946` | `61139.0427` | `171.25` | KBO (~40 AU): (134340) Pluto (a=39.5 AU [COMPUTED: JPL Horizons]) | `10.9"` (`1.8 px`) | `72.0"` (`11.7 px`) | `14215.4"` (`3.949°`, `2311.4 px`) | `True / True / False` |

### 7B. Distant Objects (40, 300, 500, 1000 AU) at Each Target's Exact `(RA, Dec)` Including 3D Earth-Orbit Parallax

| Target | $\Delta t_{\text{ep}}$ (d) | Object ($d$ `[ASSUMED]`) | $|\Delta\mathbf{r}_{\oplus,\perp}|$ (AU `[COMPUTED]`) | $\Delta\theta$ (`1 d`) | $\Delta\theta$ (`5 d`) | 6-mo Parallax Only (`[COMPUTED]`) | 6-mo Proper Motion (`[COMPUTED]`) | 6-mo Total Displacement (`[COMPUTED]`) | Stays in `0.1°` (`360"` box / `180"` half) Over 6 mo? |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Target 1 | `195.17` | KBO at 40 AU | `1.9843` | `45.59"` (`7.41 px`) | `220.07"` (`35.78 px`) | **`10258.3"`** | `2737.2"` | **`7518.6"` (`2.088°`, `1222.5 px`)** | `False / False` |
| Target 1 | `195.17` | Hypothetical 300 AU | `1.9843` | `5.41"` (`0.88 px`) | `26.24"` (`4.27 px`) | **`1364.9"`** | `133.3"` | **`1231.6"` (`0.342°`, `200.3 px`)** | `False / False` |
| Target 1 | `195.17` | Hypothetical 500 AU | `1.9843` | `3.20"` (`0.52 px`) | `15.55"` (`2.53 px`) | **`818.8"`** | `61.9"` | **`756.9"` (`0.210°`, `123.1 px`)** | `False / False` |
| Target 1 | `195.17` | Hypothetical 1000 AU | `1.9843` | `1.58"` (`0.26 px`) | `7.68"` (`1.25 px`) | **`409.4"`** | `21.9"` | **`387.5"` (`0.108°`, `63.0 px`)** | `False / False` |
| Target 2 (CVZ) | `238.42` | KBO at 40 AU | `1.7817` | `75.76"` (`12.32 px`) | `379.70"` (`61.74 px`) | **`9180.7"`** | `3343.6"` | **`12026.6"` (`3.341°`, `1955.5 px`)** | `False / False` |
| Target 2 (CVZ) | `238.42` | Hypothetical 300 AU | `1.7817` | `11.13"` (`1.81 px`) | `55.64"` (`9.05 px`) | **`1225.0"`** | `162.8"` | **`1359.3"` (`0.378°`, `221.0 px`)** | `False / False` |
| Target 2 (CVZ) | `238.42` | Hypothetical 500 AU | `1.7817` | `6.76"` (`1.10 px`) | `33.78"` (`5.49 px`) | **`735.0"`** | `75.7"` | **`797.1"` (`0.221°`, `129.6 px`)** | `False / False` |
| Target 2 (CVZ) | `238.42` | Hypothetical 1000 AU | `1.7817` | `3.42"` (`0.56 px`) | `17.09"` (`2.78 px`) | **`367.5"`** | `26.8"` | **`389.3"` (`0.108°`, `63.3 px`)** | `False / False` |
| Target 3 | `214.40` | KBO at 40 AU | `1.8616` | `29.82"` (`4.85 px`) | `135.74"` (`22.07 px`) | **`9472.0"`** | `3006.8"` | **`12432.9"` (`3.454°`, `2021.6 px`)** | `False / False` |
| Target 3 | `214.40` | Hypothetical 300 AU | `1.8616` | `5.16"` (`0.84 px`) | `24.06"` (`3.91 px`) | **`1277.7"`** | `146.4"` | **`1423.9"` (`0.396°`, `231.5 px`)** | `False / False` |
| Target 3 | `214.40` | Hypothetical 500 AU | `1.8616` | `3.19"` (`0.52 px`) | `14.90"` (`2.42 px`) | **`767.2"`** | `68.0"` | **`835.1"` (`0.232°`, `135.8 px`)** | `False / False` |
| Target 3 | `214.40` | Hypothetical 1000 AU | `1.8616` | `1.64"` (`0.27 px`) | `7.68"` (`1.25 px`) | **`383.8"`** | `24.1"` | **`407.8"` (`0.113°`, `66.3 px`)** | `False / False` |
| Target 4 | `177.81` | KBO at 40 AU | `1.9826` | `78.65"` (`12.79 px`) | `390.08"` (`63.43 px`) | **`10278.4"`** | `2493.8"` | **`7839.4"` (`2.178°`, `1274.7 px`)** | `False / False` |
| Target 4 | `177.81` | Hypothetical 300 AU | `1.9826` | `10.10"` (`1.64 px`) | `50.22"` (`8.17 px`) | **`1364.3"`** | `121.4"` | **`1245.4"` (`0.346°`, `202.5 px`)** | `False / False` |
| Target 4 | `177.81` | Hypothetical 500 AU | `1.9826` | `6.03"` (`0.98 px`) | `30.03"` (`4.88 px`) | **`818.3"`** | `56.4"` | **`763.0"` (`0.212°`, `124.1 px`)** | `False / False` |
| Target 4 | `177.81` | Hypothetical 1000 AU | `1.9826` | `3.00"` (`0.49 px`) | `14.96"` (`2.43 px`) | **`409.1"`** | `19.9"` | **`389.5"` (`0.108°`, `63.3 px`)** | `False / False` |
| Target 5 | `171.25` | KBO at 40 AU | `1.9885` | `18.30"` (`2.98 px`) | `82.80"` (`13.46 px`) | **`10275.6"`** | `2401.7"` | **`7871.5"` (`2.187°`, `1279.9 px`)** | `False / False` |
| Target 5 | `171.25` | Hypothetical 300 AU | `1.9885` | `1.93"` (`0.31 px`) | `9.52"` (`1.55 px`) | **`1367.7"`** | `116.9"` | **`1250.7"` (`0.347°`, `203.4 px`)** | `False / False` |
| Target 5 | `171.25` | Hypothetical 500 AU | `1.9885` | `1.15"` (`0.19 px`) | `5.75"` (`0.93 px`) | **`820.5"`** | `54.4"` | **`766.1"` (`0.213°`, `124.6 px`)** | `False / False` |
| Target 5 | `171.25` | Hypothetical 1000 AU | `1.9885` | `0.57"` (`0.09 px`) | `2.91"` (`0.47 px`) | **`410.2"`** | `19.2"` | **`391.0"` (`0.109°`, `63.6 px`)** | `False / False` |
