# SPHEREx Mission & Scientific Architecture Overview

## 1. Executive Mission Summary
* **Full Title:** Spectro-Photometer for the History of the Universe, Epoch of Reionization, and Ices Explorer (SPHEREx)
* **Mission Class:** NASA Astrophysics Medium-class Explorer (MIDEX) mission
* **Launch Date & Time:** March 11, 2025 at 8:10 p.m. PDT (March 12, 2025 at 03:10:12 UTC)
* **Launch Vehicle & Site:** SpaceX Falcon 9 rocket from Space Launch Complex 4 East (SLC-4E), Vandenberg Space Force Base, California
* **Co-Manifested Payload:** PUNCH (Polarimeter to Unify the Corona and Heliosphere) constellation
* **Mission Timeline:** 
  - Commissioning / In-Orbit Checkout (IOC): March – April 2025
  - Regular Science Operations Start: May 1, 2025
  - Nominal Science Duration: 25 months (conducting 4 complete all-sky survey passes)
* **Survey Coverage:** 100% of the celestial sky mapped every 6 months across 102 near-infrared color channels
* **Data Volume:** 1.4 trillion spectral-spatial voxels per all-sky pass (~5 trillion total across nominal mission)

---

## 2. Participating Institutions & Governance
* **Funding Agency:** NASA Science Mission Directorate (Astrophysics Division)
* **Project Management & Operations:** NASA Jet Propulsion Laboratory (JPL), Pasadena, CA
* **Principal Investigator (PI):** Dr. Jamie Bock, California Institute of Technology (Caltech)
* **Science Data Center:** Caltech/IPAC (Infrared Processing and Analysis Center), managing the SPHEREx Science Data Center (SSDC)
* **Data Archiving:** NASA/IPAC Infrared Science Archive (IRSA)
* **Spacecraft Bus & Telescope Contractor:** BAE Systems (formerly Ball Aerospace) — Ball Configurable Platform (BCP-100)
* **International & Science Partners:**
  - Korea Astronomy and Space Science Institute (KASI) — instrument testing and cryogenic chamber
  - Arizona State University (ASU) — Survey Planning Software (SPS)
  - Partner institutions: Harvard/CfA, Ohio State University, Rochester Institute of Technology (RIT), UC Irvine, Johns Hopkins University, ASIAA (Taiwan), University of Arizona

---

## 3. Orbit & Survey Strategy
* **Orbit Type:** Sun-synchronous low-Earth polar orbit (terminator / dawn-dusk)
* **Altitude:** ~700 km (mean semi-major axis: 7,037.4 km)
* **Inclination:** 97.951°
* **Orbital Period:** 98 minutes (~14.7 orbits per day)
* **Mean Local Time of Ascending Node (MLTAN):** 6:00 AM
* **Survey Planning Software (SPS):**
  - Manages on-the-fly dynamic scheduling to maximize science integration time
  - Enforces solar, terrestrial, and lunar avoidance angles
  - Mitigates "shuttle glow" by constraining telescope pointings relative to spacecraft velocity ram vector
  - Automatically suspends science during South Atlantic Anomaly (SAA) passages and high-rate downlinks
* **All-Sky Cadence:** 
  - Survey 1: First 6 months (0 – 180° orientation)
  - Survey 2: Months 6 – 12.5 (completing Year 1 Data Release 1)
  - Survey 3 & 4: Months 12.5 – 25 (completing Year 2 Data Release 2)

---

## 4. Optical & Instrument Specifications
* **Telescope Architecture:** Cryogenically cooled, all-aluminum free-form Three-Mirror Anastigmat (TMA)
* **Aperture:** 20 cm effective aperture, f/3 focal ratio
* **Field of View (FoV):** 3.5° × 11.3° dual field split by a dichroic beamsplitter
* **Moving Parts:** None (aperture cover deployed once during IOC)
* **Beamsplitter Transition:** Dichroic split at 2.42 – 2.45 µm separating short-wave (SWIR) and mid-wave (MWIR) channels
* **Focal Plane Arrays (FPAs):** Six Hawaii-2RG (H2RG) HgCdTe 2048 × 2048 detectors (2040 × 2040 active pixels)
  - Detectors 1–3 (SWIR): 2.6 µm cutoff, cooled passively to 62 K
  - Detectors 4–6 (MWIR): 5.3 µm cutoff, cooled passively to 45 K
* **Pixel Scale:** 6.15″ × 6.15″ per pixel
* **Readout Mode:** Sample-Up-the-Ramp (SUR) with 1.5349 s frame time; 113.58 s exposure time
* **Dispersive Elements:** Linear Variable Filters (LVFs) mounted directly above the detector arrays
  - Central transmission wavelength varies continuously across the dispersion axis
  - Yields 102 distinct spectral channels spanning 0.744 to 5.002 µm

### Spectral Bands Breakdown
| Band | Array ID | Wavelength Range (µm) | Resolving Power (R = λ/Δλ) | Detector Regime |
| :--- | :--- | :--- | :--- | :--- |
| **Band 1** | Detector 1 | 0.744 – 1.116 µm | R ≈ 39 | SWIR (2.6 µm cutoff) |
| **Band 2** | Detector 2 | 1.099 – 1.651 µm | R ≈ 41 | SWIR (2.6 µm cutoff) |
| **Band 3** | Detector 3 | 1.636 – 2.421 µm | R ≈ 41 | SWIR (2.6 µm cutoff) |
| **Band 4** | Detector 4 | 2.423 – 3.822 µm | R ≈ 35 | MWIR (5.3 µm cutoff) |
| **Band 5** | Detector 5 | 3.809 – 4.420 µm | R ≈ 112 | MWIR (5.3 µm cutoff) |
| **Band 6** | Detector 6 | 4.412 – 5.002 µm | R ≈ 128 | MWIR (5.3 µm cutoff) |

---

## 5. Core Scientific Objectives

### Pillar 1: Cosmic Inflation & The Early Universe
* **Objective:** Test inflationary physics occurring less than 10^-32 seconds after the Big Bang.
* **Method:** Reconstruct 3D large-scale structure clustering across >450 million galaxies using 1.6 µm H-band stellar bump redshifts.
* **Key Metric:** Constrains primordial non-Gaussianity parameter $f_{\rm NL}$ to $\sigma(f_{\rm NL}) \le 1$, ruling out multi-field vs. single-field inflation models.

### Pillar 2: Interstellar Ices & Origin of Water/Life
* **Objective:** Map biogenic ice reservoirs ($H_2O$, $CO_2$, $CO$, $CH_3OH$) throughout the Milky Way.
* **Method:** Low-resolution infrared absorption spectroscopy targeting circumstellar envelopes, young stellar objects (YSOs), and dense molecular clouds.
* **Scope:** Generates >20,000 high-quality ice spectra using the SPLICES catalog (~9 million candidate infrared point sources).

### Pillar 3: Galaxy Formation & Extragalactic Background Light (EBL)
* **Objective:** Measure total collective emission from all galaxies across cosmic time.
* **Method:** Spatial fluctuation power spectrum analysis in deep fields at the North and South Ecliptic Poles, disentangling light from dwarf galaxies, intra-halo stars, and the Epoch of Reionization.

### Secondary Science: Solar System Minor Bodies
* **Asteroid & Comet Surveys:** Extracts low-resolution spectra for ~100,000 asteroids (Main Belt and Trojans) and tracks active comets (e.g., interstellar comet 3I/ATLAS).
* **Thermal Characterization:** Evaluates surface mineralogy (olivine, pyroxene, 2.7 µm OH hydration, 3 µm water ice, and 3.4 µm organics) and thermal inertia properties.
