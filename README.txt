# Impact of AI in Medical Imaging

## Start

From the repo root:

```powershell
.\start-dev.bat
```

Frontend: http://127.0.0.1:3000

Backend health: http://127.0.0.1:8000/health

## Stop

```powershell
.\stop-dev.bat
```

## Restart

```powershell
.\restart-dev.bat
```

## Manual Start

Terminal 1:

```powershell
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd frontend
npm run dev
```
