# NASA Space Apps Challenge 2026 & The Zooniverse Citizen Science Model

## 1. NASA Space Apps Challenge 2026 Overview
* **Event:** 2026 NASA Space Apps Challenge
* **Challenge Track:** "Planet X and SPHEREx"
* **Difficulty Level:** Advanced
* **Subject Categories:** Astrophysics, Planets & Moons, Software

### Official Challenge Statement
> "Since 2025, NASA’s SPHEREx mission has been mapping the entire sky every six months in 102 bands of near-infrared light, returning images of more than a billion objects. Comets, asteroids, stars, brown dwarfs, and even new planets reveal themselves by shifting position between images, but no one person can sift through all that data alone. Your challenge is to create a public-facing web tool to display images of the sky from SPHEREx mission, making it easy for anyone to quickly see how they change over time."

---

## 2. The Core Scientific & Computational Bottleneck

### Astrometric Motion Across Multi-Epoch Surveys
* **The Survey Baseline:** SPHEREx scans 100% of the celestial sphere every six months. Consecutive passes provide multi-epoch observations separated by six months (Epoch 1 vs. Epoch 2 vs. Epoch 3 vs. Epoch 4).
* **Static vs. Shifting Sources:**
  - *Static Sources:* Distant galaxies, quasars, and background Milky Way stars have negligible proper motion on 6-month timescales and remain in fixed celestial positions.
  - *Moving Sources:* Solar System bodies (Near-Earth Asteroids, Main-Belt Asteroids, Jupiter Trojans, Centaurs, Kuiper Belt Objects, and hypothetical outer planets like Planet X) and nearby ultra-cool brown dwarfs exhibit noticeable spatial displacement over six months.
* **The Big Data Challenge:**
  - SPHEREx catalogues light from over 1 billion celestial objects across 1.4 trillion spectral-spatial voxels per pass.
  - Automated detection pipelines generate large numbers of false positives caused by detector artifacts: 1.083 µm atmospheric helium airglow striping, cosmic ray snowball cascades, optical frame-edge ghosts, and satellite streaks.
  - Professional astronomers cannot manually vet millions of candidate image cutouts without distributed human assistance.

---

## 3. The Citizen Science Paradigm & The Zooniverse Model

### What is Citizen Science in Astrophysics?
Citizen science engages the public in authentic scientific research. Landmark projects such as *Galaxy Zoo*, *Planet Hunters* (Kepler/TESS transit search), and *Backyard Worlds: Planet 9* (WISE infrared motion search) have proven that volunteer crowdsourcing can lead to peer-reviewed astronomical discoveries.

### Why Human Pattern Recognition Excels
While machine learning models can flag potential candidates, the human visual cortex remains unmatched at:
1. Distinguishing real point-source motion from optical reflections, diffraction spikes, and blooming.
2. Detecting faint, diffuse objects (like cometary comas) moving against complex galactic dust backgrounds.
3. Rejecting correlated noise patterns and satellite tracks that fool simple algorithmic thresholding.

### The Historical "Blink Comparator" Technique
* In 1930, astronomer Clyde Tombaugh discovered Pluto using a mechanical optical device called a **Blink Comparator**.
* By rapidly alternating between two glass photographic plates taken days apart, fixed background stars appeared stationary, while Pluto appeared to jump back and forth.
* In modern digital citizen science, the "digital blink" (automated looping or interactive slider) provides an intuitive, highly engaging mechanism for volunteers to spot moving bodies instantly.

### Core Architectural Pillars of a Zooniverse-Style Platform
1. **Micro-Tasking:**
   - Massive all-sky surveys are decomposed into small, self-contained spatial cutouts (e.g., 0.1° × 0.1° sky patches).
   - Each cutout represents a quick, 15-to-30-second visual task accessible on both mobile and desktop web browsers.
2. **Standardized Classification Workflows:**
   - Volunteers are guided through clear decision trees: spot a shift, drop a vector marker, and categorize the candidate (*Asteroid/NEO*, *Comet*, *Brown Dwarf*, *Planet X Candidate*, or *Artifact*).
3. **Multi-User Consensus Validation:**
   - No single volunteer's tag triggers an alert. Each subject is served independently to multiple users (e.g., 5 to 10 volunteers).
   - Statistical consensus algorithms (e.g., spatial clustering) combine tags, effectively eliminating random misclicks, trolling, and ambiguous noise.
4. **Onboarding & Gamification:**
   - Built-in visual tutorials teach non-astronomers how to identify real moving sources and ignore common artifacts.
   - Progress dashboards, discovery feeds, and volunteer contributor credits keep citizen scientists motivated and engaged.
