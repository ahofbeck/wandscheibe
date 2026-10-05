"""Betontabelle EC2 / DE-NA und Expositionsklassen (identisch zu frontend/lib/ec2.ts)."""
from __future__ import annotations

GAMMA_C = 1.5
ALPHA_CC = 0.85          # DE-NA
FYK = 500.0
GAMMA_S = 1.15
FYD = FYK / GAMMA_S      # 434.78 MPa

# Name -> (fck, fctm, Ecm) [MPa]
CONCRETE: dict[str, tuple[float, float, float]] = {
    "C12/15": (12, 1.6, 27000), "C16/20": (16, 1.9, 29000), "C20/25": (20, 2.2, 30000),
    "C25/30": (25, 2.6, 31000), "C30/37": (30, 2.9, 33000), "C35/45": (35, 3.2, 34000),
    "C40/50": (40, 3.5, 35000), "C45/55": (45, 3.8, 36000), "C50/60": (50, 4.1, 37000),
    "C55/67": (55, 4.2, 38000), "C60/75": (60, 4.4, 39000), "C70/85": (70, 4.6, 41000),
    "C80/95": (80, 4.8, 42000), "C90/105": (90, 5.0, 44000), "C100/115": (100, 5.2, 45000),
}

# Exposition -> (Mindestbetonfestigkeitsklasse, c_min,dur [mm] oder None)
EXPOSURE: dict[str, tuple[str, int | None]] = {
    "X0": ("C12/15", 10), "XC1": ("C16/20", 10), "XC2": ("C16/20", 20), "XC3": ("C20/25", 20),
    "XC4": ("C25/30", 25), "XD1": ("C30/37", 40), "XD2": ("C35/45", 40), "XD3": ("C35/45", 40),
    "XS1": ("C30/37", 40), "XS2": ("C35/45", 40), "XS3": ("C35/45", 40),
    "XF1": ("C25/30", None), "XF2": ("C25/30", None), "XF3": ("C25/30", None),
    "XF4": ("C30/37", None), "XA1": ("C25/30", None), "XA2": ("C35/45", None),
    "XA3": ("C35/45", None), "XM1": ("C30/37", None), "XM2": ("C35/45", None),
    "XM3": ("C35/45", None),
}


def fcd(fck: float) -> float:
    return ALPHA_CC * fck / GAMMA_C


def fcd_red(fck: float) -> float:
    """Reduzierte Druckfestigkeit bei Querzug: 0,6*(1-fck/250)*fcd."""
    return 0.6 * (1 - fck / 250.0) * fcd(fck)


def material_info(beton: str, exposition: str) -> dict:
    fck, fctm, ecm = CONCRETE[beton]
    min_beton, c_min = EXPOSURE[exposition]
    return {
        "beton": beton, "fck": fck, "fcd": round(fcd(fck), 3), "fctm": fctm, "Ecm": ecm,
        "fyd": round(FYD, 2), "exposition": exposition, "min_beton": min_beton,
        "c_min_dur": c_min, "expo_ok": fck >= CONCRETE[min_beton][0],
    }
