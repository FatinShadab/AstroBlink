"""Predict the wavelength at a sky position for a SPHEREx exposure, without downloading it.

SPHEREx uses linear variable filters: the wavelength a pixel sees depends on where it lies on the detector.
IRSA's TAP table gives each exposure's footprint (spherex.plane.poly, the four detector corners on the
sky). From it we get the target's fractional position (u, v) on the detector and, with a per-detector
polynomial fitted to frames we have already measured, the wavelength there. This lets fetch_spherex.py
choose frames that share a wavelength across the longest baseline before downloading them.
"""

from __future__ import annotations

import math
import struct

import numpy as np


def parse_poly(hexwkb: str) -> np.ndarray:
    """EWKB polygon (hex) → (4, 2) array of corner (ra, dec) in degrees, closing point dropped."""
    b = bytes.fromhex(hexwkb)
    end = "<" if b[0] == 1 else ">"
    gtype = struct.unpack(end + "I", b[1:5])[0]
    off = 5 + (4 if gtype & 0x20000000 else 0)  # skip SRID
    nrings = struct.unpack(end + "I", b[off:off + 4])[0]
    off += 4
    if nrings < 1:
        raise ValueError("empty polygon")
    npts = struct.unpack(end + "I", b[off:off + 4])[0]
    off += 4
    pts = np.frombuffer(b[off:off + 16 * npts], dtype=end + "f8").reshape(npts, 2).copy()
    pts[:, 0] %= 360
    if npts > 1 and np.allclose(pts[0], pts[-1]):
        pts = pts[:-1]
    return pts[:4]


def _tangent(ra: np.ndarray, dec: np.ndarray, ra0: float, dec0: float) -> tuple[np.ndarray, np.ndarray]:
    ra, dec, ra0, dec0 = map(np.radians, (ra, dec, ra0, dec0))
    cosc = np.sin(dec0) * np.sin(dec) + np.cos(dec0) * np.cos(dec) * np.cos(ra - ra0)
    x = np.cos(dec) * np.sin(ra - ra0) / cosc
    y = (np.cos(dec0) * np.sin(dec) - np.sin(dec0) * np.cos(dec) * np.cos(ra - ra0)) / cosc
    return x, y


def detector_uv(corners: np.ndarray, ra: float, dec: float) -> tuple[float, float]:
    """Fractional position (u along corner0→corner1, v along corner0→corner3) by inverse bilinear mapping."""
    cx, cy = _tangent(corners[:, 0], corners[:, 1], ra, dec)  # target at the origin
    p0, p1, p2, p3 = (np.array([cx[i], cy[i]]) for i in range(4))
    u, v = 0.5, 0.5
    for _ in range(20):  # Newton iterations on P(u,v) = 0
        p = (1 - u) * (1 - v) * p0 + u * (1 - v) * p1 + u * v * p2 + (1 - u) * v * p3
        du = -(1 - v) * p0 + (1 - v) * p1 + v * p2 - v * p3
        dv = -(1 - u) * p0 - u * p1 + u * p2 + (1 - u) * p3
        jac = np.column_stack([du, dv])
        try:
            step = np.linalg.solve(jac, -p)
        except np.linalg.LinAlgError:
            break
        u, v = u + step[0], v + step[1]
        if abs(step[0]) + abs(step[1]) < 1e-10:
            break
    return float(u), float(v)


def design(u: np.ndarray, v: np.ndarray, deg: int = 3) -> np.ndarray:
    cols = [u ** i * v ** j for i in range(deg + 1) for j in range(deg + 1 - i)]
    return np.column_stack(cols)


class LvfModel:
    """log(wavelength) as a polynomial in (u, v), one per detector."""

    def __init__(self) -> None:
        self.coef: dict[str, np.ndarray] = {}
        self.rms: dict[str, float] = {}

    def fit(self, det: str, u: list[float], v: list[float], wl: list[float], deg: int = 3) -> float:
        uu, vv, ww = np.array(u), np.array(v), np.log(np.array(wl))
        a = design(uu, vv, deg)
        keep = np.ones(len(ww), bool)
        for _ in range(3):  # reject the odd bad match
            c, *_ = np.linalg.lstsq(a[keep], ww[keep], rcond=None)
            res = ww - a @ c
            s = 1.4826 * np.median(np.abs(res[keep])) or 1e-6
            keep = np.abs(res) < 5 * s
        self.coef[det] = c
        rel = np.exp(np.abs(res[keep])) - 1
        self.rms[det] = float(np.sqrt(np.mean(rel ** 2)))
        return self.rms[det]

    def predict(self, det: str, u: float, v: float) -> float:
        return float(math.exp((design(np.array([u]), np.array([v])) @ self.coef[det])[0]))
