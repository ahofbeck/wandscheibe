import type { AnalyzeRequest, Geometrie, Lasten } from "./types";

export const MIN_STEG = 0.05;

export interface Derived {
  L: number;
  H: number;
  l_eff: number;
  xA: number;
  xB: number;
  ox: number; // Öffnung links
  oy: number; // Öffnung Unterkante
  ob: number;
  oh: number;
  oyTop: number;
  xP: number; // Achse Einzellast
  xP1: number;
  xP2: number;
}

export function derive(g: Geometrie, l: Lasten): Derived {
  const L = g.b_lager_a + g.l_licht + g.b_lager_b;
  const H = g.h_decke_unten + g.h_licht + g.h_decke_oben;
  const xA = g.b_lager_a / 2;
  const xB = L - g.b_lager_b / 2;
  const ox = xA + g.oeffnung.a_lager_a;
  const oyTop = H - g.oeffnung.a_oben;
  const oy = oyTop - g.oeffnung.h;
  const xP = xA + l.stuetze.x_last;
  return {
    L,
    H,
    l_eff: g.b_lager_a / 2 + g.l_licht + g.b_lager_b / 2,
    xA,
    xB,
    ox,
    oy,
    ob: g.oeffnung.b,
    oh: g.oeffnung.h,
    oyTop,
    xP,
    xP1: xP - g.b_stuetze / 2,
    xP2: xP + g.b_stuetze / 2,
  };
}

export function validate(req: AnalyzeRequest): string[] {
  const e: string[] = [];
  const g = req.geometrie;
  const d = derive(g, req.lasten);
  const pos: [string, number][] = [
    ["Wanddicke", g.t_wand],
    ["Lagerbreite A", g.b_lager_a],
    ["Lagerbreite B", g.b_lager_b],
    ["Lichter Auflagerabstand", g.l_licht],
    ["Lichte Geschosshöhe", g.h_licht],
    ["Deckenhöhe oben", g.h_decke_oben],
    ["Deckenhöhe unten", g.h_decke_unten],
    ["Öffnungsbreite", g.oeffnung.b],
    ["Öffnungshöhe", g.oeffnung.h],
    ["Stützenbreite", g.b_stuetze],
    ["Netzweite", req.berechnung.netz],
    ["γ Beton", req.material.gamma_beton],
  ];
  for (const [n, v] of pos) if (!(v > 0) || !isFinite(v)) e.push(`${n} muss > 0 sein.`);
  if (e.length) return e;
  if (d.ox < MIN_STEG) e.push("Öffnung liegt zu nah am linken Rand (Mindeststeg 5 cm).");
  if (d.ox + d.ob > d.L - MIN_STEG) e.push("Öffnung ragt über den rechten Wandrand (Mindeststeg 5 cm).");
  if (d.oy < MIN_STEG) e.push("Öffnung liegt zu nah am unteren Wandrand (Mindeststeg 5 cm).");
  if (d.oyTop > d.H - MIN_STEG) e.push("Öffnung liegt zu nah am oberen Wandrand (Mindeststeg 5 cm).");
  if (d.xP1 < 0 || d.xP2 > d.L) e.push("Der Einzellastbereich liegt außerhalb der Wand.");
  return e;
}

export function round(v: number, n = 4): number {
  const f = Math.pow(10, n);
  return Math.round(v * f) / f;
}

/** Zahlenformat mit deutschem Dezimalkomma */
export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "–";
  return v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export type { Geometrie };
