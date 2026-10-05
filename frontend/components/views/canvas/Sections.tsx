"use client";
import { Group, Shape, Text } from "react-konva";
import { fmt } from "@/lib/geometry";
import type { SchnittX, SchnittY } from "@/lib/types";
import { C_COMPRESSION, C_TENSION, S } from "./common";

const FONT = "Segoe UI, Arial, sans-serif";
const FILL_T = "rgba(214,39,40,0.45)";
const FILL_C = "rgba(31,95,214,0.45)";

/** σx-Schnitte: vertikale Schnittlinien, Verlauf senkrecht dazu (Zug nach rechts, Druck nach links) – Abb. 3.71/3.75 */
export function SectionsX({ cuts, H, L, scale }: { cuts: SchnittX[]; H: number; L: number; scale: number }) {
  let m = 0;
  for (const c of cuts) m = Math.max(m, Math.abs(c.s_max), Math.abs(c.s_min));
  const k = (0.5 * S * scale) / (m || 1); // px je MPa
  const labels: { x: number; y: number; t: string; tension: boolean }[] = [];
  for (const c of cuts) {
    let imax: { y: number; s: number } | null = null;
    let imin: { y: number; s: number } | null = null;
    for (const sg of c.segmente)
      for (const p of sg) {
        if (!imax || p.s > imax.s) imax = p;
        if (!imin || p.s < imin.s) imin = p;
      }
    if (imax && imax.s > 0)
      labels.push({ x: c.pos * S + imax.s * k + 4, y: (H - imax.y) * S - 6, t: fmt(imax.s, 2), tension: true });
    if (imin && imin.s < 0)
      labels.push({ x: c.pos * S + imin.s * k - 44, y: (H - imin.y) * S - 6, t: fmt(imin.s, 2), tension: false });
  }
  return (
    <Group listening={false}>
      <Shape
        listening={false}
        sceneFunc={(ctx) => {
          const c = ctx._context;
          for (const cut of cuts) {
            const x0 = cut.pos * S;
            for (const sg of cut.segmente) {
              if (sg.length < 2) continue;
              const path = () => {
                c.beginPath();
                c.moveTo(x0, (H - sg[0].y) * S);
                for (const p of sg) c.lineTo(x0 + p.s * k, (H - p.y) * S);
                c.lineTo(x0, (H - sg[sg.length - 1].y) * S);
                c.closePath();
              };
              for (const sign of [1, -1]) {
                c.save();
                c.beginPath();
                if (sign > 0) c.rect(x0, -1e5, 2e5, 4e5);
                else c.rect(x0 - 2e5, -1e5, 2e5, 4e5);
                c.clip();
                path();
                c.fillStyle = sign > 0 ? FILL_T : FILL_C;
                c.fill();
                c.restore();
              }
              c.beginPath();
              c.moveTo(x0 + sg[0].s * k, (H - sg[0].y) * S);
              for (const p of sg) c.lineTo(x0 + p.s * k, (H - p.y) * S);
              c.strokeStyle = "#222";
              c.lineWidth = 1.2;
              c.stroke();
            }
            c.beginPath();
            c.moveTo(x0, 0);
            c.lineTo(x0, H * S);
            c.strokeStyle = "#777";
            c.setLineDash([6, 4]);
            c.lineWidth = 0.8;
            c.stroke();
            c.setLineDash([]);
          }
        }}
      />
      {labels.map((l, i) => (
        <Text
          key={i}
          x={l.x}
          width={40}
          align={l.tension ? "left" : "right"}
          y={l.y}
          text={l.t}
          fontSize={11}
          fontStyle="bold"
          fontFamily={FONT}
          fill={l.tension ? C_TENSION : C_COMPRESSION}
        />
      ))}
      {cuts.map((c, i) => (
        <Text
          key={`z${i}`}
          x={c.pos * S - 55}
          width={110}
          align="center"
          y={-52}
          text={`x = ${fmt(c.pos, 2)} m\nZ = ${fmt(c.Z, 0)} kN\nA_s,erf = ${fmt(c.As_erf, 1)} cm²`}
          fontSize={11}
          fontFamily={FONT}
          fill="#222"
        />
      ))}
      <Text
        x={0}
        y={H * S + 8}
        text={`σx in N/mm² · Zug rechts (rot), Druck links (blau) · Breite ${fmt(L, 2)} m`}
        fontSize={11}
        fontFamily={FONT}
        fill="#555"
      />
    </Group>
  );
}

/** σy-Schnitte: horizontale Schnittlinien, Verlauf senkrecht dazu (Zug nach oben, Druck nach unten) – Abb. 3.72/3.76 */
export function SectionsY({ cuts, H, L, scale }: { cuts: SchnittY[]; H: number; L: number; scale: number }) {
  let m = 0;
  for (const c of cuts) m = Math.max(m, Math.abs(c.s_max), Math.abs(c.s_min));
  const k = (0.35 * S * scale) / (m || 1);
  const labels: { x: number; y: number; t: string; tension: boolean }[] = [];
  for (const c of cuts) {
    let imax: { x: number; s: number } | null = null;
    let imin: { x: number; s: number } | null = null;
    for (const sg of c.segmente)
      for (const p of sg) {
        if (!imax || p.s > imax.s) imax = p;
        if (!imin || p.s < imin.s) imin = p;
      }
    const y0 = (H - c.pos) * S;
    if (imax && imax.s > 0) labels.push({ x: imax.x * S - 20, y: y0 - imax.s * k - 14, t: fmt(imax.s, 2), tension: true });
    if (imin && imin.s < 0) labels.push({ x: imin.x * S - 20, y: y0 - imin.s * k + 3, t: fmt(imin.s, 2), tension: false });
  }
  return (
    <Group listening={false}>
      <Shape
        listening={false}
        sceneFunc={(ctx) => {
          const c = ctx._context;
          for (const cut of cuts) {
            const y0 = (H - cut.pos) * S;
            for (const sg of cut.segmente) {
              if (sg.length < 2) continue;
              const path = () => {
                c.beginPath();
                c.moveTo(sg[0].x * S, y0);
                for (const p of sg) c.lineTo(p.x * S, y0 - p.s * k);
                c.lineTo(sg[sg.length - 1].x * S, y0);
                c.closePath();
              };
              for (const sign of [1, -1]) {
                c.save();
                c.beginPath();
                if (sign > 0) c.rect(-1e5, y0 - 2e5, 4e5, 2e5);
                else c.rect(-1e5, y0, 4e5, 2e5);
                c.clip();
                path();
                c.fillStyle = sign > 0 ? FILL_T : FILL_C;
                c.fill();
                c.restore();
              }
              c.beginPath();
              c.moveTo(sg[0].x * S, y0 - sg[0].s * k);
              for (const p of sg) c.lineTo(p.x * S, y0 - p.s * k);
              c.strokeStyle = "#222";
              c.lineWidth = 1.2;
              c.stroke();
            }
            c.beginPath();
            c.moveTo(0, y0);
            c.lineTo(L * S, y0);
            c.strokeStyle = "#777";
            c.setLineDash([6, 4]);
            c.lineWidth = 0.8;
            c.stroke();
            c.setLineDash([]);
          }
        }}
      />
      {labels.map((l, i) => (
        <Text
          key={i}
          x={l.x}
          width={40}
          align="center"
          y={l.y}
          text={l.t}
          fontSize={11}
          fontStyle="bold"
          fontFamily={FONT}
          fill={l.tension ? C_TENSION : C_COMPRESSION}
        />
      ))}
      {cuts.map((c, i) => (
        <Text
          key={`z${i}`}
          x={L * S + 8}
          y={(H - c.pos) * S - 14}
          text={`y = ${fmt(c.pos, 2)} m\nZ = ${fmt(c.Z, 0)} kN · D = ${fmt(c.D, 0)} kN`}
          fontSize={11}
          fontFamily={FONT}
          fill="#222"
        />
      ))}
      <Text x={0} y={H * S + 8} text="σy in N/mm² · Zug oben (rot), Druck unten (blau)" fontSize={11} fontFamily={FONT} fill="#555" />
    </Group>
  );
}
