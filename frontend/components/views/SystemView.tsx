"use client";
import { useMemo } from "react";
import { Arrow, Circle, Group, Line, Rect, Shape, Text } from "react-konva";
import { derive, fmt, validate } from "@/lib/geometry";
import { buildRequest, useStore } from "@/store/useStore";
import ZoomStage, { C_LOAD, S, mkXY, type Bounds, type WallGeo } from "./canvas/common";
import WallOutline from "./canvas/WallOutline";
import Hatch from "./canvas/Hatch";
import { DimChainH, DimChainV } from "./canvas/Dimension";

const FONT = "Segoe UI, Arial, sans-serif";

/** Maßzahl: < 1 m in cm (z. B. 40), sonst m mit Komma (z. B. 3,40) – wie in der Skizze */
export function dm(v: number): string {
  return v < 0.995 ? String(Math.round(v * 100)) : fmt(v, 2);
}

function uniqSorted(a: number[]): number[] {
  const s = [...a].sort((p, q) => p - q);
  return s.filter((v, i) => i === 0 || Math.abs(v - s[i - 1]) > 1e-6);
}

export default function SystemView() {
  const inputs = useStore((s) => s.inputs);
  const auto = useStore((s) => s.schnitteAuto);
  const showMesh = useStore((s) => s.showMesh);
  const showCuts = useStore((s) => s.showCuts);
  const patch = useStore((s) => s.patch);

  const req = useMemo(() => buildRequest(inputs, auto), [inputs, auto]);
  const errors = useMemo(() => validate(req), [req]);
  const g = req.geometrie;
  const l = req.lasten;
  const d = derive(g, l);
  const { X, Y } = mkXY(d.H);

  const wall: WallGeo = { L: d.L, H: d.H, hu: g.h_decke_unten, ho: g.h_decke_oben, ox: d.ox, oy: d.oy, ob: d.ob, oh: d.oh };
  const Lpx = d.L * S;
  const Hpx = d.H * S;

  const bounds: Bounds = { x0: -125, y0: -270, x1: Lpx + 360, y1: Hpx + 200 };

  // Netzvorschau-Linien (Näherung: gleichmäßig + Steuerlinien)
  const mesh = (() => {
    const h = req.berechnung.netz;
    const grid = (len: number) => Array.from({ length: Math.floor(len / h) + 1 }, (_, i) => i * h);
    const xs = uniqSorted([...grid(d.L), g.b_lager_a, d.L - g.b_lager_b, d.xA, d.xB, d.ox, d.ox + d.ob, d.xP1, d.xP2, d.L]);
    const ys = uniqSorted([...grid(d.H), g.h_decke_unten, d.H - g.h_decke_oben, d.oy, d.oyTop, d.H]);
    return { xs: xs.filter((v) => v <= d.L + 1e-9), ys: ys.filter((v) => v <= d.H + 1e-9) };
  })();

  const nTop = Math.max(2, Math.round(d.L / 0.3));
  const topArrows = Array.from({ length: nTop + 1 }, (_, i) => (i / nTop) * Lpx);
  const botArrows = Array.from({ length: nTop + 1 }, (_, i) => (i / nTop) * Lpx);

  // Schnitt Wand
  const sx0 = Lpx + 215;
  const tw = g.t_wand * S;
  const fw = Math.max(tw * 3, 110);
  const secTop = Y(d.H);
  const secBot = Y(0);

  const gq = (a: number, b: number) => `${fmt(a, 0)}+${fmt(b, 0)}`;
  const topSum = l.oben.gk + l.oben.qk;
  const botSum = l.unten.gk + l.unten.qk;

  return (
    <ZoomStage
      bounds={bounds}
      overlay={
        <>
          <div className="absolute left-3 top-3 z-10 flex gap-2 text-[12px]">
            <label className="flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white/90 px-2 py-1 shadow-sm">
              <input type="checkbox" checked={showMesh} onChange={(e) => patch({ showMesh: e.target.checked })} /> Netzvorschau
            </label>
            <label className="flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white/90 px-2 py-1 shadow-sm">
              <input type="checkbox" checked={showCuts} onChange={(e) => patch({ showCuts: e.target.checked })} /> Schnittlinien
            </label>
          </div>
          {errors.length > 0 && (
            <div className="absolute bottom-3 left-3 z-10 max-w-md rounded border border-red-300 bg-red-50/95 px-3 py-2 text-[12.5px] text-red-800 shadow">
              <div className="font-semibold">Ungültige Eingabe – Run deaktiviert</div>
              {errors.map((e) => (
                <div key={e}>• {e}</div>
              ))}
            </div>
          )}
        </>
      }
    >
      <WallOutline g={wall} drawOpening={false} />

      {showMesh && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            const c = ctx._context;
            c.beginPath();
            for (const x of mesh.xs) {
              c.moveTo(X(x), 0);
              c.lineTo(X(x), Hpx);
            }
            for (const y of mesh.ys) {
              c.moveTo(0, Y(y));
              c.lineTo(Lpx, Y(y));
            }
            c.strokeStyle = "rgba(60,90,160,0.45)";
            c.lineWidth = 0.6;
            c.stroke();
          }}
        />
      )}

      {/* Öffnung (über Netz) */}
      <Rect x={X(d.ox)} y={Y(d.oyTop)} width={d.ob * S} height={d.oh * S} fill="#ffffff" stroke="#111" strokeWidth={1.8} listening={false} />

      {/* Schnittlinien */}
      {showCuts && (
        <Group listening={false}>
          {req.berechnung.schnitte_x.map((x, i) => (
            <Group key={`cx${i}`}>
              <Line points={[X(x), -8, X(x), Hpx + 8]} stroke="#e07b00" strokeWidth={1.3} dash={[10, 5]} />
              <Text x={X(x) - 20} y={Hpx + 10} width={40} align="center" text={`x${i + 1}`} fontSize={11} fontFamily={FONT} fill="#e07b00" />
            </Group>
          ))}
          {req.berechnung.schnitte_y.map((y, i) => (
            <Group key={`cy${i}`}>
              <Line points={[-8, Y(y), Lpx + 8, Y(y)]} stroke="#8a3fd1" strokeWidth={1.3} dash={[10, 5]} />
              <Text x={Lpx + 10} y={Y(y) - 6} text={`y${i + 1}`} fontSize={11} fontFamily={FONT} fill="#8a3fd1" />
            </Group>
          ))}
        </Group>
      )}

      {/* Betonklasse */}
      <Text x={X(d.ox + d.ob) + 16} y={Y(d.oyTop) + 8} text={`${req.material.beton}`} fontSize={22} fontStyle="bold" fontFamily={FONT} fill="#334" listening={false} />
      <Text x={X(d.ox + d.ob) + 16} y={Y(d.oyTop) + 34} text={`${req.material.exposition} · t = ${fmt(g.t_wand * 100, 0)} cm`} fontSize={12} fontFamily={FONT} fill="#556" listening={false} />

      {/* Lager */}
      <Group listening={false}>
        <Rect x={0} y={Hpx} width={g.b_lager_a * S} height={8} fill="#222" />
        <Rect x={X(d.L - g.b_lager_b)} y={Hpx} width={g.b_lager_b * S} height={8} fill="#222" />
        <Line closed points={[X(d.xA), Hpx + 8, X(d.xA) - 14, Hpx + 28, X(d.xA) + 14, Hpx + 28]} stroke="#111" strokeWidth={1.6} fill="#fff" />
        <Line closed points={[X(d.xB), Hpx + 8, X(d.xB) - 14, Hpx + 26, X(d.xB) + 14, Hpx + 26]} stroke="#111" strokeWidth={1.6} fill="#fff" />
        <Line points={[X(d.xB) - 16, Hpx + 31, X(d.xB) + 16, Hpx + 31]} stroke="#111" strokeWidth={2} />
        <Circle x={X(d.xA)} y={Hpx + 8} radius={2.5} fill="#111" />
        <Circle x={X(d.xB)} y={Hpx + 8} radius={2.5} fill="#111" />
        {/* Achsen */}
        <Line points={[X(d.xA), Hpx + 30, X(d.xA), Hpx + 105]} stroke="#999" strokeWidth={0.8} dash={[8, 3, 2, 3]} />
        <Line points={[X(d.xB), Hpx + 30, X(d.xB), Hpx + 105]} stroke="#999" strokeWidth={0.8} dash={[8, 3, 2, 3]} />
      </Group>

      {/* Reaktionen */}
      <Group listening={false}>
        {[
          [d.xA, "A_Ed"],
          [d.xB, "B_Ed"],
        ].map(([x, t]) => (
          <Group key={String(t)}>
            <Arrow points={[X(x as number) + 30, Hpx + 95, X(x as number) + 30, Hpx + 36]} stroke="#c0392b" fill="#c0392b" strokeWidth={2.5} pointerLength={9} pointerWidth={9} />
            <Text x={X(x as number) + 38} y={Hpx + 62} text={String(t)} fontSize={13} fontStyle="bold" fontFamily={FONT} fill="#c0392b" />
          </Group>
        ))}
      </Group>

      {/* Linienlast oben */}
      <Group listening={false}>
        <Line points={[0, -55, Lpx, -55]} stroke={C_LOAD} strokeWidth={2} />
        {topArrows.map((x, i) => (
          <Arrow key={i} points={[x, -55, x, -4]} stroke={C_LOAD} fill={C_LOAD} strokeWidth={1.6} pointerLength={7} pointerWidth={7} />
        ))}
        <Text x={4} y={-86} text={`g_k1 + q_k1 = ${gq(l.oben.gk, l.oben.qk)} = ${fmt(topSum, 0)} kN/m`} fontSize={13} fontStyle="bold" fontFamily={FONT} fill={C_LOAD} />
      </Group>

      {/* Stütze + Einzellast */}
      <Group listening={false}>
        <Rect x={X(d.xP1)} y={-115} width={g.b_stuetze * S} height={60} fill="#d5d9e0" stroke="#333" strokeWidth={1.2} />
        <Arrow points={[X(d.xP), -190, X(d.xP), -117]} stroke={C_LOAD} fill={C_LOAD} strokeWidth={4} pointerLength={14} pointerWidth={14} />
        <Text x={X(d.xP) + 12} y={-186} text={`G_k + Q_k = ${gq(l.stuetze.Gk, l.stuetze.Qk)} kN`} fontSize={13} fontStyle="bold" fontFamily={FONT} fill={C_LOAD} />
      </Group>

      {/* Linienlast unten (auf der unteren Decke) */}
      <Group listening={false}>
        <Line points={[0, Y(g.h_decke_unten) - 50, Lpx, Y(g.h_decke_unten) - 50]} stroke={C_LOAD} strokeWidth={2} />
        {botArrows.map((x, i) => (
          <Arrow key={i} points={[x, Y(g.h_decke_unten) - 50, x, Y(g.h_decke_unten) - 3]} stroke={C_LOAD} fill={C_LOAD} strokeWidth={1.6} pointerLength={7} pointerWidth={7} />
        ))}
        <Text x={X(d.L) - 250} y={Y(g.h_decke_unten) - 70} width={246} align="right" text={`g_k2 + q_k2 = ${gq(l.unten.gk, l.unten.qk)} = ${fmt(botSum, 0)} kN/m`} fontSize={13} fontStyle="bold" fontFamily={FONT} fill={C_LOAD} />
      </Group>

      {/* Maßketten oben: Ebene 1 (Stütze), Ebene 2 (Achsen) */}
      <DimChainH
        xs={[0, X(d.xP1), X(d.xP2), Lpx]}
        labels={[dm(d.xP1), dm(g.b_stuetze), dm(d.L - d.xP2)]}
        y={-215}
        extFrom={-118}
      />
      <DimChainH
        xs={[X(d.xA), X(d.xP), X(d.xB)]}
        labels={[dm(l.stuetze.x_last), dm(d.xB - d.xP)]}
        y={-248}
        extFrom={-218}
      />

      {/* Öffnungslage (in der Wand unter der Öffnung) */}
      <DimChainH
        xs={[X(d.xA), X(d.ox), X(d.ox + d.ob)]}
        labels={[dm(g.oeffnung.a_lager_a), dm(d.ob)]}
        y={Y(d.oy) + 28}
        extFrom={Y(d.oy) + 28 - 20}
      />
      <Line points={[X(d.xA), Y(d.oy) + 28, X(d.xA), Y(d.oy) + 6]} stroke="#9aa0ad" strokeWidth={0.8} dash={[4, 3]} listening={false} />

      {/* Maßketten unten */}
      <DimChainH
        xs={[0, g.b_lager_a * S, X(d.L - g.b_lager_b), Lpx]}
        labels={[dm(g.b_lager_a), dm(g.l_licht), dm(g.b_lager_b)]}
        y={Hpx + 130}
        extFrom={Hpx + 12}
        fontSize={13}
      />
      <DimChainH xs={[X(d.xA), X(d.xB)]} labels={[`${fmt(d.l_eff, 2)} (l_eff)`]} y={Hpx + 165} extFrom={Hpx + 132} />

      {/* links: Höhenkette + Gesamthöhe */}
      <DimChainV
        ys={[Y(d.H), Y(d.H - g.h_decke_oben), Y(g.h_decke_unten), Y(0)]}
        labels={[dm(g.h_decke_oben), dm(g.h_licht), dm(g.h_decke_unten)]}
        x={-35}
        extFrom={-4}
      />
      <DimChainV ys={[Y(d.H), Y(0)]} labels={[fmt(d.H, 2)]} x={-80} extFrom={-38} />

      {/* rechts: Höhenkette Öffnung (a_oben | h | Rest) */}
      <DimChainV
        ys={[Y(d.H), Y(d.oyTop), Y(d.oy), Y(0)]}
        labels={[dm(g.oeffnung.a_oben), dm(d.oh), dm(d.oy)]}
        x={Lpx + 55}
        extFrom={Lpx + 4}
        side={1}
      />

      {/* Schnitt Wand */}
      <Group listening={false}>
        <Text x={sx0 - 60} y={secTop - 50} width={120} align="center" text="Schnitt Wand" fontSize={15} fontStyle="bold" fontFamily={FONT} fill="#222" />
        <Hatch x={sx0 - fw / 2} y={secTop} w={fw} h={g.h_decke_oben * S} />
        <Hatch x={sx0 - fw / 2} y={secBot - g.h_decke_unten * S} w={fw} h={g.h_decke_unten * S} />
        <Hatch x={sx0 - tw / 2} y={secTop + g.h_decke_oben * S} w={tw} h={g.h_licht * S} spacing={11} />
        <DimChainH xs={[sx0 - tw / 2, sx0 + tw / 2]} labels={[`t = ${fmt(g.t_wand * 100, 0)}`]} y={secBot + 30} />
        <DimChainV
          ys={[secTop, secTop + g.h_decke_oben * S, secBot - g.h_decke_unten * S, secBot]}
          labels={[dm(g.h_decke_oben), dm(g.h_licht), dm(g.h_decke_unten)]}
          x={sx0 + fw / 2 + 28}
          extFrom={sx0 + fw / 2 + 2}
          side={1}
        />
      </Group>
    </ZoomStage>
  );
}
