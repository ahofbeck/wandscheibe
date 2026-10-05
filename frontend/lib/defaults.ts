import { derive, round } from "./geometry";
import type { AnalyzeRequest, Berechnung, Geometrie, Lasten } from "./types";

export const DEFAULT_INPUTS: AnalyzeRequest = {
  geometrie: {
    t_wand: 0.3,
    b_lager_a: 0.4,
    b_lager_b: 0.4,
    l_licht: 3.4,
    h_licht: 2.6,
    h_decke_oben: 0.2,
    h_decke_unten: 0.2,
    oeffnung: { a_lager_a: 1.1, b: 0.75, h: 1.2, a_oben: 0.9 },
    b_stuetze: 0.4,
  },
  material: { beton: "C30/37", exposition: "XC1", gamma_beton: 25 },
  lasten: {
    oben: { gk: 20, qk: 8 },
    unten: { gk: 20, qk: 8 },
    stuetze: { Gk: 1000, Qk: 600, x_last: 2.1 },
  },
  berechnung: { netz: 0.1, schnitte_x: [0.6, 1.3, 2.05, 3.3], schnitte_y: [2.9, 2.45, 1.5, 0.55, 0.1] },
};

/** Default-Schnittpositionen aus der Geometrie (PLAN §3.4) */
export function defaultSchnitte(g: Geometrie, l: Lasten): Pick<Berechnung, "schnitte_x" | "schnitte_y"> {
  const d = derive(g, l);
  const sx = [d.xA + 0.4, d.ox, d.ox + d.ob, d.xB - 0.7];
  const hdo = g.h_decke_oben;
  const hdu = g.h_decke_unten;
  const sy = [
    d.H - hdo / 2,
    d.oyTop + (d.H - hdo - d.oyTop) / 2,
    d.oy + d.oh / 2,
    d.oy / 2 + hdu / 2,
    hdu / 2,
  ];
  return { schnitte_x: sx.map((v) => round(v, 3)), schnitte_y: sy.map((v) => round(v, 3)) };
}
