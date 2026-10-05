"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Layer, Stage } from "react-konva";
import type Konva from "konva";

/** Pixel pro Meter im Zeichnungs-Koordinatensystem (Zoom/Pan wirkt zusätzlich) */
export const S = 160;

export const C_TENSION = "#d62728";
export const C_COMPRESSION = "#1f5fd6";
export const C_LOAD = "#1a9a3a";

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Wand-Geometrie für die Zeichnung (m) */
export interface WallGeo {
  L: number;
  H: number;
  hu: number; // Decke unten
  ho: number; // Decke oben
  ox: number;
  oy: number;
  ob: number;
  oh: number;
}

export const mkXY = (H: number) => ({
  X: (x: number) => x * S,
  Y: (y: number) => (H - y) * S,
});

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Divergente Skala: negativ (Druck) blau, 0 weiß, positiv (Zug) rot. */
export function divergingColor(v: number, vmax: number): string {
  const t = vmax > 0 ? Math.max(-1, Math.min(1, v / vmax)) : 0;
  if (t >= 0) {
    // weiß -> rot
    const r = 255,
      g = Math.round(lerp(255, 40, t)),
      b = Math.round(lerp(255, 40, t));
    return `rgb(${r},${g},${b})`;
  }
  const u = -t;
  return `rgb(${Math.round(lerp(255, 31, u))},${Math.round(lerp(255, 95, u))},${Math.round(lerp(255, 214, u))})`;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

interface ZoomProps {
  bounds: Bounds;
  children: ReactNode;
  overlay?: ReactNode;
  /** Pointer in Zeichnungskoordinaten (px bei Zoom 1) -> Tooltip-Text */
  onHover?: (x: number, y: number) => string | null;
}

/** Konva-Stage mit Mausrad-Zoom, Pan per Drag und "Einpassen". Per `key` zurücksetzbar. */
export default function ZoomStage({ bounds, children, overlay, onHover }: ZoomProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [user, setUser] = useState<View | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitted = useMemo<View>(() => {
    const bw = bounds.x1 - bounds.x0;
    const bh = bounds.y1 - bounds.y0;
    const sc = Math.max(0.05, Math.min(size.w / bw, size.h / bh) * 0.96);
    return {
      scale: sc,
      x: (size.w - bw * sc) / 2 - bounds.x0 * sc,
      y: (size.h - bh * sc) / 2 - bounds.y0 * sc,
    };
  }, [bounds.x0, bounds.x1, bounds.y0, bounds.y1, size.w, size.h]);
  const view = user ?? fitted;

  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const p = stage?.getPointerPosition();
      if (!p) return;
      const old = view.scale;
      const ns = Math.max(0.05, Math.min(30, old * (e.evt.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const mx = (p.x - view.x) / old;
      const my = (p.y - view.y) / old;
      setUser({ scale: ns, x: p.x - mx * ns, y: p.y - my * ns });
    },
    [view],
  );

  const onMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!onHover) return;
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!p) return;
    const text = onHover((p.x - view.x) / view.scale, (p.y - view.y) / view.scale);
    setTip(text ? { x: p.x, y: p.y, text } : null);
  };

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden bg-white">
      {size.w > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable
          onWheel={onWheel}
          onMouseMove={onMove}
          onMouseLeave={() => setTip(null)}
          onDragStart={() => setTip(null)}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setUser({ scale: view.scale, x: e.target.x(), y: e.target.y() });
          }}
        >
          <Layer>{children}</Layer>
        </Stage>
      )}
      <button
        className="absolute right-3 top-3 z-10 rounded border border-slate-300 bg-white/90 px-3 py-1 text-[12px] shadow-sm hover:bg-slate-50"
        onClick={() => setUser(null)}
      >
        Einpassen
      </button>
      {overlay}
      {tip && (
        <div
          className="pointer-events-none absolute z-20 whitespace-pre rounded bg-slate-800/95 px-2 py-1 text-[12px] leading-snug text-white shadow"
          style={{ left: Math.min(tip.x + 14, Math.max(0, size.w - 190)), top: tip.y + 14 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
