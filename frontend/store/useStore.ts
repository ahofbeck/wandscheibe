"use client";
import { create } from "zustand";
import { analyze } from "@/lib/api";
import { DEFAULT_INPUTS, defaultSchnitte } from "@/lib/defaults";
import { validate } from "@/lib/geometry";
import { buildMockResult } from "@/lib/mockResult";
import type { AnalyzeRequest, AnalyzeResponse, ContourField, ResultViewKind } from "@/lib/types";

export type LeftTab = "geometrie" | "material" | "lasten" | "berechnung";
export type RightTab = "system" | "ergebnis";
export type Health = "unknown" | "online" | "offline";
export interface Toast {
  id: number;
  kind: "error" | "info";
  text: string;
}

/** Eingaben + Auto-Schnitte -> Request (Schnittpositionen folgen der Geometrie, solange nicht manuell geändert) */
export function buildRequest(inputs: AnalyzeRequest, schnitteAuto: boolean): AnalyzeRequest {
  if (!schnitteAuto) return inputs;
  return {
    ...inputs,
    berechnung: { ...inputs.berechnung, ...defaultSchnitte(inputs.geometrie, inputs.lasten) },
  };
}
export function hashRequest(req: AnalyzeRequest): string {
  return JSON.stringify(req);
}

interface State {
  inputs: AnalyzeRequest;
  schnitteAuto: boolean;
  result: AnalyzeResponse | null;
  resultHash: string | null;
  isDemo: boolean;
  running: boolean;
  health: Health;
  healthInfo: string;
  leftTab: LeftTab;
  rightTab: RightTab;
  combo: string;
  view: ResultViewKind;
  contour: ContourField;
  scale: number;
  showMesh: boolean;
  showCuts: boolean;
  toasts: Toast[];
  set: (fn: (i: AnalyzeRequest) => AnalyzeRequest) => void;
  setSchnitte: (axis: "x" | "y", v: number[]) => void;
  resetSchnitte: () => void;
  patch: (p: Partial<State>) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  run: () => Promise<void>;
  loadDemo: () => void;
}

let toastId = 1;

export const useStore = create<State>()((set, get) => ({
  inputs: DEFAULT_INPUTS,
  schnitteAuto: true,
  result: null,
  resultHash: null,
  isDemo: false,
  running: false,
  health: "unknown",
  healthInfo: "",
  leftTab: "geometrie",
  rightTab: "system",
  combo: "gesamt_uls",
  view: "haupt",
  contour: "sx",
  scale: 1,
  showMesh: false,
  showCuts: true,
  toasts: [],
  set: (fn) => set((s) => ({ inputs: fn(s.inputs) })),
  setSchnitte: (axis, v) =>
    set((s) => {
      const base = buildRequest(s.inputs, s.schnitteAuto).berechnung;
      return {
        schnitteAuto: false,
        inputs: {
          ...s.inputs,
          berechnung: {
            ...base,
            netz: s.inputs.berechnung.netz,
            [axis === "x" ? "schnitte_x" : "schnitte_y"]: v,
          },
        },
      };
    }),
  resetSchnitte: () => set({ schnitteAuto: true }),
  patch: (p) => set(p),
  toast: (text, kind = "error") => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), 9000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  run: async () => {
    const s = get();
    if (s.running) return;
    const req = buildRequest(s.inputs, s.schnitteAuto);
    const errs = validate(req);
    if (errs.length) {
      get().toast(`Eingaben ungültig: ${errs[0]}`);
      return;
    }
    set({ running: true });
    try {
      const res = await analyze(req);
      const combo = res.kombinationen.some((k) => k.key === get().combo) ? get().combo : res.kombinationen[0]?.key;
      set({
        result: res,
        resultHash: hashRequest(req),
        isDemo: false,
        combo: combo ?? "",
        rightTab: "ergebnis",
        running: false,
      });
    } catch (e) {
      set({ running: false });
      get().toast((e as Error).message || "Unbekannter Fehler bei der Berechnung.");
    }
  },
  loadDemo: () => {
    const s = get();
    const req = buildRequest(s.inputs, s.schnitteAuto);
    if (validate(req).length) {
      get().toast("Eingaben ungültig – Demo nicht möglich.");
      return;
    }
    const res = buildMockResult(req);
    set({
      result: res,
      resultHash: hashRequest(req),
      isDemo: true,
      combo: res.kombinationen[0].key,
      rightTab: "ergebnis",
    });
  },
}));
