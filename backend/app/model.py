"""FE-Modell (PLAN §2): Netz, Randbedingungen, Lasten, Kombinationen."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field

from Pynite import FEModel3D

from . import ec2
from .schemas import AnalyzeRequest

TOL = 1e-6
NU = 0.2

COMBOS = [
    ("gleich_uls", "Gleichlast (GZT)", {"EG": 1.35, "G_D": 1.35, "Q_D": 1.5}),
    ("einzel_uls", "Einzellast (GZT)", {"G_S": 1.35, "Q_S": 1.5}),
    ("gesamt_uls", "Gesamt (GZT)", {"EG": 1.35, "G_D": 1.35, "G_S": 1.35, "Q_D": 1.5, "Q_S": 1.5}),
    ("gesamt_char", "Gesamt (charakteristisch)", {"EG": 1.0, "G_D": 1.0, "G_S": 1.0, "Q_D": 1.0, "Q_S": 1.0}),
]


@dataclass
class Geo:
    L: float
    H: float
    l_eff: float
    x_A: float
    x_B: float
    ox: float
    oy: float
    ob: float
    oh: float
    x_P: float
    px0: float
    px1: float
    hdu: float
    hdo: float
    ba: float
    bb: float
    t: float

    def inside_opening(self, x: float, y: float) -> bool:
        """Offene Öffnungsfläche inkl. der Randlinien in x (Schnittlinie auf Öffnungskante
        gehört zur Lücke), offen in y."""
        return (self.ox - TOL <= x <= self.ox + self.ob + TOL) and (self.oy + TOL < y < self.oy + self.oh - TOL)


def derive(req: AnalyzeRequest) -> Geo:
    g, o = req.geometrie, req.geometrie.oeffnung
    L = g.b_lager_a + g.l_licht + g.b_lager_b
    H = g.h_decke_unten + g.h_licht + g.h_decke_oben
    x_a = g.b_lager_a / 2
    x_b = L - g.b_lager_b / 2
    x_p = x_a + req.lasten.stuetze.x_last
    return Geo(L=L, H=H, l_eff=x_b - x_a, x_A=x_a, x_B=x_b, ox=x_a + o.a_lager_a,
               oy=H - o.a_oben - o.h, ob=o.b, oh=o.h, x_P=x_p,
               px0=x_p - g.b_stuetze / 2, px1=x_p + g.b_stuetze / 2,
               hdu=g.h_decke_unten, hdo=g.h_decke_oben, ba=g.b_lager_a, bb=g.b_lager_b, t=g.t_wand)


def _dedupe(vals: list[float], lo: float, hi: float, tol: float = 1e-4) -> list[float]:
    out: list[float] = []
    for v in sorted(vals):
        if v < lo - tol or v > hi + tol:
            continue
        v = min(max(v, lo), hi)
        if out and abs(v - out[-1]) < tol:
            continue
        out.append(round(v, 6))
    return out


@dataclass
class Built:
    model: FEModel3D
    geo: Geo
    sx: list[float]
    sy: list[float]
    combos: list[tuple[str, str]]
    loads: dict[str, float]            # Lastsumme je Lastfall [kN] (abwärts)
    nodes_A: list[str] = field(default_factory=list)
    nodes_B: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _line_weights(xs: list[float], a: float, b: float) -> list[float]:
    """Einzugslängen der sortierten Stützstellen xs für den Bereich [a, b] (Summe = b-a)."""
    n = len(xs)
    res = []
    for i, x in enumerate(xs):
        lo = xs[i - 1] + (x - xs[i - 1]) / 2 if i > 0 else x
        hi = x + (xs[i + 1] - x) / 2 if i < n - 1 else x
        res.append(max(0.0, min(hi, b) - max(lo, a)))
    return res


def _quad_area(q) -> float:
    pts = [(q.i_node.X, q.i_node.Y), (q.j_node.X, q.j_node.Y), (q.m_node.X, q.m_node.Y), (q.n_node.X, q.n_node.Y)]
    s = 0.0
    for k in range(4):
        x1, y1 = pts[k]
        x2, y2 = pts[(k + 1) % 4]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def build_model(req: AnalyzeRequest) -> Built:
    geo = derive(req)
    warnings: list[str] = [
        "Deckenstreifen werden vereinfacht mit der Wanddicke modelliert (konservativ).",
        "Rein ebenes Scheibenmodell (lineare Elastizität, ungerissener Beton, Quad-Elemente).",
    ]
    if geo.oy < geo.hdu - TOL or geo.oy + geo.oh > geo.H - geo.hdo + TOL:
        warnings.append("Die Öffnung reicht in den Bereich der Deckenstreifen.")
    mat = ec2.CONCRETE[req.material.beton]
    E = mat[2] * 1000.0  # kN/m²
    m = FEModel3D()
    m.add_material("Beton", E, E / (2 * (1 + NU)), NU, 0.0)

    # Netzlinien
    sx = _dedupe(req.berechnung.schnitte_x, 0, geo.L)
    sy = _dedupe(req.berechnung.schnitte_y, 0, geo.H)
    xc = [geo.ba, geo.L - geo.bb, geo.x_A, geo.x_B, geo.ox, geo.ox + geo.ob, geo.px0, geo.px1, geo.x_P] + sx
    yc = [geo.hdu, geo.H - geo.hdo, geo.oy, geo.oy + geo.oh] + sy
    xc = _dedupe(xc, 0, geo.L)
    yc = _dedupe(yc, 0, geo.H)
    # Schnittpositionen auf die tatsächlich eingefügte Netzlinie abbilden
    sx = [min(xc, key=lambda v: abs(v - p)) for p in sx]
    sy = [min(yc, key=lambda v: abs(v - p)) for p in sy]

    m.add_rectangle_mesh("W", req.berechnung.netz, geo.L, geo.H, geo.t, "Beton", plane="XY",
                         x_control=list(xc), y_control=list(yc), element_type="Quad")
    mesh = m.meshes["W"]
    mesh.add_rect_opening("O", geo.ox, geo.oy, geo.ob, geo.oh)
    mesh.generate()

    nodes = list(m.nodes.values())
    # Scheibe: out-of-plane sperren
    for n in nodes:
        m.def_support(n.name, False, False, True, True, True, True)

    # Auflager
    A = [n for n in nodes if abs(n.Y) < TOL and n.X <= geo.ba + TOL]
    B = [n for n in nodes if abs(n.Y) < TOL and n.X >= geo.L - geo.bb - TOL]
    if not A or not B:
        raise ValueError("Keine Auflagerknoten im Netz gefunden.")
    nA = min(A, key=lambda n: abs(n.X - geo.x_A))
    for n in A:
        m.def_support(n.name, n is nA, True, True, True, True, True)
    for n in B:
        m.def_support(n.name, False, True, True, True, True, True)

    loads = {k: 0.0 for k in ("EG", "G_D", "Q_D", "G_S", "Q_S")}

    def add(n, case: str, P: float):
        if P != 0.0:
            m.add_node_load(n.name, "FY", -P, case)
            loads[case] += P

    # Eigengewicht
    gam, t = req.material.gamma_beton, geo.t
    for q in m.quads.values():
        w = gam * t * _quad_area(q) / 4
        for n in (q.i_node, q.j_node, q.m_node, q.n_node):
            add(n, "EG", w)

    def row(y: float):
        r = sorted([n for n in nodes if abs(n.Y - y) < TOL], key=lambda n: n.X)
        if not r:
            raise ValueError(f"Keine Knotenreihe bei y = {y:.3f} m.")
        return r

    top, bot = row(geo.H), row(geo.hdu)
    for rw, ld, gcase, qcase in ((top, req.lasten.oben, "G_D", "Q_D"), (bot, req.lasten.unten, "G_D", "Q_D")):
        w = _line_weights([n.X for n in rw], 0.0, geo.L)
        for n, lw in zip(rw, w):
            add(n, gcase, ld.gk * lw)
            add(n, qcase, ld.qk * lw)
    w = _line_weights([n.X for n in top], geo.px0, geo.px1)
    st = req.lasten.stuetze
    for n, lw in zip(top, w):
        if lw > 0:
            add(n, "G_S", st.Gk * lw / (geo.px1 - geo.px0))
            add(n, "Q_S", st.Qk * lw / (geo.px1 - geo.px0))

    for key, _label, fac in COMBOS:
        m.add_load_combo(key, fac)

    return Built(model=m, geo=geo, sx=sx, sy=sy, combos=[(k, l) for k, l, _ in COMBOS], loads=loads,
                 nodes_A=[n.name for n in A], nodes_B=[n.name for n in B], warnings=warnings)


def combo_load_sum(b: Built, key: str) -> float:
    fac = next(f for k, _l, f in COMBOS if k == key)
    return sum(f * b.loads.get(c, 0.0) for c, f in fac.items())


def _fast_reactions(b: Built):
    """Ersatz fuer Pynite.Analysis._calc_reactions: Pynite wertet die Elementkraefte aller
    (wegen DZ/RX/RY/RZ-Sperren) gelagerten Knoten fuer alle Elemente aus (~35 s bei 1500 Elementen).
    Benoetigt werden nur die Reaktionen DX/DY an den Lagerknoten A/B; dafuer genuegen die
    Elemente, die diese Knoten beruehren."""
    m = b.model
    sup = set(b.nodes_A) | set(b.nodes_B)

    def calc(model, log=False, combo_tags=None):
        for n in model.nodes.values():
            for combo in model.load_combos.values():
                for a in ("RxnFX", "RxnFY", "RxnFZ", "RxnMX", "RxnMY", "RxnMZ"):
                    getattr(n, a)[combo.name] = 0.0
        for q in model.quads.values():
            ns = (q.i_node, q.j_node, q.m_node, q.n_node)
            if not any(n.name in sup for n in ns):
                continue
            for combo in model.load_combos.values():
                F = q.F(combo.name)
                for k, n in enumerate(ns):
                    if n.name in sup:
                        if n.support_DX:
                            n.RxnFX[combo.name] += float(F[6 * k, 0])
                        if n.support_DY:
                            n.RxnFY[combo.name] += float(F[6 * k + 1, 0])
        # direkt auf Lagerknoten aufgebrachte Knotenlasten abziehen (wie Pynite)
        for name in sup:
            n = model.nodes[name]
            for combo in model.load_combos.values():
                for d, case, P in ((ld[0], ld[2], ld[1]) for ld in n.NodeLoads):
                    f = combo.factors.get(case)
                    if f is None:
                        continue
                    if d == "FX" and n.support_DX:
                        n.RxnFX[combo.name] -= P * f
                    elif d == "FY" and n.support_DY:
                        n.RxnFY[combo.name] -= P * f
    return calc


_SOLVE_LOCK = threading.Lock()  # die Monkeypatches unten sind prozessweit -> Analysen serialisieren


def solve(b: Built) -> None:
    """Loesung mit analyze_linear; Pynite-Hotspots werden waehrend der Analyse umgangen:
    (1) Reaktionen nur an Lagerknoten, (2) Quad-FER ohne Flaechenlasten = 0 (spart ~25 %)."""
    import numpy as np
    from Pynite import Analysis
    from Pynite.Quad3D import Quad3D

    orig_rx, orig_fer, orig_FER = Analysis._calc_reactions, Quad3D.fer, Quad3D.FER
    orig_cs, orig_unp = Analysis._check_stability, Analysis._unpartition
    zeros = np.zeros((24, 1))

    def fer_fast(self, combo_name="Combo 1"):
        return zeros.copy() if not self.pressures else orig_fer(self, combo_name)

    def FER_fast(self, combo_name="Combo 1"):
        return zeros.copy() if not self.pressures else orig_FER(self, combo_name)

    def check_fast(model, K):
        """Vektorisierte Fassung von Pynite._check_stability (gleiche Pruefung: Diagonale ~ 0 an
        ungelagertem Freiheitsgrad -> Instabilitaet). Das Original braucht O(n^2) (80 s bei 5000 Elementen)."""
        n = len(model.nodes)
        attrs = ("support_DX", "support_DY", "support_DZ", "support_RX", "support_RY", "support_RZ")
        sup = np.zeros(n * 6, dtype=bool)
        for nd in model.nodes.values():
            for k, a in enumerate(attrs):
                sup[nd.ID * 6 + k] = bool(getattr(nd, a))
        diag = np.asarray(K.diagonal()).reshape(-1)
        bad = np.where((np.abs(diag) < 1e-8) & ~sup)[0]
        if bad.size:
            raise Exception("Instabiles Modell: ungelagerte Knoten ohne Steifigkeit.")

    def unpart_fast(model, V1, V2, V1_idx, V2_idx):
        V = np.zeros((len(model.nodes) * 6, 1))
        if len(V2_idx):
            V[np.asarray(V2_idx, dtype=int), 0] = np.asarray(V2).reshape(-1)
        if len(V1_idx):
            V[np.asarray(V1_idx, dtype=int), 0] = np.asarray(V1).reshape(-1)
        return V

    with _SOLVE_LOCK:
        Analysis._check_stability, Analysis._unpartition = check_fast, unpart_fast
        Analysis._calc_reactions = _fast_reactions(b)
        Quad3D.fer, Quad3D.FER = fer_fast, FER_fast
        try:
            b.model.analyze_linear(check_stability=True, sparse=True)
        finally:
            Analysis._calc_reactions = orig_rx
            Analysis._check_stability, Analysis._unpartition = orig_cs, orig_unp
            Quad3D.fer, Quad3D.FER = orig_fer, orig_FER
