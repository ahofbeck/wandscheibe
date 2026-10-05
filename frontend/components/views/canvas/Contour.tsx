"use client";
import { Shape } from "react-konva";
import type { ContourField, ElementResult } from "@/lib/types";
import { S, divergingColor } from "./common";

export function contourRange(elemente: ElementResult[], field: ContourField): number {
  let m = 0;
  for (const e of elemente) m = Math.max(m, Math.abs(e[field]));
  return m;
}

/** Elementweise gefüllte Konturdarstellung (divergente Skala, weiß = 0) */
export default function Contour({
  elemente,
  field,
  H,
  vmax,
}: {
  elemente: ElementResult[];
  field: ContourField;
  H: number;
  vmax: number;
}) {
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const c = ctx._context;
        for (const e of elemente) {
          const col = divergingColor(e[field], vmax);
          c.beginPath();
          e.xy.forEach(([x, y], i) => {
            const px = x * S;
            const py = (H - y) * S;
            if (i === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          });
          c.closePath();
          c.fillStyle = col;
          c.fill();
          c.strokeStyle = col;
          c.lineWidth = 0.6;
          c.stroke();
        }
      }}
    />
  );
}
