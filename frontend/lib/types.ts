// Typen exakt nach PLAN.md §4 (API-Vertrag). Einheiten: m, kN; Spannungen MPa.

export interface Oeffnung {
  a_lager_a: number;
  b: number;
  h: number;
  a_oben: number;
}
export interface Geometrie {
  t_wand: number;
  b_lager_a: number;
  b_lager_b: number;
  l_licht: number;
  h_licht: number;
  h_decke_oben: number;
  h_decke_unten: number;
  oeffnung: Oeffnung;
  b_stuetze: number;
}
export interface Material {
  beton: string;
  exposition: string;
  gamma_beton: number;
}
export interface Linienlast {
  gk: number;
  qk: number;
}
export interface Stuetze {
  Gk: number;
  Qk: number;
  x_last: number;
}
export interface Lasten {
  oben: Linienlast;
  unten: Linienlast;
  stuetze: Stuetze;
}
export interface Berechnung {
  netz: number;
  schnitte_x: number[];
  schnitte_y: number[];
}
export interface AnalyzeRequest {
  geometrie: Geometrie;
  material: Material;
  lasten: Lasten;
  berechnung: Berechnung;
}

export interface Equilibrium {
  sum_loads: number;
  sum_reactions: number;
}
export interface Meta {
  n_nodes: number;
  n_elements: number;
  runtime_s: number;
  pynite: string;
  warnings: string[];
  equilibrium: Record<string, Equilibrium>;
}
export interface GeometrieResult {
  L: number;
  H: number;
  l_eff: number;
  x_A: number;
  x_B: number;
  oeffnung: { x: number; y: number; b: number; h: number };
}
export interface MaterialResult {
  beton: string;
  fck: number;
  fcd: number;
  fctm: number;
  Ecm: number;
  fyd: number;
  exposition: string;
  min_beton: string;
  c_min_dur: number | null;
  expo_ok: boolean;
}
export interface Kombination {
  key: string;
  label: string;
}
export interface ElementResult {
  id: string;
  xy: [number, number][];
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  txy: number;
  s1: number;
  s2: number;
  alpha: number;
}
export interface KnotenResult {
  id: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  txy: number;
  s1: number;
  s2: number;
}
export interface PunktY {
  y: number;
  s: number;
}
export interface PunktX {
  x: number;
  s: number;
}
export interface SchnittX {
  pos: number;
  segmente: PunktY[][];
  Z: number;
  D: number;
  As_erf: number;
  s_max: number;
  s_min: number;
}
export interface SchnittY {
  pos: number;
  segmente: PunktX[][];
  Z: number;
  D: number;
  s_max: number;
  s_min: number;
}
export interface Reaktion {
  Fx: number;
  Fy: number;
}
export interface Extrema {
  s1_max: number;
  s2_min: number;
  sx_max: number;
  sx_min: number;
  sy_max: number;
  sy_min: number;
  txy_abs_max: number;
  ausnutzung_druck: number;
}
export interface ComboResult {
  elemente: ElementResult[];
  knoten: KnotenResult[];
  schnitte_x: SchnittX[];
  schnitte_y: SchnittY[];
  reaktionen: { A: Reaktion; B: Reaktion };
  extrema: Extrema;
}
export interface AnalyzeResponse {
  meta: Meta;
  geometrie: GeometrieResult;
  material: MaterialResult;
  kombinationen: Kombination[];
  ergebnisse: Record<string, ComboResult>;
}

export type ContourField = "sx" | "sy" | "txy" | "s1" | "s2";
export type ResultViewKind = "haupt" | "traj" | "schnx" | "schny" | "kontur";
