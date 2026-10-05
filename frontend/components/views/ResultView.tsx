"use client";
import { useMemo } from "react";
import { fmt } from "@/lib/geometry";
import type { AnalyzeResponse, ComboResult, ContourField, ElementResult, ResultViewKind } from "@/lib/types";
import { buildRequest, hashRequest, useStore } from "@/store/useStore";
import ZoomStage, { S, type Bounds, type WallGeo } from "./canvas/common";
import WallOutline from "./canvas/WallOutline";
import PrincipalStress from "./canvas/PrincipalStress";
import Contour, { contourRange } from "./canvas/Contour";
import Legend from "./canvas/Legend";
import { SectionsX, SectionsY } from "./canvas/Sections";

const VIEWS: { id: ResultViewKind; label: string }[] = [
  { id: "haupt", label: "Hauptspannungen" },
  { id: "traj", label: "Trajektorien" },
  { id: "schnx", label: "Schnitte σx" },
  { id: "schny", label: "Schnitte σy" },
  { id: "kontur", label: "Konturplot" },
];
const FIELDS: { id: ContourField; label: string }[] = [
  { id: "sx", label: "σx" },
  { id: "sy", label: "σy" },
  { id: "txy", label: "τxy" },
  { id: "s1", label: "σ1" },
  { id: "s2", label: "σ2" },
];

function ResultCanvas({ cr, kind, field, scale, wall }: {
  cr: ComboResult;
  kind: ResultViewKind;
  field: ContourField;
  scale: number;
  wall: WallGeo;
}) {
  const { L, H } = wall;
  const elemente = cr.elemente;
  const cell = useMemo(() => {
    const e = elemente[0];
    if (!e) return 0.1 * S;
    const w = Math.abs(e.xy[1][0] - e.xy[0][0]);
    const h = Math.abs(e.xy[3][1] - e.xy[0][1]);
    return Math.sqrt(w * h) * S;
  }, [elemente]);
  const vmax = useMemo(() => contourRange(elemente, field), [elemente, field]);

  const bounds: Bounds = {
    x0: -40,
    y0: kind === "schnx" ? -90 : -30,
    x1: L * S + (kind === "schny" ? 230 : 40),
    y1: H * S + 40,
  };

  const hover = (wx: number, wy: number): string | null => {
    const x = wx / S;
    const y = H - wy / S;
    if (x < 0 || x > L || y < 0 || y > H) return null;
    let best: ElementResult | null = null;
    let bd = Infinity;
    for (const e of elemente) {
      const d = (e.cx - x) ** 2 + (e.cy - y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best || Math.sqrt(bd) > (cell / S) * 0.9) return null;
    return `Element ${best.id}  (x=${fmt(best.cx, 2)} m, y=${fmt(best.cy, 2)} m)\nσx = ${fmt(best.sx, 2)}   σy = ${fmt(best.sy, 2)}   τxy = ${fmt(best.txy, 2)}\nσ1 = ${fmt(best.s1, 2)}   σ2 = ${fmt(best.s2, 2)} N/mm²`;
  };

  return (
    <ZoomStage
      key={kind}
      bounds={bounds}
      onHover={hover}
      overlay={kind === "kontur" ? <Legend vmax={vmax} title={FIELDS.find((f) => f.id === field)?.label ?? ""} /> : undefined}
    >
      {kind === "kontur" && <Contour elemente={elemente} field={field} H={H} vmax={vmax} />}
      {(kind === "haupt" || kind === "traj") && (
        <PrincipalStress elemente={elemente} H={H} cell={cell} scale={scale} mode={kind === "haupt" ? "length" : "const"} />
      )}
      {kind === "schnx" && <SectionsX cuts={cr.schnitte_x} H={H} L={L} scale={scale} />}
      {kind === "schny" && <SectionsY cuts={cr.schnitte_y} H={H} L={L} scale={scale} />}
      <WallOutline g={wall} plain />
    </ZoomStage>
  );
}

function Row({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 pr-3 text-slate-500">{k}</td>
      <td className="py-1 text-right font-medium tabular-nums">{v}</td>
      <td className="py-1 pl-2 text-slate-400">{unit}</td>
    </tr>
  );
}

function Kennwerte({ res, cr, combo }: { res: AnalyzeResponse; cr: ComboResult; combo: string }) {
  const eq = res.meta.equilibrium[combo];
  const dev = eq && eq.sum_loads !== 0 ? ((eq.sum_reactions - eq.sum_loads) / eq.sum_loads) * 100 : 0;
  const ex = cr.extrema;
  const m = res.material;
  const sumR = cr.reaktionen.A.Fy + cr.reaktionen.B.Fy;
  return (
    <div className="grid grid-cols-1 gap-4 p-3 text-[12.5px] xl:grid-cols-3">
      <div className="rounded border border-slate-200 bg-white p-3">
        <h4 className="mb-1 text-[13px] font-semibold">Auflagerkräfte &amp; Gleichgewicht</h4>
        <table className="w-full">
          <tbody>
            <Row k="A_Ed (Fy)" v={fmt(cr.reaktionen.A.Fy, 1)} unit="kN" />
            <Row k="A (Fx)" v={fmt(cr.reaktionen.A.Fx, 1)} unit="kN" />
            <Row k="B_Ed (Fy)" v={fmt(cr.reaktionen.B.Fy, 1)} unit="kN" />
            <Row k="B (Fx)" v={fmt(cr.reaktionen.B.Fx, 1)} unit="kN" />
            <Row k="Σ Reaktionen" v={fmt(eq?.sum_reactions ?? sumR, 1)} unit="kN" />
            <Row k="Σ Lasten" v={fmt(eq?.sum_loads, 1)} unit="kN" />
            <tr className="border-t border-slate-100">
              <td className="py-1 pr-3 text-slate-500">Gleichgewicht</td>
              <td className={`py-1 text-right font-medium ${Math.abs(dev) < 0.1 ? "text-green-700" : "text-red-700"}`}>
                {fmt(dev, 3)} % {Math.abs(dev) < 0.1 ? "✓" : "✗"}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rounded border border-slate-200 bg-white p-3">
        <h4 className="mb-1 text-[13px] font-semibold">Extremwerte &amp; Ausnutzung</h4>
        <table className="w-full">
          <tbody>
            <Row k="max σ1" v={fmt(ex.s1_max, 2)} unit="N/mm²" />
            <Row k="min σ2" v={fmt(ex.s2_min, 2)} unit="N/mm²" />
            <Row k="σx max / min" v={`${fmt(ex.sx_max, 2)} / ${fmt(ex.sx_min, 2)}`} unit="N/mm²" />
            <Row k="σy max / min" v={`${fmt(ex.sy_max, 2)} / ${fmt(ex.sy_min, 2)}`} unit="N/mm²" />
            <Row k="max |τxy|" v={fmt(ex.txy_abs_max, 2)} unit="N/mm²" />
            <Row k={`f_cd (${m.beton})`} v={fmt(m.fcd, 2)} unit="N/mm²" />
            <Row k="Ausnutzung Druck |σ2|/f_cd" v={fmt(ex.ausnutzung_druck, 1)} unit="%" />
          </tbody>
        </table>
      </div>
      <div className="rounded border border-slate-200 bg-white p-3">
        <h4 className="mb-1 text-[13px] font-semibold">Schnitt-Resultierende</h4>
        <table className="w-full">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="font-normal">Schnitt</th>
              <th className="text-right font-normal">Z [kN]</th>
              <th className="text-right font-normal">D [kN]</th>
              <th className="text-right font-normal">A_s [cm²]</th>
            </tr>
          </thead>
          <tbody>
            {cr.schnitte_x.map((s, i) => (
              <tr key={`x${i}`} className="border-t border-slate-100 tabular-nums">
                <td className="py-0.5">σx @ x={fmt(s.pos, 2)}</td>
                <td className="text-right">{fmt(s.Z, 0)}</td>
                <td className="text-right">{fmt(s.D, 0)}</td>
                <td className="text-right">{fmt(s.As_erf, 1)}</td>
              </tr>
            ))}
            {cr.schnitte_y.map((s, i) => (
              <tr key={`y${i}`} className="border-t border-slate-100 tabular-nums">
                <td className="py-0.5">σy @ y={fmt(s.pos, 2)}</td>
                <td className="text-right">{fmt(s.Z, 0)}</td>
                <td className="text-right">{fmt(s.D, 0)}</td>
                <td className="text-right text-slate-300">–</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(res.meta.warnings.length > 0 || !m.expo_ok) && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 xl:col-span-3">
          {!m.expo_ok && (
            <div>
              Betongüte {m.beton} liegt unter der Mindestklasse {m.min_beton} für {m.exposition}.
            </div>
          )}
          {res.meta.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}
      <div className="text-slate-400 xl:col-span-3">
        {res.meta.n_nodes} Knoten · {res.meta.n_elements} Elemente · {fmt(res.meta.runtime_s, 1)} s · PyNite {res.meta.pynite}
      </div>
    </div>
  );
}

export default function ResultView() {
  const res = useStore((s) => s.result);
  const resultHash = useStore((s) => s.resultHash);
  const isDemo = useStore((s) => s.isDemo);
  const inputs = useStore((s) => s.inputs);
  const auto = useStore((s) => s.schnitteAuto);
  const combo = useStore((s) => s.combo);
  const view = useStore((s) => s.view);
  const contour = useStore((s) => s.contour);
  const scale = useStore((s) => s.scale);
  const patch = useStore((s) => s.patch);

  const stale = useMemo(() => !!resultHash && hashRequest(buildRequest(inputs, auto)) !== resultHash, [inputs, auto, resultHash]);

  if (!res) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-slate-500">
        Noch kein Ergebnis – bitte mit „Run“ eine Berechnung starten.
      </div>
    );
  }
  const cr = res.ergebnisse[combo] ?? res.ergebnisse[res.kombinationen[0]?.key];
  const g = inputs.geometrie;
  const wall: WallGeo = {
    L: res.geometrie.L,
    H: res.geometrie.H,
    hu: g.h_decke_unten,
    ho: g.h_decke_oben,
    ox: res.geometrie.oeffnung.x,
    oy: res.geometrie.oeffnung.y,
    ob: res.geometrie.oeffnung.b,
    oh: res.geometrie.oeffnung.h,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {isDemo && (
        <div className="bg-fuchsia-100 px-4 py-1.5 text-[12.5px] font-semibold text-fuchsia-900">
          DEMO-ERGEBNIS – synthetische Werte, keine FE-Berechnung (nur zur Ansichtsprüfung).
        </div>
      )}
      {stale && (
        <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-[13px] font-medium text-amber-900">
          Eingaben geändert – Ergebnis veraltet, bitte Run drücken
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-3 py-2 text-[13px]">
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Kombination</span>
          <select className="rounded border border-slate-300 px-2 py-1" value={combo} onChange={(e) => patch({ combo: e.target.value })}>
            {res.kombinationen.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex overflow-hidden rounded border border-slate-300">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => patch({ view: v.id })}
              className={`px-3 py-1 ${view === v.id ? "bg-accent text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === "kontur" && (
          <select className="rounded border border-slate-300 px-2 py-1" value={contour} onChange={(e) => patch({ contour: e.target.value as ContourField })}>
            {FIELDS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        )}
        {view !== "kontur" && (
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Skalierung</span>
            <input type="range" min={0.2} max={4} step={0.1} value={scale} onChange={(e) => patch({ scale: parseFloat(e.target.value) })} />
            <span className="w-10 tabular-nums">{fmt(scale, 1)}×</span>
          </label>
        )}
      </div>
      <div className="min-h-[260px] flex-[1_1_55%] border-b border-slate-200">
        {cr && <ResultCanvas cr={cr} kind={view} field={contour} scale={scale} wall={wall} />}
      </div>
      <div className="min-h-0 flex-[1_1_40%] overflow-y-auto bg-[#f6f7fa]">
        {cr && <Kennwerte res={res} cr={cr} combo={combo} />}
      </div>
    </div>
  );
}
