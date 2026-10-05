import type { ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3 rounded-md border border-slate-200 bg-white shadow-sm">
      <h3 className="border-b border-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-700">{title}</h3>
      <div className="space-y-3 px-4 py-3">{children}</div>
    </section>
  );
}

export function Tip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex">
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
        i
      </span>
      <span className="pointer-events-none absolute left-5 top-0 z-30 hidden w-64 rounded bg-slate-800 px-2 py-1.5 text-[12px] font-normal leading-snug text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function Field({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3">
      <label className="flex items-center text-[13px] text-slate-600">
        <span>{label}</span>
        {tip && <Tip text={tip} />}
      </label>
      <div>{children}</div>
    </div>
  );
}
