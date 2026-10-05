"use client";
import { Group, Line, Text } from "react-konva";

const DIM = "#333";
const FONT = "Segoe UI, Arial, sans-serif";

function Tick({ x, y }: { x: number; y: number }) {
  return <Line points={[x - 4, y + 4, x + 4, y - 4]} stroke={DIM} strokeWidth={1.4} listening={false} />;
}

/** Horizontale Maßkette: xs in px (aufsteigend), Beschriftung je Segment, auf Höhe y (px). */
export function DimChainH({
  xs,
  labels,
  y,
  extFrom,
  fontSize = 13,
}: {
  xs: number[];
  labels: string[];
  y: number;
  /** Maßhilfslinien von dieser y-Position (px) bis zur Maßlinie */
  extFrom?: number;
  fontSize?: number;
}) {
  return (
    <Group listening={false}>
      <Line points={[xs[0] - 6, y, xs[xs.length - 1] + 6, y]} stroke={DIM} strokeWidth={1} />
      {xs.map((x, i) => (
        <Group key={i}>
          {extFrom !== undefined && (
            <Line points={[x, extFrom, x, y + (extFrom > y ? -5 : 5)]} stroke="#9aa0ad" strokeWidth={0.8} dash={[4, 3]} />
          )}
          <Tick x={x} y={y} />
        </Group>
      ))}
      {labels.map((t, i) => {
        const mid = (xs[i] + xs[i + 1]) / 2;
        return (
          <Text key={i} x={mid - 60} width={120} align="center" y={y - fontSize - 4} text={t} fontSize={fontSize}
            fontFamily={FONT} fill="#111" />
        );
      })}
    </Group>
  );
}

/** Vertikale Maßkette: ys in px (aufsteigend), Maßlinie bei x (px); side: Text links (-1) oder rechts (+1). */
export function DimChainV({
  ys,
  labels,
  x,
  extFrom,
  side = -1,
  fontSize = 13,
}: {
  ys: number[];
  labels: string[];
  x: number;
  extFrom?: number;
  side?: -1 | 1;
  fontSize?: number;
}) {
  return (
    <Group listening={false}>
      <Line points={[x, ys[0] - 6, x, ys[ys.length - 1] + 6]} stroke={DIM} strokeWidth={1} />
      {ys.map((y, i) => (
        <Group key={i}>
          {extFrom !== undefined && (
            <Line points={[extFrom, y, x + (extFrom > x ? 5 : -5), y]} stroke="#9aa0ad" strokeWidth={0.8} dash={[4, 3]} />
          )}
          <Tick x={x} y={y} />
        </Group>
      ))}
      {labels.map((t, i) => {
        const mid = (ys[i] + ys[i + 1]) / 2;
        return (
          <Text key={i} rotation={-90} x={side < 0 ? x - fontSize - 4 : x + 4} y={mid + 60} width={120} align="center"
            text={t} fontSize={fontSize} fontFamily={FONT} fill="#111" />
        );
      })}
    </Group>
  );
}
