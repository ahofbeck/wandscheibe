"use client";
import { Group, Line, Rect } from "react-konva";
import Hatch from "./Hatch";
import { S, mkXY, type WallGeo } from "./common";

/** Wandumriss: Scheibe, schraffierte Decken, Öffnung. `plain` = nur Umriss (für Ergebnisansichten). */
export default function WallOutline({ g, plain = false, drawOpening = true }: { g: WallGeo; plain?: boolean; drawOpening?: boolean }) {
  const { X, Y } = mkXY(g.H);
  if (plain) {
    return (
      <Group listening={false}>
        <Line closed points={[0, 0, g.L * S, 0, g.L * S, g.H * S, 0, g.H * S]} stroke="#111" strokeWidth={1.6} />
        <Line points={[0, Y(g.hu), g.L * S, Y(g.hu)]} stroke="#555" strokeWidth={0.8} dash={[6, 4]} />
        <Line points={[0, Y(g.H - g.ho), g.L * S, Y(g.H - g.ho)]} stroke="#555" strokeWidth={0.8} dash={[6, 4]} />
        <Rect x={X(g.ox)} y={Y(g.oy + g.oh)} width={g.ob * S} height={g.oh * S} stroke="#111" strokeWidth={1.6} fill="#fff" />
      </Group>
    );
  }
  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={g.L * S} height={g.H * S} fill="#e9ecf1" stroke="#111" strokeWidth={1.8} />
      <Hatch x={0} y={Y(g.H)} w={g.L * S} h={g.ho * S} />
      <Hatch x={0} y={Y(g.hu)} w={g.L * S} h={g.hu * S} />
      {drawOpening && (
        <Rect x={X(g.ox)} y={Y(g.oy + g.oh)} width={g.ob * S} height={g.oh * S} fill="#ffffff" stroke="#111" strokeWidth={1.8} />
      )}
    </Group>
  );
}
