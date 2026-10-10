# IRSA SPHEREx Data Products & Cloud Access Architecture

## 1. Data Pipeline Tiers & Telemetry Processing
Data processing is executed at the SPHEREx Science Data Center (SSDC) located at Caltech/IPAC. Science telemetry is transmitted from low-Earth orbit via Ka-band downlink (600 Mbps) to ground receivers of NASA's Near Space Network (NSN), while spacecraft health and navigation data use S-band links (32 kbps / 2 Mbps).

| Pipeline Level | Product Description | Format / Typical Size | Primary Distribution |
| :--- | :--- | :--- | :--- |
| **Level 0** | Raw telemetry packets, decompressed and staged | Uncalibrated detector frames | Internal SSDC archive |
| **Level 1** | Sample-Up-the-Ramp (SUR) photocurrent slopes | Electrons per second ($e^-/\text{s}$) | Intermediate processing |
| **Level 2** | Astrometrically & photometrically calibrated spectral images | Multi-Extension FITS (MEF) (~67 MB) | Public IRSA releases (QR2, QR3, DR1) |
| **Level 3** | Forced-photometry catalogs for target source lists | Tabular spectral catalogs / IPAC tables | IRSA Database & Catalog Search |
| **Level 4** | High-level derived science products (redshifts, mosaics, ice maps) | 3D FITS data cubes & value-added tables | IRSA Data Releases (DR1, DR2) |

---

## 2. Level 2 Multi-Extension FITS (MEF) Structure
Each Level 2 single-exposure file represents one detector observation and contains six Header Data Units (HDUs) (five image extensions and one binary table):

### HDU 1: IMAGE (Primary Science Flux)
* **Dimensions:** 2,040 × 2,040 2D float array
* **Physical Units:** MegaJanskys per steradian (MJy/sr)
* **Description:** Calibrated near-infrared surface brightness. Linear Variable Filters map detector pixel location to central wavelength.

### HDU 2: FLAGS (Quality & Processing Bitmask)
* **Dimensions:** 2,040 × 2,040 integer bitmask
* **Key Flag Bits:**
  - Bit 0 (TRANSIENT): Cosmic ray strike or sudden charge jump detected during SUR readout.
  - Bit 1 (OVERFLOW): Full-well saturation reached.
  - Bit 2 (SUR_ERROR): Checksum or slope calculation error in onboard flight electronics.
  - Bit 6 (NONFUNC): Static bad/unusable pixel mask.
  - Bit 7 (DICHROIC): Pixels in detector dark corners where dichroic throughput drops below 50%.
  - Bit 9 (MISSING_DATA): Lost telemetry packet during downlink.
  - Bit 25 (STREAK): Track from satellite or space debris crossing the field.
  - Bit 26 (BLOOM): Charge blooming from neighboring saturated bright star.
  - Bit 27 (SNOWBALL): High-energy cosmic ray deposition releasing massive charge cascades.
  - Bit 28 (HALO): Secondary halo surrounding a transient or snowball event.
  - Bit 29 (SATELLITE_HALO): Optical scatter halo bordering a bright satellite track.

### HDU 3: VARIANCE (Measurement Uncertainty)
* **Dimensions:** 2,040 × 2,040 float array
* **Physical Units:** (MJy/sr)^2
* **Description:** Per-pixel statistical variance combining Correlated Double Sampling (CDS) read noise and Poisson photon noise.

### HDU 4: ZODI (Zodiacal Light Background)
* **Dimensions:** 2,040 × 2,040 float array
* **Physical Units:** MJy/sr
* **Description:** Model-derived solar system interplanetary dust emission based on a modified Kelsall et al. (1998) model calibrated to SPHEREx orbital high-latitude measurements.

### HDU 5: EPSF (Effective Point Spread Function)
* **Dimensions:** 33 × 33 pixel image cube on a 5× oversampled spatial grid
* **Zoning:** 21 × 21 spatial zones for Detectors 1, 2, 4, 5, 6; 11 × 41 spatial zones for Detector 3 (fine spectral sampling)
* **Description:** Dimensionless, normalized empirical point-spread function models constructed from thousands of isolated CALSPEC and Gaia reference stars.

### HDU 6: WCS-WAVE (Spectral Coordinate Lookup)
* **Format:** FITS Binary Table (3 columns, 1 row) adhering to FITS Paper 3 WAVE-TAB convention
* **Description:** Lookup table providing central wavelengths (CWAVE) and bandpasses (CBAND) in microns corresponding to pixel coordinates (x, y).

---

## 3. Cloud Data Access (AWS S3)
SPHEREx data products are hosted on Amazon Web Services under the AWS Open Data Sponsorship Program. All data can be accessed without credentials or egress fees.

* **S3 Bucket Name:** `nasa-irsa-spherex`
* **AWS Region:** `us-east-1`
* **Access Mode:** Public / Anonymous access (no credentials needed)

### S3 Directory Structure (Quick Release 2 / 3)
* `qr2/level2/`: Calibrated L2 spectral images (MEF FITS)
* `qr2/abs_gain_matrix/`: Pixel-to-pixel gain matrices per band
* `qr2/average_psf/`: Standalone oversampled ePSF models
* `qr2/dark/`: Dark current maps
* `qr2/dichroic/`: Dichroic transmission attenuation masks
* `qr2/gain_factors/`: Metadata containing detector gain values
* `qr2/nonfunc/`: Static non-functional pixel maps
* `qr2/readnoise_pars/`: Per-detector read noise maps
* `qr2/solid_angle_pixel_map/`: Pixel solid angle maps (arcsec^2)
* `qr2/spectral_wcs/`: High-precision FITS spectral WCS files
* `qr3/`: Quick Release 3 weekly batches

---

## 4. Official IRSA Web Tools & Services

### 1. SPHEREx Cutout Tool
Extracts smaller, manageable sub-regions from large MEF files while preserving all six HDUs and WCS geometry.
* Allows spatial subset queries centered on target coordinates (RA, Dec) with a specified angular radius or box size in degrees.
* Enables lightweight retrieval of candidate fields without downloading entire multi-hundred megabyte full frames.

### 2. Spectrophotometry Tool (The Tractor)
* Extracts calibrated low-resolution near-infrared spectra from multiple overlapping images for user-specified coordinates.
* Uses The Tractor generative modeling engine to perform forced profile fitting against local ePSF models and subtract background noise.

### 3. Mosaic Tool
* Reprojects and co-adds multiple Level 2 images across observation epochs into continuous 3D FITS spectral cubes (RA, Dec, Wavelength).

### 4. Moving Object Search Tool (MOST)
* Takes orbital elements of solar system bodies (asteroids, comets) and identifies every SPHEREx exposure that crossed their predicted trajectory.

### 5. SPLICES Catalog
* Target list of ~9 million spatially isolated, infrared-bright point sources optimized for biogenic ice absorption studies (3.1 GB compressed FITS).

---

## 5. Known Image Anomalies & Filtering Rules
When processing SPHEREx images for automated motion tracking or visual blinking, several optical and atmospheric features must be handled:

1. **Atmospheric He 1.083 µm Emission Line:** Upper-atmosphere helium glow creates bright horizontal bands across all Band 1 images following LVF contour lines. Must be masked or filtered out to prevent false motion triggers.
2. **Auroral & Airglow Emission Lines:** Variable emission lines at 0.78, 0.84, 0.93, 1.13, 1.81, 2.63, 2.75, 4.03, and 4.64 µm seen during polar passes.
3. **Cosmic Ray Snowballs & Halos:** Giant particle strikes deposit massive charge clusters. Must expand exclusion flags using the HALO bit (Bit 28).
4. **Frame Edge Ghosts & Dichroic Scatter:** Bright stars near the edge of the field of view cause internal reflection ghosts across Bands 3 and 4.
5. **Shuttle Glow:** Atmospheric ram interaction producing faint near-infrared glow on forward-facing spacecraft surfaces.
