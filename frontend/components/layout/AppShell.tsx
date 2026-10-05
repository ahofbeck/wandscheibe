"use client";
import { useStore } from "@/store/useStore";
import BottomBar from "./BottomBar";
import ParamPanel from "./ParamPanel";
import TopBar from "./TopBar";
import ViewPanel from "./ViewPanel";

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded border px-3 py-2 text-[13px] shadow-lg ${
            t.kind === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-blue-300 bg-blue-50 text-blue-900"
          }`}
        >
          <span className="flex-1">{t.text}</span>
          <button className="text-slate-500 hover:text-slate-900" onClick={() => dismiss(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AppShell() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <main className="flex min-h-0 flex-1">
        <div className="w-[40%] min-w-[380px] border-r border-slate-300">
          <ParamPanel />
        </div>
        <div className="min-w-0 flex-1">
          <ViewPanel />
        </div>
      </main>
      <BottomBar />
      <Toasts />
    </div>
  );
}
