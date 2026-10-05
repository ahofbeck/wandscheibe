# Startet das Backend (Port 8000) mit Auto-Reload
Set-Location $PSScriptRoot
python -m uvicorn app.main:app --reload --port 8000
