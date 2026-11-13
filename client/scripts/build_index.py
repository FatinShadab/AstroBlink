"""Rebuild client/public/data/index.json from the manifests on disk (no downloads).

Lists every preset folder with a manifest.json, in the order of TARGETS in fetch_spherex.py, with the same
fields fetch_spherex.py writes. Works for older manifests too (missing fields are derived or left out).

Usage (from client/):  <venv>/Scripts/python.exe scripts/build_index.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
ORDER = ["wise-0855", "barnard", "eps-indi-b", "r-dra", "rw-aur"]


def entry(m: dict) -> dict:
    frames = m.get("frames", [])
    dates = sorted(f["obsDate"] for f in frames)
    spectrum = m.get("spectrumPoints")
    if spectrum is None:
        spectrum = sum(1 for f in frames if isinstance(f.get("flux", f.get("centreFlux")), (int, float)))
    out = {
        "id": m["id"],
        "name": m["name"],
        "raDeg": m["raDeg"],
        "decDeg": m["decDeg"],
        "frameCount": len(frames),
        "stackCount": len(m.get("stacks", [])),
        "spectrumPoints": spectrum,
        "dateRange": m.get("dateRange") or ([dates[0], dates[-1]] if dates else []),
        "detectors": m.get("detectors") or sorted({f["detector"] for f in frames}),
        "releases": m.get("releases") or sorted({f["release"] for f in frames if f.get("release")}),
        "manifest": f"/data/{m['id']}/manifest.json",
    }
    return out


def main() -> None:
    manifests = {p.parent.name: json.loads(p.read_text()) for p in DATA.glob("*/manifest.json")}
    ids = [i for i in ORDER if i in manifests] + sorted(i for i in manifests if i not in ORDER)
    index = {"generated": datetime.now(timezone.utc).isoformat(), "targets": [entry(manifests[i]) for i in ids]}
    (DATA / "index.json").write_text(json.dumps(index, indent=2))
    for t in index["targets"]:
        print(f"{t['id']}: {t['frameCount']} frames, {t['dateRange'][0]}..{t['dateRange'][-1]}, "
              f"detectors {','.join(t['detectors'])}, releases {','.join(t['releases']) or '-'}")


if __name__ == "__main__":
    main()
