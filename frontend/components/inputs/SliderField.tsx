"use client";
import { Field } from "./Section";
import { NumberInput } from "./NumberField";

export default function SliderField({
  label,
  tip,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  tip?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
}) {
  return (
    <Field label={label} tip={tip}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="min-w-0 flex-1"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <NumberInput value={value} onChange={onChange} unit={unit} step={step} decimals={2} className="w-32 shrink-0" />
      </div>
    </Field>
  );
}
