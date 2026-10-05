"use client";
import { useState } from "react";
import { Field } from "./Section";

interface Props {
  label: string;
  tip?: string;
  /** Wert in interner Einheit (m, kN, ...) */
  value: number;
  onChange: (v: number) => void;
  /** Anzeigefaktor: z. B. 100 für m -> cm */
  scale?: number;
  unit: string;
  step?: number;
  decimals?: number;
}

function fmtDisplay(v: number, decimals: number): string {
  return String(parseFloat(v.toFixed(decimals))).replace(".", ",");
}

export function NumberInput({
  value,
  onChange,
  scale = 1,
  unit,
  step = 1,
  decimals = 3,
  className = "",
}: Omit<Props, "label" | "tip"> & { className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? fmtDisplay(value * scale, decimals);
  const bump = (dir: 1 | -1) => {
    const v = Math.round((value * scale + dir * step) * 1e6) / 1e6;
    onChange(v / scale);
    setDraft(null);
  };
  return (
    <div className={`flex items-center rounded border border-slate-300 bg-white focus-within:border-accent ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        className="w-full min-w-0 bg-transparent px-2 py-1 text-right text-[13px] outline-none"
        value={shown}
        onChange={(e) => {
          const t = e.target.value;
          setDraft(t);
          const n = parseFloat(t.replace(",", "."));
          if (isFinite(n)) onChange(Math.round((n / scale) * 1e9) / 1e9);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-1);
          }
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="w-12 shrink-0 border-l border-slate-200 bg-slate-50 px-1 py-1 text-center text-[12px] text-slate-500">
        {unit}
      </span>
    </div>
  );
}

export default function NumberField(p: Props) {
  return (
    <Field label={p.label} tip={p.tip}>
      <NumberInput {...p} />
    </Field>
  );
}
