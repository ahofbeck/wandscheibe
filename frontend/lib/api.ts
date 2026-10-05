import type { AnalyzeRequest, AnalyzeResponse } from "./types";

const BASE = "/api/fe";

export async function health(): Promise<{ status: string; pynite: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`${BASE}/health`, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function detailText(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "string" ? d : ((d as { msg?: string }).msg ?? JSON.stringify(d))))
      .join("; ");
  }
  return detail ? JSON.stringify(detail) : "";
}

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 170000);
  let r: Response;
  try {
    r = await fetch(`${BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new Error(
      (e as Error).name === "AbortError"
        ? "Zeitüberschreitung der Berechnung."
        : "Backend nicht erreichbar (läuft FastAPI auf Port 8000?).",
    );
  } finally {
    clearTimeout(t);
  }
  if (!r.ok) {
    let msg = `Fehler ${r.status}`;
    try {
      const j = await r.json();
      const d = detailText(j.detail);
      if (d) msg = `${r.status === 422 ? "Eingabefehler" : "Berechnungsfehler"}: ${d}`;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await r.json()) as AnalyzeResponse;
}
