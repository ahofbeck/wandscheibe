"use client";
import { Field } from "./Section";

export default function SelectField({
  label,
  tip,
  value,
  onChange,
  options,
}: {
  label: string;
  tip?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label} tip={tip}>
      <select
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[13px] outline-none focus:border-accent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
