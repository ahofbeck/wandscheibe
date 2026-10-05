"use client";
import { useMemo } from "react";
import { BETON, EXPOSITION, betonByName, expoCheck, fcdOf } from "@/lib/ec2";
import { derive, fmt, validate } from "@/lib/geometry";
import { buildRequest, useStore, type LeftTab } from "@/store/useStore";
import type { Geometrie, Lasten, Material } from "@/lib/types";
import { Card } from "../inputs/Section";
import NumberField, { NumberInput } from "../inputs/NumberField";
import SliderField from "../inputs/SliderField";
import SelectField from "../inputs/SelectField";

const TABS: { id: LeftTab; label: string }[] = [
  { id: "geometrie", label: "Geometrie" },
  { id: "material", label: "Material" },
  { id: "lasten", label: "Lasten" },
  { id: "berechnung", label: "Berechnung" },
];

function GeometrieTab() {
  const g = useStore((s) => s.inputs.geometrie);
  const setIn = useStore((s) => s.set);
  const upd = (p: Partial<Geometrie>) => setIn((i) => ({ ...i, geometrie: { ...i.geometrie, ...p } }));
  const updO = (p: Partial<Geometrie["oeffnung"]>) =>
    setIn((i) => ({ ...i, geometrie: { ...i.geometrie, oeffnung: { ...i.geometrie.oeffnung, ...p } } }));
  return (
    <>
      <Card title="Wand">
        <NumberField label="Wanddicke t" unit="cm" scale={100} step={1} value={g.t_wand} onChange={(v) => upd({ t_wand: v })}
          tip="Dicke der Wandscheibe, konstant über die gesamte Höhe (Deckenstreifen vereinfacht mit Wanddicke)." />
        <NumberField label="Lichter Auflagerabstand" unit="m" step={0.05} value={g.l_licht} onChange={(v) => upd({ l_licht: v })}
          tip="Lichter Abstand zwischen den Innenkanten der Lager A und B." />
        <NumberField label="Lichte Geschosshöhe" unit="m" step={0.05} value={g.h_licht} onChange={(v) => upd({ h_licht: v })}
          tip="Lichte Höhe zwischen Oberkante der unteren und Unterkante der oberen Decke." />
      </Card>
      <Card title="Lager">
        <NumberField label="Lagerbreite A" unit="cm" scale={100} step={1} value={g.b_lager_a} onChange={(v) => upd({ b_lager_a: v })}
          tip="Breite des linken Auflagers. Die Lagerachse A liegt in der Mitte der Lagerbreite." />
        <NumberField label="Lagerbreite B" unit="cm" scale={100} step={1} value={g.b_lager_b} onChange={(v) => upd({ b_lager_b: v })}
          tip="Breite des rechten Auflagers. Die Lagerachse B liegt in der Mitte der Lagerbreite." />
      </Card>
      <Card title="Decken">
        <NumberField label="Deckenhöhe oben" unit="cm" scale={100} step={1} value={g.h_decke_oben} onChange={(v) => upd({ h_decke_oben: v })}
          tip="Dicke der oberen Decke (Streifen am oberen Wandrand)." />
        <NumberField label="Deckenhöhe unten" unit="cm" scale={100} step={1} value={g.h_decke_unten} onChange={(v) => upd({ h_decke_unten: v })}
          tip="Dicke der unteren Decke (Streifen am unteren Wandrand)." />
      </Card>
      <Card title="Öffnung">
        <NumberField label="Abstand Lagerachse A" unit="m" step={0.05} value={g.oeffnung.a_lager_a} onChange={(v) => updO({ a_lager_a: v })}
          tip="Horizontaler Abstand von der Lagerachse A bis zur linken Öffnungskante." />
        <NumberField label="Öffnungsbreite b" unit="m" step={0.05} value={g.oeffnung.b} onChange={(v) => updO({ b: v })} />
        <NumberField label="Öffnungshöhe h" unit="m" step={0.05} value={g.oeffnung.h} onChange={(v) => updO({ h: v })} />
        <NumberField label="Abstand a_oben" unit="m" step={0.05} value={g.oeffnung.a_oben} onChange={(v) => updO({ a_oben: v })}
          tip="Gemessen von der OBERKANTE der Wand bis zur Oberkante der Öffnung (wie in der Skizze: 0,90 / 1,20 / 0,90 = 3,00 m)." />
      </Card>
      <Card title="Stütze">
        <NumberField label="Stützenbreite" unit="cm" scale={100} step={1} value={g.b_stuetze} onChange={(v) => upd({ b_stuetze: v })}
          tip="Breite, über die die Stützenlast in die Wandscheibe eingeleitet wird." />
      </Card>
    </>
  );
}

function MaterialTab() {
  const m = useStore((s) => s.inputs.material);
  const setIn = useStore((s) => s.set);
  const upd = (p: Partial<Material>) => setIn((i) => ({ ...i, material: { ...i.material, ...p } }));
  const ec = expoCheck(m.beton, m.exposition);
  const b = betonByName(m.beton);
  return (
    <>
      <Card title="Beton">
        <SelectField label="Betongüte" value={m.beton} onChange={(v) => upd({ beton: v })}
          options={BETON.map((x) => ({ value: x.name, label: x.name }))}
          tip="Druckfestigkeitsklasse nach DIN EN 206 / EC2." />
        <SelectField label="Expositionsklasse" value={m.exposition} onChange={(v) => upd({ exposition: v })}
          options={EXPOSITION.map((x) => ({ value: x.name, label: x.name }))}
          tip="Mindestbetonfestigkeit nach DIN EN 1992-1-1/NA, Tab. E.1DE." />
        {!ec.ok && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            Warnung: Betongüte {m.beton} liegt unter der Mindestfestigkeitsklasse {ec.min_beton} für {m.exposition}.
          </div>
        )}
        <NumberField label="Wichte γ_Beton" unit="kN/m³" step={0.5} value={m.gamma_beton} onChange={(v) => upd({ gamma_beton: v })}
          tip="Wichte des Stahlbetons für das Eigengewicht." />
      </Card>
      <Card title="Kennwerte (EC2 / DE-NA)">
        <Info k="f_ck" v={`${fmt(b.fck, 0)} N/mm²`} />
        <Info k="f_cd = 0,85·f_ck/1,5" v={`${fmt(fcdOf(b.fck), 1)} N/mm²`} />
        <Info k="f_ctm" v={`${fmt(b.fctm, 1)} N/mm²`} />
        <Info k="E_cm" v={`${fmt(b.Ecm, 0)} N/mm²`} />
        <Info k="Mindestbeton" v={ec.min_beton} />
        <Info k="c_min,dur" v={ec.c_min_dur === null ? "– (aus XC/XD/XS)" : `${ec.c_min_dur} mm`} />
      </Card>
    </>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-800">{v}</span>
    </div>
  );
}

function LastenTab() {
  const l = useStore((s) => s.inputs.lasten);
  const setIn = useStore((s) => s.set);
  const updL = (k: "oben" | "unten", p: Partial<Lasten["oben"]>) =>
    setIn((i) => ({ ...i, lasten: { ...i.lasten, [k]: { ...i.lasten[k], ...p } } }));
  const updS = (p: Partial<Lasten["stuetze"]>) =>
    setIn((i) => ({ ...i, lasten: { ...i.lasten, stuetze: { ...i.lasten.stuetze, ...p } } }));
  return (
    <>
      <Card title="Decke oben – Linienlast">
        <SliderField label="g_k1 (ständig)" unit="kN/m" min={0} max={100} step={1} value={l.oben.gk} onChange={(v) => updL("oben", { gk: v })} />
        <SliderField label="q_k1 (veränderlich)" unit="kN/m" min={0} max={100} step={1} value={l.oben.qk} onChange={(v) => updL("oben", { qk: v })} />
      </Card>
      <Card title="Decke unten – Linienlast">
        <SliderField label="g_k2 (ständig)" unit="kN/m" min={0} max={100} step={1} value={l.unten.gk} onChange={(v) => updL("unten", { gk: v })} />
        <SliderField label="q_k2 (veränderlich)" unit="kN/m" min={0} max={100} step={1} value={l.unten.qk} onChange={(v) => updL("unten", { qk: v })} />
      </Card>
      <Card title="Stütze – Einzellast">
        <SliderField label="G_k (ständig)" unit="kN" min={0} max={3000} step={10} value={l.stuetze.Gk} onChange={(v) => updS({ Gk: v })} />
        <SliderField label="Q_k (veränderlich)" unit="kN" min={0} max={2000} step={10} value={l.stuetze.Qk} onChange={(v) => updS({ Qk: v })} />
        <NumberField label="x_Last" unit="m" step={0.05} value={l.stuetze.x_last} onChange={(v) => updS({ x_last: v })}
          tip="Abstand der Stützenachse von der Lagerachse A (Achse A = 0)." />
      </Card>
    </>
  );
}

function ListEditor({ axis, label }: { axis: "x" | "y"; label: string }) {
  const inputs = useStore((s) => s.inputs);
  const auto = useStore((s) => s.schnitteAuto);
  const setSchnitte = useStore((s) => s.setSchnitte);
  const list = buildRequest(inputs, auto).berechnung[axis === "x" ? "schnitte_x" : "schnitte_y"];
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-semibold text-slate-500">{label}</div>
      {list.map((v, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="w-8 text-[12px] text-slate-500">{axis}{idx + 1}</span>
          <NumberInput value={v} unit="m" step={0.05} decimals={3} className="flex-1"
            onChange={(n) => setSchnitte(axis, list.map((q, k) => (k === idx ? n : q)))} />
          <button className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="Entfernen"
            onClick={() => setSchnitte(axis, list.filter((_, k) => k !== idx))}>✕</button>
        </div>
      ))}
      <button className="rounded border border-dashed border-slate-300 px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50"
        onClick={() => setSchnitte(axis, [...list, list.length ? list[list.length - 1] : 1])}>
        + Schnitt hinzufügen
      </button>
    </div>
  );
}

function BerechnungTab() {
  const netz = useStore((s) => s.inputs.berechnung.netz);
  const setIn = useStore((s) => s.set);
  const auto = useStore((s) => s.schnitteAuto);
  const reset = useStore((s) => s.resetSchnitte);
  return (
    <>
      <Card title="FE-Netz">
        <SelectField label="Netzweite" value={String(netz)}
          options={[0.2, 0.1, 0.05].map((n) => ({ value: String(n), label: `${String(n).replace(".", ",")} m` }))}
          onChange={(v) => setIn((i) => ({ ...i, berechnung: { ...i.berechnung, netz: parseFloat(v) } }))}
          tip="Elementkantenlänge der Quad-Elemente. Feiner = genauer, aber langsamer." />
      </Card>
      <Card title="Spannungsschnitte">
        <ListEditor axis="x" label="σx-Schnitte (vertikale Schnittlinien, x ab linker Wandkante)" />
        <ListEditor axis="y" label="σy-Schnitte (horizontale Schnittlinien, y ab Unterkante)" />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[12px] text-slate-500">{auto ? "Automatisch aus Geometrie" : "Manuell angepasst"}</span>
          <button className="rounded border border-slate-300 px-3 py-1 text-[12px] hover:bg-slate-50 disabled:opacity-40"
            disabled={auto} onClick={reset}>
            Standard wiederherstellen
          </button>
        </div>
      </Card>
    </>
  );
}

export default function ParamPanel() {
  const tab = useStore((s) => s.leftTab);
  const patch = useStore((s) => s.patch);
  const inputs = useStore((s) => s.inputs);
  const auto = useStore((s) => s.schnitteAuto);
  const errors = useMemo(() => validate(buildRequest(inputs, auto)), [inputs, auto]);
  const d = derive(inputs.geometrie, inputs.lasten);
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f7fa]">
      <div className="flex border-b border-slate-200 bg-white px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => patch({ leftTab: t.id })}
            className={`px-4 py-2.5 text-[13px] font-medium ${
              tab === t.id ? "border-b-2 border-accent text-accent" : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {errors.length > 0 && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
            {errors.map((e) => (
              <div key={e}>• {e}</div>
            ))}
          </div>
        )}
        {tab === "geometrie" && <GeometrieTab />}
        {tab === "material" && <MaterialTab />}
        {tab === "lasten" && <LastenTab />}
        {tab === "berechnung" && <BerechnungTab />}
        {tab === "geometrie" && (
          <Card title="Abgeleitete Größen">
            <Info k="Gesamtlänge L" v={`${fmt(d.L)} m`} />
            <Info k="Gesamthöhe H" v={`${fmt(d.H)} m`} />
            <Info k="Stützweite l_eff" v={`${fmt(d.l_eff)} m`} />
            <Info k="Achsen A / B" v={`${fmt(d.xA)} / ${fmt(d.xB)} m`} />
          </Card>
        )}
      </div>
    </div>
  );
}
