# Wandscheibe – wandartiger Träger mit Öffnung

FE-Bemessungstool für die Scheibenbeanspruchung eines wandartigen Trägers mit Öffnung.
Frontend: Next.js + react-konva · Backend: FastAPI + PyNiteFEA. Spezifikation: [PLAN.md](PLAN.md).

## Start

```powershell
pip install -r backend/requirements.txt
npm install --prefix frontend
./start.ps1
```

Dann http://localhost:3000 öffnen. Backend läuft auf Port 8000 (`GET /health`, `POST /analyze`).

## Tests

```powershell
cd backend; python -m pytest
```
