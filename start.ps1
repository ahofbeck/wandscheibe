# Startet Backend (Port 8000) und Frontend (Port 3000) in eigenen Fenstern
$root = $PSScriptRoot
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\backend'; python -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\frontend'; npm run dev"
