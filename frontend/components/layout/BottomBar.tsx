"use client";
import { useMemo } from "react";
import { validate } from "@/lib/geometry";
import { fmt } from "@/lib/geometry";
import { buildRequest, hashRequest, useStore } from "@/store/useStore";

export default function BottomBar() {
  const inputs = useStore((s) => s.inputs);
  const auto = useStore((s) => s.schnitteAuto);
  const running = useStore((s) => s.running);
  const result = useStore((s) => s.result);
  const resultHash = useStore((s) => s.resultHash);
  const isDemo = useStore((s) => s.isDemo);
  const run = useStore((s) => s.run);
  const loadDemo = useStore((s) => s.loadDemo);

  const req = useMemo(() => buildRequest(inputs, auto), [inputs, auto]);
  const errors = useMemo(() => validate(req), [req]);
  const stale = !!resultHash && hashRequest(req) !== resultHash;

  let status = "Bereit – Eingaben prüfen und Run drücken.";
  let cls = "text-slate-600";
  if (running) status = "Berechnung läuft …";
  else if (errors.length) {
    status = `Eingabe ungültig: ${errors[0]}`;
    cls = "text-red-700";
  } else if (result && stale) {
    status = "Eingaben geändert – Ergebnis veraltet.";
    cls = "text-amber-700";
  } else if (result) {
    status = isDemo
      ? "DEMO-Ergebnis geladen (keine echte Berechnung)."
      : `Berechnung abgeschlossen: ${result.meta.n_elements} Elemente in ${fmt(result.meta.runtime_s, 1)} s.`;
    cls = isDemo ? "text-fuchsia-700" : "text-green-700";
  }

  return (
    <footer className="flex h-14 shrink-0 items-center gap-4 border-t border-slate-300 bg-white px-4">
      <span className={`min-w-0 flex-1 truncate text-[13px] ${cls}`}>{status}</span>
      {process.env.NODE_ENV !== "production" && (
        <button
          onClick={loadDemo}
          className="rounded border border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-[12px] text-fuchsia-800 hover:bg-fuchsia-100"
          title="Nur Entwicklung: synthetisches Ergebnis (lib/mockResult.ts)"
        >
          Demo-Ergebnis laden
        </button>
      )}
      <button
        onClick={run}
        disabled={running || errors.length > 0}
        className="flex min-w-28 items-center justify-center gap-2 rounded bg-accent px-6 py-2 text-[14px] font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {running && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        Run
      </button>
    </footer>
  );
}
