# AstroBlink: High-Level Summary

## Form version (2 to 4 sentences)

AstroBlink is a public, no-login web tool that lets anyone type a sky position or pick one of five preset targets and watch NASA SPHEREx infrared images of that patch play like a short film, so anything that moves or changes brightness stands out. It is built for curious visitors, students and citizen scientists: they can explore the sky, share or embed any view, and join guided projects that train them to spot moving stars, brown dwarfs, variable stars and detector glitches. Behind the viewer, a backend pipeline turns SPHEREx Level 2 exposures into aligned, wavelength-matched image series, and a consensus service combines volunteer marks into candidate lists.

---

## Full summary

### What it is

AstroBlink is a citizen-science blink comparator for NASA's SPHEREx mission. SPHEREx, launched in March 2025, maps the whole sky about every six months in infrared light, across many wavelengths and six detectors. Because one patch of sky is photographed again and again, anything that moves, pulses or changes brightness shows up as a difference between frames. AstroBlink makes that comparison easy for anyone, without installing software or creating an account.

### Who it helps

- **Visitors and judges** can open the viewer straight away. They type coordinates or click one of five presets (Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae and R Draconis), and the image series plays automatically.
- **Learners** get explainer cards, a field guide and a practice round with known answers and feedback.
- **Contributors** classify batches of image fields with four large answer buttons, track progress through each batch, and earn a completion certificate drawn in the browser.
- **Analysts** can switch between blink, side-by-side, merge, difference and stack views, change detector, stretch and field of view, inspect glitch flags, and read light curves and spectra.

### How it works

The Next.js front end reads SPHEREx frames through one data-provider interface, so components never fetch data directly. The five presets use 255 real SPHEREx frames from the public release data. Other positions show a clearly labelled simulated sky. Every viewer state is stored in the URL, so any view can be shared, and a dedicated embed route lets a viewer sit inside another website.

Behind the front end, a Python ingestion worker queries the IRSA archive for SPHEREx exposures, reads only the bytes it needs from the public S3 bucket, aligns the frames on a common 0.5 degree grid and renders small WebP tiles with coordinate sidecars. A FastAPI service stores subjects and classifications in PostgreSQL and runs a consensus algorithm that clusters volunteer marks per epoch, weights each volunteer by reliability, and links clusters into motion tracks.

### Why it matters

The tool lowers the barrier to looking at real survey data. It is public, bilingual (English and Bangla), and designed for accessibility: a reduced-motion mode, a colour-blind-safe merge view, and a blink rate capped for comfortable viewing. Its science choices (matched wavelengths, a grid large enough to contain nearby objects' parallax, and filtered detector defects) are documented so that the results can be trusted.

### Status and next steps

The viewer, the citizen-science layer and the backend ingestion and consensus services are all implemented, and each has a unit-test suite. Next, we would connect the viewer to live backend subjects, add more real targets from upcoming SPHEREx data releases, and add Gaia and WISE catalogue overlays.
