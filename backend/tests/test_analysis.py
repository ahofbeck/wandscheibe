import time

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app, run_analysis
from app.postprocess import GP
from app.schemas import AnalyzeRequest

KEYS = ["gleich_uls", "einzel_uls", "gesamt_uls", "gesamt_char"]


def test_default_run_shape(default_result):
    r = default_result
    assert set(r) == {"meta", "geometrie", "material", "kombinationen", "ergebnisse"}
    assert [k["key"] for k in r["kombinationen"]] == KEYS
    g = r["geometrie"]
    assert (g["L"], g["H"], g["l_eff"], g["x_A"], g["x_B"]) == (4.2, 3.0, 3.8, 0.2, 4.0)
    assert g["oeffnung"] == {"x": 1.3, "y": 0.9, "b": 0.75, "h": 1.2}
    assert r["material"]["fcd"] == 17.0 and r["material"]["expo_ok"] is True
    for k in KEYS:
        e = r["ergebnisse"][k]
        assert len(e["elemente"]) == r["meta"]["n_elements"]
        assert len(e["schnitte_x"]) == 4 and len(e["schnitte_y"]) == 5
        assert {"Z", "D", "As_erf", "s_max", "s_min", "segmente", "pos"} <= set(e["schnitte_x"][0])
        assert {"Fx", "Fy"} == set(e["reaktionen"]["A"])
        assert {"s1_max", "s2_min", "sx_max", "sx_min", "sy_max", "sy_min", "txy_abs_max",
                "ausnutzung_druck"} <= set(e["extrema"])
        el = e["elemente"][0]
        assert {"id", "xy", "cx", "cy", "sx", "sy", "txy", "s1", "s2", "alpha"} <= set(el)
        assert len(el["xy"]) == 4


@pytest.mark.parametrize("key", KEYS)
def test_equilibrium(default_result, key):
    eq = default_result["meta"]["equilibrium"][key]
    assert abs(eq["sum_reactions"] - eq["sum_loads"]) / eq["sum_loads"] < 1e-3
    e = default_result["ergebnisse"][key]["reaktionen"]
    assert abs(e["A"]["Fy"] + e["B"]["Fy"] - eq["sum_loads"]) / eq["sum_loads"] < 1e-3
    assert abs(e["A"]["Fx"]) < 1e-3 and abs(e["B"]["Fx"]) < 1e-3


def test_expected_loads(default_result):
    # EG = 25*0.3*(4.2*3.0 - 0.75*1.2) = 87.75 ; G_D = 2*20*4.2 = 168 ; Q_D = 2*8*4.2 = 67.2
    eq = default_result["meta"]["equilibrium"]
    assert eq["gleich_uls"]["sum_loads"] == pytest.approx(1.35 * (87.75 + 168) + 1.5 * 67.2, rel=1e-4)
    assert eq["einzel_uls"]["sum_loads"] == pytest.approx(1.35 * 1000 + 1.5 * 600, rel=1e-6)
    assert eq["gesamt_char"]["sum_loads"] == pytest.approx(87.75 + 168 + 67.2 + 1600, rel=1e-4)


def test_plausibility_gleich(default_result):
    e = default_result["ergebnisse"]["gleich_uls"]
    # Gleichlast: Auflager symmetrisch ~ je die Haelfte, A + B = Gesamtlast
    a, b = e["reaktionen"]["A"]["Fy"], e["reaktionen"]["B"]["Fy"]
    assert a + b == pytest.approx(446.1, rel=1e-3)
    assert 0.4 < a / (a + b) < 0.6
    # sx-Zug am Untergurt in Feldmitte
    kn = [k for k in e["knoten"] if 0.1 <= k["y"] <= 0.3 and 1.7 <= k["x"] <= 2.5]
    assert kn and max(k["sx"] for k in kn) > 0.2
    # Druck ueberwiegt global; Z/D im Schnitt im Gleichgewicht (Biegung)
    assert e["extrema"]["s2_min"] < -1.0
    sx = e["schnitte_x"][2]
    assert sx["Z"] > 0 and sx["D"] < 0 and sx["As_erf"] > 0
    assert abs(sx["Z"] + sx["D"]) < 0.05 * sx["Z"]
    # Schnitt durch Oeffnung: Lücke -> 2 Segmente, keine Punkte im Oeffnungsbereich
    sec = e["schnitte_x"][1]
    assert len(sec["segmente"]) == 2
    for seg in sec["segmente"]:
        for p in seg:
            assert not (0.9 + 1e-6 < p["y"] < 2.1 - 1e-6)


def test_superposition(default_result):
    r = default_result["ergebnisse"]
    for comp in ("A", "B"):
        s = r["gleich_uls"]["reaktionen"][comp]["Fy"] + r["einzel_uls"]["reaktionen"][comp]["Fy"]
        assert s == pytest.approx(r["gesamt_uls"]["reaktionen"][comp]["Fy"], rel=1e-3)


def test_einzel_load_asymmetric(default_result):
    e = default_result["ergebnisse"]["einzel_uls"]["reaktionen"]
    assert e["B"]["Fy"] > e["A"]["Fy"]  # Last bei x=2.3 naeher an B (4.0)


def test_membrane_equivalence(default_built):
    """Die vektorisierte Spannungsauswertung entspricht Pynite membrane() (Ecken + Mitte)."""
    from app.postprocess import element_stresses
    names, S = element_stresses(default_built)
    m = default_built.model
    for ie in (0, len(names) // 2, len(names) - 1):
        q = m.quads[names[ie]]
        for ip, (xi, eta) in enumerate([(-1, -1), (1, -1), (1, 1), (-1, 1), (0, 0)]):
            ref = np.asarray(q.membrane(xi, eta, True, "gleich_uls"), dtype=float).reshape(-1)
            assert S["gleich_uls"][ie, ip] == pytest.approx(ref, rel=1e-6, abs=1e-6)


def test_corner_node_order(default_built):
    q = next(iter(default_built.model.quads.values()))
    i, j, m_, n = q.i_node, q.j_node, q.m_node, q.n_node
    assert i.X < j.X and i.Y == pytest.approx(j.Y) and m_.Y > j.Y and n.X < m_.X


def test_opening_validation_422():
    c = TestClient(app)
    body = {"geometrie": {"oeffnung": {"a_lager_a": 3.5, "b": 0.75, "h": 1.2, "a_oben": 0.9}}}
    r = c.post("/analyze", json=body)
    assert r.status_code == 422
    assert "Öffnung" in r.json()["detail"]
    r = c.post("/analyze", json={"geometrie": {"t_wand": -1}})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    r = c.post("/analyze", json={"material": {"beton": "C99/99"}})
    assert r.status_code == 422 and "Betongüte" in r.json()["detail"]


def test_opening_y_validation():
    c = TestClient(app)
    r = c.post("/analyze", json={"geometrie": {"oeffnung": {"a_oben": 0.01}}})
    assert r.status_code == 422


def test_health_and_cors():
    c = TestClient(app)
    r = c.get("/health", headers={"Origin": "http://localhost:3000"})
    assert r.json()["status"] == "ok" and r.json()["pynite"]
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_analyze_http_default():
    c = TestClient(app)
    t = time.time()
    r = c.post("/analyze", json={})
    assert r.status_code == 200
    assert time.time() - t < 15
    assert r.json()["meta"]["n_elements"] > 1000


def test_other_geometry_equilibrium():
    req = AnalyzeRequest.model_validate({
        "geometrie": {"b_lager_a": 0.3, "b_lager_b": 0.5, "l_licht": 4.0,
                      "oeffnung": {"a_lager_a": 1.0, "b": 1.0, "h": 1.0, "a_oben": 0.8}},
        "lasten": {"stuetze": {"Gk": 500, "Qk": 200, "x_last": 1.7}},
        "berechnung": {"netz": 0.15, "schnitte_x": [1.0, 2.0], "schnitte_y": [1.0]}})
    r = run_analysis(req)
    for k, v in r["meta"]["equilibrium"].items():
        assert abs(v["sum_reactions"] - v["sum_loads"]) / v["sum_loads"] < 1e-3
