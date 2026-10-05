// PLAN.md §5 – identisch zu backend/app/ec2.py
export interface BetonKlasse {
  name: string;
  fck: number;
  fctm: number;
  Ecm: number;
}
export const BETON: BetonKlasse[] = [
  { name: "C12/15", fck: 12, fctm: 1.6, Ecm: 27000 },
  { name: "C16/20", fck: 16, fctm: 1.9, Ecm: 29000 },
  { name: "C20/25", fck: 20, fctm: 2.2, Ecm: 30000 },
  { name: "C25/30", fck: 25, fctm: 2.6, Ecm: 31000 },
  { name: "C30/37", fck: 30, fctm: 2.9, Ecm: 33000 },
  { name: "C35/45", fck: 35, fctm: 3.2, Ecm: 34000 },
  { name: "C40/50", fck: 40, fctm: 3.5, Ecm: 35000 },
  { name: "C45/55", fck: 45, fctm: 3.8, Ecm: 36000 },
  { name: "C50/60", fck: 50, fctm: 4.1, Ecm: 37000 },
  { name: "C55/67", fck: 55, fctm: 4.2, Ecm: 38000 },
  { name: "C60/75", fck: 60, fctm: 4.4, Ecm: 39000 },
  { name: "C70/85", fck: 70, fctm: 4.6, Ecm: 41000 },
  { name: "C80/95", fck: 80, fctm: 4.8, Ecm: 42000 },
  { name: "C90/105", fck: 90, fctm: 5.0, Ecm: 44000 },
  { name: "C100/115", fck: 100, fctm: 5.2, Ecm: 45000 },
];

export interface Expo {
  name: string;
  min_beton: string;
  c_min_dur: number | null;
}
export const EXPOSITION: Expo[] = [
  { name: "X0", min_beton: "C12/15", c_min_dur: 10 },
  { name: "XC1", min_beton: "C16/20", c_min_dur: 10 },
  { name: "XC2", min_beton: "C16/20", c_min_dur: 20 },
  { name: "XC3", min_beton: "C20/25", c_min_dur: 20 },
  { name: "XC4", min_beton: "C25/30", c_min_dur: 25 },
  { name: "XD1", min_beton: "C30/37", c_min_dur: 40 },
  { name: "XD2", min_beton: "C35/45", c_min_dur: 40 },
  { name: "XD3", min_beton: "C35/45", c_min_dur: 40 },
  { name: "XS1", min_beton: "C30/37", c_min_dur: 40 },
  { name: "XS2", min_beton: "C35/45", c_min_dur: 40 },
  { name: "XS3", min_beton: "C35/45", c_min_dur: 40 },
  { name: "XF1", min_beton: "C25/30", c_min_dur: null },
  { name: "XF2", min_beton: "C25/30", c_min_dur: null },
  { name: "XF3", min_beton: "C25/30", c_min_dur: null },
  { name: "XF4", min_beton: "C30/37", c_min_dur: null },
  { name: "XA1", min_beton: "C25/30", c_min_dur: null },
  { name: "XA2", min_beton: "C35/45", c_min_dur: null },
  { name: "XA3", min_beton: "C35/45", c_min_dur: null },
  { name: "XM1", min_beton: "C30/37", c_min_dur: null },
  { name: "XM2", min_beton: "C35/45", c_min_dur: null },
  { name: "XM3", min_beton: "C35/45", c_min_dur: null },
];

export function betonByName(n: string): BetonKlasse {
  return BETON.find((b) => b.name === n) ?? BETON[4];
}
export function expoByName(n: string): Expo {
  return EXPOSITION.find((e) => e.name === n) ?? EXPOSITION[1];
}
/** fcd = 0,85·fck/1,5 (DE-NA) */
export function fcdOf(fck: number): number {
  return (0.85 * fck) / 1.5;
}
export function expoCheck(beton: string, exposition: string) {
  const b = betonByName(beton);
  const e = expoByName(exposition);
  const min = betonByName(e.min_beton);
  return { ok: b.fck >= min.fck, min_beton: e.min_beton, c_min_dur: e.c_min_dur };
}
