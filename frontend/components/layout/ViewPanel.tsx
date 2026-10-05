"use client";
import dynamic from "next/dynamic";
import { useStore, type RightTab } from "@/store/useStore";

// Konva darf nur im Browser geladen werden
const SystemView = dynamic(() => import("../views/SystemView"), {
  ssr: false,
  loading: () => <Loading />,
});
const ResultView = dynamic(() => import("../views/ResultView"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return <div className="flex h-full items-center justify-center text-slate-400">Lade Ansicht …</div>;
}

const TABS: { id: RightTab; label: string }[] = [
  { id: "system", label: "System" },
  { id: "ergebnis", label: "Ergebnis" },
];

export default function ViewPanel() {
  const tab = useStore((s) => s.rightTab);
  const patch = useStore((s) => s.patch);
  const hasResult = useStore((s) => s.result !== null);

  const fullscreen = () => {
    const el = document.getElementById("view-panel");
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div id="view-panel" className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center border-b border-slate-200 bg-white px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => patch({ rightTab: t.id })}
            className={`px-4 py-2.5 text-[13px] font-medium ${
              tab === t.id ? "border-b-2 border-accent text-accent" : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.id === "ergebnis" && hasResult && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />}
          </button>
        ))}
        <button className="ml-auto rounded px-2 py-1 text-slate-500 hover:bg-slate-100" title="Vollbild" onClick={fullscreen}>
          ⛶
        </button>
      </div>
      <div className="min-h-0 flex-1">{tab === "system" ? <SystemView /> : <ResultView />}</div>
    </div>
  );
}
