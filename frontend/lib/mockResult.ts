// ============================================================================
// DEMO-ERGEBNIS – KEINE BERECHNUNG!
// Synthetische Spannungen (Balkentheorie-artig + Gauss-Spitzen) auf einem groben
// Raster, nur um die Ergebnis-Ansichten ohne Backend visuell zu prüfen.
// Struktur exakt nach PLAN.md §4. Werte sind physikalisch NICHT belastbar.
// ============================================================================
import { derive } from "./geometry";
import type { AnalyzeRequest, AnalyzeResponse, ComboResult, ElementResult, KnotenResult, SchnittX, SchnittY } from "./types";
import { betonByName, expoCheck, fcdOf } from "./ec2";

function field(
  x: number,
  y: number,
  d: ReturnType<typeof derive>,
  fac: number,
  pointFrac: number,
): { sx: number; sy: number; txy: number } {
  const span = d.xB - d.xA;
  const xi = Math.min(Math.max((x - d.xA) / span, 0), 1);
  const sigB = 3.2 * fac * 4 * xi * (1 - xi); // Biegespannung
  const sx = sigB * (1 - (2 * y) / d.H) * (1 + 0.6 * Math.exp(-(((y - d.oy) / 0.4) ** 2))) ;
  const V = (1 - 2 * xi) * 1.4 * fac;
  const eta = y / d.H;
  const txy = V * 4 * eta * (1 - eta) * (x < d.xA || x > d.xB ? 0.3 : 1);
  const gTop = Math.exp(-(((y - d.H) / 0.35) ** 2));
  const gSup =
    Math.exp(-(((x - d.xA) / 0.3) ** 2) - ((y / 0.5) ** 2)) + Math.exp(-(((x - d.xB) / 0.3) ** 2) - ((y / 0.5) ** 2));
  const gP = Math.exp(-(((x - d.xP) / 0.35) ** 2)) * Math.exp(-(((y - d.H) / 0.9) ** 2));
  const sy = -0.9 * fac * gTop - 4.2 * fac * gSup - 5.5 * fac * pointFrac * gP;
  return { sx, sy, txy };
}

export function buildMockResult(req: AnalyzeRequest): AnalyzeResponse {
  const d = derive(req.geometrie, req.lasten);
  const h = Math.max(req.berechnung.netz, 0.1);
  const nx = Math.round(d.L / h);
  const ny = Math.round(d.H / h);
  const dx = d.L / nx;
  const dy = d.H / ny;
  const inOpen = (x: number, y: number) => x > d.ox + 1e-9 && x < d.ox + d.ob - 1e-9 && y > d.oy + 1e-9 && y < d.oyTop - 1e-9;

  const combos = [
    { key: "gleich_uls", label: "Gleichlast (GZT)  [DEMO]", fac: 0.8, pf: 0 },
    { key: "einzel_uls", label: "Einzellast (GZT)  [DEMO]", fac: 1.0, pf: 1 },
    { key: "gesamt_uls", label: "Gesamt (GZT)  [DEMO]", fac: 1.5, pf: 1 },
    { key: "gesamt_char", label: "Gesamt (charakteristisch)  [DEMO]", fac: 1.1, pf: 1 },
  ];

  const betonK = betonByName(req.material.beton);
  const fcd = fcdOf(betonK.fck);
  const fyd = 500 / 1.15;
  const t = req.geometrie.t_wand;

  const principal = (sx: number, sy: number, txy: number) => {
    const m = (sx + sy) / 2;
    const r = Math.sqrt(((sx - sy) / 2) ** 2 + txy ** 2);
    return { s1: m + r, s2: m - r, alpha: 0.5 * Math.atan2(2 * txy, sx - sy) };
  };

  const ergebnisse: Record<string, ComboResult> = {};
  const equilibrium: Record<string, { sum_loads: number; sum_reactions: number }> = {};
  const q = req.lasten;
  for (const c of combos) {
    const elemente: ElementResult[] = [];
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const x0 = i * dx, y0 = j * dy;
        const cx = x0 + dx / 2, cy = y0 + dy / 2;
        if (inOpen(cx, cy)) continue;
        const f = field(cx, cy, d, c.fac, c.pf);
        elemente.push({
          id: `Q${i}_${j}`,
          xy: [[x0, y0], [x0 + dx, y0], [x0 + dx, y0 + dy], [x0, y0 + dy]],
          cx, cy, ...f, ...principal(f.sx, f.sy, f.txy),
        });
      }
    const knoten: KnotenResult[] = [];
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= ny; j++) {
        const x = i * dx, y = j * dy;
        if (inOpen(x, y)) continue;
        const f = field(x, y, d, c.fac, c.pf);
        const p = principal(f.sx, f.sy, f.txy);
        knoten.push({ id: `N${i}_${j}`, x, y, ...f, s1: p.s1, s2: p.s2 });
      }
    const sxn = (pos: number): SchnittX => {
      const segs: { y: number; s: number }[][] = [];
      let cur: { y: number; s: number }[] = [];
      for (let j = 0; j <= ny; j++) {
        const y = j * dy;
        if (inOpen(pos, y) || (pos > d.ox - 1e-9 && pos < d.ox + d.ob + 1e-9 && y > d.oy - 1e-9 && y < d.oyTop + 1e-9 && (inOpen(pos, y + 1e-6) || inOpen(pos, y - 1e-6)))) {
          if (cur.length) segs.push(cur);
          cur = [];
          continue;
        }
        cur.push({ y, s: field(pos, y, d, c.fac, c.pf).sx });
      }
      if (cur.length) segs.push(cur);
      let Z = 0, D = 0, mx = -1e9, mn = 1e9;
      for (const sg of segs)
        for (const p of sg) {
          const w = t * dy * 1000;
          if (p.s > 0) Z += p.s * w; else D += p.s * w;
          mx = Math.max(mx, p.s); mn = Math.min(mn, p.s);
        }
      return { pos, segmente: segs, Z, D, As_erf: (Z * 1000) / fyd / 100, s_max: mx, s_min: mn };
    };
    const syn = (pos: number): SchnittY => {
      const segs: { x: number; s: number }[][] = [];
      let cur: { x: number; s: number }[] = [];
      for (let i = 0; i <= nx; i++) {
        const x = i * dx;
        if (inOpen(x, pos) || (pos > d.oy - 1e-9 && pos < d.oyTop + 1e-9 && x > d.ox + 1e-9 && x < d.ox + d.ob - 1e-9)) {
          if (cur.length) segs.push(cur);
          cur = [];
          continue;
        }
        cur.push({ x, s: field(x, pos, d, c.fac, c.pf).sy });
      }
      if (cur.length) segs.push(cur);
      let Z = 0, D = 0, mx = -1e9, mn = 1e9;
      for (const sg of segs)
        for (const p of sg) {
          const w = t * dx * 1000;
          if (p.s > 0) Z += p.s * w; else D += p.s * w;
          mx = Math.max(mx, p.s); mn = Math.min(mn, p.s);
        }
      return { pos, segmente: segs, Z, D, s_max: mx, s_min: mn };
    };
    const ext = (k: "sx" | "sy" | "s1" | "s2" | "txy") => elemente.map((e) => e[k]);
    const mx = (a: number[]) => a.reduce((m, v) => Math.max(m, v), -Infinity);
    const mn = (a: number[]) => a.reduce((m, v) => Math.min(m, v), Infinity);
    const loads =
      (c.key !== "einzel_uls" ? (q.oben.gk + q.oben.qk + q.unten.gk + q.unten.qk) * d.L * 0.5 : 0) +
      (c.key !== "gleich_uls" ? (q.stuetze.Gk + q.stuetze.Qk) * 1.4 : 0);
    const rAfix = c.key === "gleich_uls" ? loads / 2 : loads * (1 - (d.xP - d.xA) / d.l_eff);
    ergebnisse[c.key] = {
      elemente,
      knoten,
      schnitte_x: req.berechnung.schnitte_x.map(sxn),
      schnitte_y: req.berechnung.schnitte_y.map(syn),
      reaktionen: { A: { Fx: 0, Fy: rAfix }, B: { Fx: 0, Fy: loads - rAfix } },
      extrema: {
        s1_max: mx(ext("s1")),
        s2_min: mn(ext("s2")),
        sx_max: mx(ext("sx")),
        sx_min: mn(ext("sx")),
        sy_max: mx(ext("sy")),
        sy_min: mn(ext("sy")),
        txy_abs_max: mx(ext("txy").map(Math.abs)),
        ausnutzung_druck: (Math.abs(mn(ext("s2"))) / fcd) * 100,
      },
    };
    equilibrium[c.key] = { sum_loads: loads, sum_reactions: loads };
  }

  const ec = expoCheck(req.material.beton, req.material.exposition);
  return {
    meta: {
      n_nodes: (nx + 1) * (ny + 1),
      n_elements: nx * ny,
      runtime_s: 0,
      pynite: "DEMO",
      warnings: ["DEMO-ERGEBNIS: synthetische Werte, keine FE-Berechnung!"],
      equilibrium,
    },
    geometrie: {
      L: d.L, H: d.H, l_eff: d.l_eff, x_A: d.xA, x_B: d.xB,
      oeffnung: { x: d.ox, y: d.oy, b: d.ob, h: d.oh },
    },
    material: {
      beton: req.material.beton, fck: betonK.fck, fcd, fctm: betonK.fctm, Ecm: betonK.Ecm, fyd,
      exposition: req.material.exposition, min_beton: ec.min_beton, c_min_dur: ec.c_min_dur, expo_ok: ec.ok,
    },
    kombinationen: combos.map((c) => ({ key: c.key, label: c.label })),
    ergebnisse,
  };
}
