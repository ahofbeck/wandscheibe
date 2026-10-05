"use client";
import { Shape } from "react-konva";

/** Rechteck mit diagonaler Schraffur (Bauteil im Schnitt). Koordinaten in px. */
export default function Hatch({
  x,
  y,
  w,
  h,
  spacing = 9,
  fill = "#f1f2f4",
  stroke = "#222",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  spacing?: number;
  fill?: string;
  stroke?: string;
}) {
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const c = ctx._context;
        c.save();
        c.beginPath();
        c.rect(x, y, w, h);
        c.fillStyle = fill;
        c.fill();
        c.clip();
        c.beginPath();
        for (let k = -h; k < w; k += spacing) {
          c.moveTo(x + k, y + h);
          c.lineTo(x + k + h, y);
        }
        c.strokeStyle = "#555";
        c.lineWidth = 0.8;
        c.stroke();
        c.restore();
        c.beginPath();
        c.rect(x, y, w, h);
        c.strokeStyle = stroke;
        c.lineWidth = 1.6;
        c.stroke();
      }}
    />
  );
}
