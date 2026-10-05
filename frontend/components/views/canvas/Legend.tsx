import { fmt } from "@/lib/geometry";
import { divergingColor } from "./common";

/** Farbskalen-Legende (HTML-Overlay) */
export default function Legend({ vmax, unit = "N/mm²", title }: { vmax: number; unit?: string; title: string }) {
  const stops = Array.from({ length: 21 }, (_, i) => divergingColor(vmax * (1 - i / 10), vmax));
  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-stretch gap-2 rounded border border-slate-300 bg-white/90 p-2 text-[11px] shadow-sm">
      <div
        className="w-4 rounded"
        style={{ height: 130, background: `linear-gradient(to bottom, ${stops.join(",")})`, border: "1px solid #bbb" }}
      />
      <div className="flex flex-col justify-between">
        <span>+{fmt(vmax, 2)} (Zug)</span>
        <span>0</span>
        <span>−{fmt(vmax, 2)} (Druck)</span>
      </div>
      <div className="font-semibold text-slate-600">
        {title}
        <br />
        <span className="font-normal">[{unit}]</span>
      </div>
    </div>
  );
}
