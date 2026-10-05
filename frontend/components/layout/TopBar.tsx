"use client";
import { useEffect } from "react";
import { health } from "@/lib/api";
import { useStore } from "@/store/useStore";

export default function TopBar() {
  const h = useStore((s) => s.health);
  const info = useStore((s) => s.healthInfo);
  const patch = useStore((s) => s.patch);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await health();
        if (alive) patch({ health: r.status === "ok" ? "online" : "offline", healthInfo: `PyNite ${r.pynite ?? ""}` });
      } catch {
        if (alive) patch({ health: "offline", healthInfo: "" });
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [patch]);

  const color = h === "online" ? "bg-green-500" : h === "offline" ? "bg-red-500" : "bg-slate-400";
  const text = h === "online" ? "Backend online" : h === "offline" ? "Backend offline" : "Prüfe Backend …";
  return (
    <header className="flex h-12 shrink-0 items-center bg-topbar px-4 text-white">
      <span className="mr-4 text-xl leading-none text-slate-300">☰</span>
      <span className="text-[17px] font-bold tracking-[0.25em]">WANDSCHEIBE</span>
      <span className="ml-3 hidden text-[12px] text-slate-400 md:inline">Wandartiger Träger mit Öffnung · FE-Scheibe</span>
      <div className="ml-auto flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px]" title={info}>
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {text}
      </div>
    </header>
  );
}
