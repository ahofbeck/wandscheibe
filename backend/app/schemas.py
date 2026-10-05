"""Pydantic-v2-Modelle gemäß PLAN §4 (Request). Die Response wird als dict geliefert."""
from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from .ec2 import CONCRETE, EXPOSURE

MIN_WEB = 0.05  # Mindeststeg [m]


class Oeffnung(BaseModel):
    a_lager_a: float = Field(1.10, gt=0)
    b: float = Field(0.75, gt=0)
    h: float = Field(1.20, gt=0)
    a_oben: float = Field(0.90, gt=0)


class Geometrie(BaseModel):
    t_wand: float = Field(0.30, gt=0, le=2.0)
    b_lager_a: float = Field(0.40, gt=0)
    b_lager_b: float = Field(0.40, gt=0)
    l_licht: float = Field(3.40, gt=0)
    h_licht: float = Field(2.60, gt=0)
    h_decke_oben: float = Field(0.20, gt=0)
    h_decke_unten: float = Field(0.20, gt=0)
    oeffnung: Oeffnung = Oeffnung()
    b_stuetze: float = Field(0.40, gt=0)


class Material(BaseModel):
    beton: str = "C30/37"
    exposition: str = "XC1"
    gamma_beton: float = Field(25.0, gt=0)


class LinienLast(BaseModel):
    gk: float = Field(20.0, ge=0)
    qk: float = Field(8.0, ge=0)


class StuetzenLast(BaseModel):
    Gk: float = Field(1000.0, ge=0)
    Qk: float = Field(600.0, ge=0)
    x_last: float = 2.10


class Lasten(BaseModel):
    oben: LinienLast = LinienLast()
    unten: LinienLast = LinienLast()
    stuetze: StuetzenLast = StuetzenLast()


class Berechnung(BaseModel):
    netz: float = Field(0.10, ge=0.025, le=0.5)
    schnitte_x: list[float] = Field(default_factory=lambda: [0.60, 1.30, 2.05, 3.30], max_length=12)
    schnitte_y: list[float] = Field(default_factory=lambda: [2.90, 2.45, 1.50, 0.55, 0.10], max_length=12)


class AnalyzeRequest(BaseModel):
    geometrie: Geometrie = Geometrie()
    material: Material = Material()
    lasten: Lasten = Lasten()
    berechnung: Berechnung = Berechnung()

    @model_validator(mode="after")
    def _check(self) -> "AnalyzeRequest":
        g, o = self.geometrie, self.geometrie.oeffnung
        errs: list[str] = []
        if self.material.beton not in CONCRETE:
            errs.append(f"Unbekannte Betongüte '{self.material.beton}'.")
        if self.material.exposition not in EXPOSURE:
            errs.append(f"Unbekannte Expositionsklasse '{self.material.exposition}'.")
        L = g.b_lager_a + g.l_licht + g.b_lager_b
        H = g.h_decke_unten + g.h_licht + g.h_decke_oben
        x_a = g.b_lager_a / 2
        x_o = x_a + o.a_lager_a
        y_o = H - o.a_oben - o.h
        if x_o < MIN_WEB - 1e-9 or x_o + o.b > L - MIN_WEB + 1e-9:
            errs.append(f"Die Öffnung liegt nicht innerhalb der Wand in x-Richtung "
                        f"(x = {x_o:.2f} … {x_o + o.b:.2f} m, erlaubt {MIN_WEB:.2f} … {L - MIN_WEB:.2f} m).")
        if y_o < MIN_WEB - 1e-9 or y_o + o.h > H - MIN_WEB + 1e-9:
            errs.append(f"Die Öffnung liegt nicht innerhalb der Wand in y-Richtung "
                        f"(y = {y_o:.2f} … {y_o + o.h:.2f} m, erlaubt {MIN_WEB:.2f} … {H - MIN_WEB:.2f} m).")
        x_p = x_a + self.lasten.stuetze.x_last
        if x_p - g.b_stuetze / 2 < -1e-9 or x_p + g.b_stuetze / 2 > L + 1e-9:
            errs.append(f"Der Einzellastbereich (x = {x_p - g.b_stuetze / 2:.2f} … "
                        f"{x_p + g.b_stuetze / 2:.2f} m) liegt außerhalb der Wand (0 … {L:.2f} m).")
        for p in self.berechnung.schnitte_x:
            if not (0 < p < L):
                errs.append(f"Schnittposition x = {p:.2f} m liegt außerhalb der Wand (0 … {L:.2f} m).")
        for p in self.berechnung.schnitte_y:
            if not (0 < p < H):
                errs.append(f"Schnittposition y = {p:.2f} m liegt außerhalb der Wand (0 … {H:.2f} m).")
        if errs:
            raise ValueError(" ".join(errs))
        return self
