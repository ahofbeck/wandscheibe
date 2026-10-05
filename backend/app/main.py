"""FastAPI-Backend: GET /health, POST /analyze."""
from __future__ import annotations

import time
from importlib.metadata import version

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import ec2
from .model import build_model, solve
from .postprocess import rc, run_postprocess
from .schemas import AnalyzeRequest

try:
    PYNITE = version("PyNiteFEA")
except Exception:  # pragma: no cover
    PYNITE = "unknown"

app = FastAPI(title="Wandscheibe FE-Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"], allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def _validation_handler(_req: Request, exc: RequestValidationError):
    msgs = []
    for e in exc.errors():
        msg = str(e.get("msg", ""))
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        loc = ".".join(str(x) for x in e.get("loc", []) if x != "body")
        msgs.append(msg if e.get("type") == "value_error" or not loc else f"{loc}: {msg}")
    return JSONResponse(status_code=422, content={"detail": " ".join(msgs)})


@app.get("/health")
def health():
    return {"status": "ok", "pynite": PYNITE}


def run_analysis(req: AnalyzeRequest) -> dict:
    t0 = time.perf_counter()
    b = build_model(req)
    solve(b)
    mat = ec2.material_info(req.material.beton, req.material.exposition)
    ergebnisse, equil = run_postprocess(b, mat["fck"])
    warnings = list(b.warnings)
    if not mat["expo_ok"]:
        warnings.append(f"Betongüte {req.material.beton} erfüllt nicht die Mindestfestigkeit "
                        f"{mat['min_beton']} für {req.material.exposition}.")
    for k, v in equil.items():
        if v["rel_error"] > 1e-3:
            warnings.append(f"Gleichgewichtsabweichung > 0,1 % in Kombination {k}.")
    g = b.geo
    return {
        "meta": {"n_nodes": len(b.model.nodes), "n_elements": len(b.model.quads),
                 "runtime_s": round(time.perf_counter() - t0, 3), "pynite": PYNITE,
                 "warnings": warnings, "equilibrium": equil},
        "geometrie": {"L": rc(g.L), "H": rc(g.H), "l_eff": rc(g.l_eff), "x_A": rc(g.x_A), "x_B": rc(g.x_B),
                      "oeffnung": {"x": rc(g.ox), "y": rc(g.oy), "b": rc(g.ob), "h": rc(g.oh)}},
        "material": mat,
        "kombinationen": [{"key": k, "label": l} for k, l in b.combos],
        "ergebnisse": ergebnisse,
    }


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    try:
        result = await run_in_threadpool(run_analysis, req)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"detail": f"Berechnungsfehler: {exc}"})
    return JSONResponse(content=result)
