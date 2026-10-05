"use client";
import { Shape } from "react-konva";
import type { ElementResult } from "@/lib/types";
import { C_COMPRESSION, C_TENSION, S } from "./common";

/**
 * Kreuze je Element in Richtung der Hauptspannungen.
 * mode "length": Länge ∝ |σ| (Abb. 3.69/3.73); mode "const": konstante Länge (Trajektorien, Abb. 3.70/3.74).
 * Blau = Druck, Rot = Zug. alpha = Richtung σ1 gegen die x-Achse (y nach oben) -> Bildschirm: (cos a, -sin a).
 */
export default function PrincipalStress({
  elemente,
  H,
  cell,
  scale,
  mode,
}: {
  elemente: ElementResult[];
  H: number;
  cell: number; // Elementgröße in px
  scale: number;
  mode: "length" | "const";
}) {
  let smax = 0;
  for (const e of elemente) smax = Math.max(smax, Math.abs(e.s1), Math.abs(e.s2));
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const c = ctx._context;
        const half = (mode === "length" ? 0.95 : 0.42) * cell * scale;
        for (const sign of [-1, 1]) {
          c.beginPath();
          for (const e of elemente) {
            const px = e.cx * S;
            const py = (H - e.cy) * S;
            const ca = Math.cos(e.alpha);
            const sa = Math.sin(e.alpha);
            const arms: [number, number, number][] = [
              [e.s1, ca, -sa],
              [e.s2, sa, ca],
            ];
            for (const [s, dx, dy] of arms) {
              if (Math.sign(s) !== sign || Math.abs(s) < 1e-9) continue;
              const len = mode === "length" ? (Math.abs(s) / (smax || 1)) * half : half;
              c.moveTo(px - dx * len, py - dy * len);
              c.lineTo(px + dx * len, py + dy * len);
            }
          }
          c.strokeStyle = sign < 0 ? C_COMPRESSION : C_TENSION;
          c.lineWidth = mode === "length" ? 1.6 : 1.2;
          c.stroke();
        }
      }}
    />
  );
}
