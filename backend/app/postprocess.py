"""Postprocessing (PLAN §3).

Verifikation von Pynite 3.2.0 `Quad3D.membrane()` (Skript: tools/verify_membrane.py):
  * Einheit: Spannung in kN/m^2 bei Eingabe in kN/m (E in kN/m^2). Zugstreifen 1.0 x 0.5 m,
    t = 0.3 m, F = 150 kN -> membrane() = 1000.0 = F/(t*h). Umrechnung in MPa: / 1000.
  * Reihenfolge des Rueckgabevektors: [Sx, Sy, Txy] (je ein 1-elementiges Array/Skalar).
  * Orientierung: fuer plane='XY' ist lokal x = globales X (i->j), lokal y = globales Y.
    Sx wirkt also in globaler x-Richtung (verifiziert am Kragarm: Zug/Druck entsprechend
    Balkentheorie). Hinweis: membrane(local=False) wirft mit numpy 2 einen Fehler
    (float() auf 1-Element-Array) und wird daher nicht benutzt.
  * Eckpunkte: (xi,eta) = (-1,-1) -> i_node, (1,-1) -> j_node, (1,1) -> m_node, (-1,1) -> n_node
    (Netz: i links unten, j rechts unten, m rechts oben, n links oben). Werte an den Ecken
    sind aus den Gausspunkten extrapoliert (xi/gp).
  * Schnelle Auswertung: membrane() wird hier vektorisiert nachgebildet (gleiche Gausspunkt-
    Extrapolation, Cm@B_m je Element gecached); Test `test_membrane_equivalence` vergleicht
    gegen Pynite.
"""
from __future__ import annotations

import numpy as np

from . import ec2
from .model import Built, combo_load_sum

GP = 1 / 3 ** 0.5
DOF = [0, 1, 6, 7, 12, 13, 18, 19]
# Auswertepunkte (xi, eta): Ecken i, j, m, n und Elementmitte
_PTS = [(-1, -1), (1, -1), (1, 1), (-1, 1), (0, 0)]


def _H(xi: float, eta: float) -> np.ndarray:
    xe, ee = xi / GP, eta / GP
    return 0.25 * np.array([(1 - xe) * (1 - ee), (1 + xe) * (1 - ee), (1 + xe) * (1 + ee), (1 - xe) * (1 + ee)])


_HM = np.array([_H(*p) for p in _PTS])  # (5,4)


def r4(v: float) -> float:
    """Auf 4 signifikante Stellen runden."""
    return float(f"{float(v):.4g}")


def rc(v: float) -> float:
    return round(float(v), 5)


def element_stresses(b: Built) -> tuple[list[str], dict[str, np.ndarray]]:
    """Liefert Elementnamen und je Kombination ein Array (nel, 5, 3) [kN/m^2]:
    Punkte = Ecke i, j, m, n, Mitte; Komponenten = Sx, Sy, Txy."""
    m = b.model
    names = list(m.quads.keys())
    out = {k: np.zeros((len(names), 5, 3)) for k, _ in b.combos}
    for ie, name in enumerate(names):
        q = m.quads[name]
        Cm = q.Cm()
        D = [Cm @ q.B_m(sx * GP, sy * GP) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for key, _ in b.combos:
            d = np.asarray(q.d(key)).reshape(-1)[DOF]
            sg = np.array([(Dk @ d).reshape(-1) for Dk in D])  # (4,3) Gausspunkte
            out[key][ie] = _HM @ sg
    return names, out


def principal(sx, sy, txy):
    c = (sx + sy) / 2
    r = np.sqrt(((sx - sy) / 2) ** 2 + txy ** 2)
    return c + r, c - r, 0.5 * np.arctan2(2 * txy, sx - sy)


def _pos_neg_integral(s0: float, s1: float, d: float) -> tuple[float, float]:
    """Integral des positiven bzw. negativen Anteils einer linearen Verteilung ueber d."""
    if s0 >= 0 and s1 >= 0:
        return (s0 + s1) / 2 * d, 0.0
    if s0 <= 0 and s1 <= 0:
        return 0.0, (s0 + s1) / 2 * d
    tot = abs(s0) + abs(s1)
    a_pos = (max(s0, s1) ** 2) / (2 * tot) * d
    a_neg = -(min(s0, s1) ** 2) / (2 * tot) * d
    return a_pos, a_neg


def _section(b: Built, node_vals: dict[str, dict], pos: float, axis: str) -> dict:
    """axis 'x': vertikaler Schnitt x=pos (sx entlang y); 'y': horizontaler Schnitt y=pos (sy entlang x)."""
    g, t = b.geo, b.geo.t
    pts = []
    for nd in b.model.nodes.values():
        x, y = nd.X, nd.Y
        if axis == "x" and abs(x - pos) < 1e-6:
            pts.append((y, node_vals[nd.name]["sx"], x, y))
        elif axis == "y" and abs(y - pos) < 1e-6:
            pts.append((x, node_vals[nd.name]["sy"], x, y))
    pts.sort(key=lambda p: p[0])
    segs: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    for c, s, x, y in pts:
        if g.inside_opening(x, y):
            if cur:
                segs.append(cur)
                cur = []
            continue
        cur.append((c, s))
    if cur:
        segs.append(cur)
    Z = D = 0.0
    smax, smin = -1e30, 1e30
    for seg in segs:
        for (c0, s0), (c1, s1) in zip(seg[:-1], seg[1:]):
            ap, an = _pos_neg_integral(s0, s1, c1 - c0)
            Z += ap
            D += an
        for _, s in seg:
            smax, smin = max(smax, s), min(smin, s)
    if smax < -1e29:
        smax = smin = 0.0
    k = 1000.0 * t  # MPa*m -> kN
    key = "y" if axis == "x" else "x"
    res = {
        "pos": rc(pos),
        "segmente": [[{key: rc(c), "s": r4(s)} for c, s in seg] for seg in segs],
        "Z": r4(Z * k), "D": r4(D * k),
        "s_max": r4(smax), "s_min": r4(smin),
    }
    if axis == "x":
        res["As_erf"] = r4(Z * k / ec2.FYD * 10.0)  # kN/(N/mm^2) = 1000 mm^2 -> *10 = cm^2
    return res


def run_postprocess(b: Built, fck: float) -> tuple[dict, dict]:
    """Gibt (ergebnisse, equilibrium) zurueck."""
    m = b.model
    names, S = element_stresses(b)
    quads = [m.quads[n] for n in names]
    fcd = ec2.fcd(fck)
    fcd_r = ec2.fcd_red(fck)
    ergebnisse: dict = {}
    equil: dict = {}
    for key, _label in b.combos:
        s = S[key] / 1000.0  # MPa
        sx, sy, txy = s[..., 0], s[..., 1], s[..., 2]
        s1, s2, al = principal(sx, sy, txy)
        acc: dict[str, list] = {}
        for ie, q in enumerate(quads):
            for ic, nd in enumerate((q.i_node, q.j_node, q.m_node, q.n_node)):
                a = acc.setdefault(nd.name, [0.0, 0.0, 0.0, 0])
                a[0] += sx[ie, ic]
                a[1] += sy[ie, ic]
                a[2] += txy[ie, ic]
                a[3] += 1
        node_vals: dict[str, dict] = {}
        for nm, (a, bb, c, n) in acc.items():
            nsx, nsy, nt = a / n, bb / n, c / n
            n1, n2, _ = principal(nsx, nsy, nt)
            node_vals[nm] = {"sx": nsx, "sy": nsy, "txy": nt, "s1": float(n1), "s2": float(n2)}
        elemente = []
        for ie, q in enumerate(quads):
            pts = [[rc(n.X), rc(n.Y)] for n in (q.i_node, q.j_node, q.m_node, q.n_node)]
            elemente.append({
                "id": names[ie], "xy": pts,
                "cx": rc(sum(p[0] for p in pts) / 4), "cy": rc(sum(p[1] for p in pts) / 4),
                "sx": r4(sx[ie, 4]), "sy": r4(sy[ie, 4]), "txy": r4(txy[ie, 4]),
                "s1": r4(s1[ie, 4]), "s2": r4(s2[ie, 4]), "alpha": r4(al[ie, 4]),
            })
        knoten = [{"id": nm, "x": rc(m.nodes[nm].X), "y": rc(m.nodes[nm].Y),
                   **{k: r4(v[k]) for k in ("sx", "sy", "txy", "s1", "s2")}}
                  for nm, v in node_vals.items()]
        sch_x = [_section(b, node_vals, p, "x") for p in b.sx]
        sch_y = [_section(b, node_vals, p, "y") for p in b.sy]

        def rsum(names_, attr, key=key):
            return sum(getattr(m.nodes[n], attr)[key] for n in names_)

        rA = {"Fx": r4(rsum(b.nodes_A, "RxnFX")), "Fy": r4(rsum(b.nodes_A, "RxnFY"))}
        rB = {"Fx": r4(rsum(b.nodes_B, "RxnFX")), "Fy": r4(rsum(b.nodes_B, "RxnFY"))}
        sum_r = rsum(b.nodes_A, "RxnFY") + rsum(b.nodes_B, "RxnFY")
        equil[key] = {"sum_loads": r4(combo_load_sum(b, key)), "sum_reactions": r4(sum_r),
                      "rel_error": float(f"{abs(sum_r - combo_load_sum(b, key)) / max(combo_load_sum(b, key), 1e-9):.3g}")}
        s2min = float(s2[:, 4].min())
        ergebnisse[key] = {
            "elemente": elemente, "knoten": knoten, "schnitte_x": sch_x, "schnitte_y": sch_y,
            "reaktionen": {"A": rA, "B": rB},
            "extrema": {
                "s1_max": r4(s1[:, 4].max()), "s2_min": r4(s2min),
                "sx_max": r4(sx[:, 4].max()), "sx_min": r4(sx[:, 4].min()),
                "sy_max": r4(sy[:, 4].max()), "sy_min": r4(sy[:, 4].min()),
                "txy_abs_max": r4(np.abs(txy[:, 4]).max()),
                "ausnutzung_druck": r4(max(0.0, -s2min) / fcd * 100.0),
                "ausnutzung_druck_red": r4(max(0.0, -s2min) / fcd_r * 100.0),
            },
        }
    return ergebnisse, equil
