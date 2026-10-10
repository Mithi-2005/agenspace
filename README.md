# Kosway
Kosway is a multi-user AI productivity and automation platform. Moon is the in-app AI assistant.

## Centralized branding
Copy `.env.example` to `.env` in the project root. Change the values:
```env
APP_NAME=Kosway
AI_ASSISTANT_NAME=Moon
BRAND_LOGO_URL=/brand/kosway-mark.svg
VITE_APP_NAME=Kosway
VITE_AI_ASSISTANT_NAME=Moon
VITE_BRAND_LOGO_URL=/brand/kosway-mark.svg
```
The frontend reads `VITE_` values from the root `.env`; restart Vite after edits. `BrandLogo` is the reusable component for the product mark/name. Replace `frontend/public/brand/kosway-mark.svg` to change the artwork, or update `VITE_BRAND_LOGO_URL` to use a different public asset.

## Requirements
Python 3.11+, Node.js 20+, Docker Desktop, and optionally pgAdmin.

## Backend and database on Windows

The root `.env` supplies `DATABASE_URL` to both FastAPI and Alembic. Keep `.env` local; `.env.example` contains development placeholders. For a new checkout, create `.env` once with `Copy-Item .env.example .env`, then confirm `DATABASE_URL` points to `127.0.0.1:5433`.

Start the existing PostgreSQL service from the project root:

```powershell
docker compose up -d db
docker compose ps
```

Compose publishes container port `5432` on Windows host port `5433` (`5433:5432`). Tools running on Windows, including the local FastAPI process, must use port `5433`; processes inside the Compose network use the service name `db` and port `5432`.

Activate the existing Conda environment, install the backend dependencies, and apply migrations from the backend directory:

```powershell
Set-Location .\backend
conda activate agent_desk
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
python -m alembic upgrade head
```

Alembic reads the same configured URL as the application. There are currently no application models, so no initial migration is included. When models are added, create a revision with `python -m alembic revision --autogenerate -m "describe schema change"`, review it, then apply it with `python -m alembic upgrade head`.

Start the API in the activated backend terminal:

```powershell
python -m uvicorn app.main:app --reload
```

Run the backend tests in a second PowerShell terminal:

```powershell
Set-Location .\backend
conda activate agent_desk
python -m pytest
```

Check liveness and database readiness in another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/ready
```

Liveness only confirms that the API process responds. Readiness performs a real `SELECT 1` against PostgreSQL and returns HTTP `503` if the database cannot be reached.

## Frontend

From a separate terminal in `frontend`, run `npm install` and `npm run dev`.

API docs: http://127.0.0.1:8000/docs
Docker runs PostgreSQL; pgAdmin manages it. For a Windows-hosted database client, use host `127.0.0.1`, port `5433`, database `agentdesk`, username `agentdesk`, and the development password from `.env`. These are development-only credentials.

This is a foundation, not a production release. Authentication, authorization, automation execution, OAuth integrations, and deployment hardening remain. Never commit `.env`. Browser extensions are out of scope.
