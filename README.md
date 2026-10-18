# AgenSpace
AgenSpace is a multi-user AI productivity and automation platform. Moon is the in-app AI assistant.

## Centralized branding & Configuration
Copy `.env.example` to `.env` in the project root. Configure your local settings:
```env
APP_NAME=AgenSpace
AI_ASSISTANT_NAME=Moon
BRAND_LOGO_URL=/brand/agenspace-mark.svg
VITE_APP_NAME=AgenSpace
VITE_AI_ASSISTANT_NAME=Moon
VITE_BRAND_LOGO_URL=/brand/agenspace-mark.svg
VITE_API_BASE_URL=http://127.0.0.1:8000
APP_ENV=development
API_V1_PREFIX=/api/v1
SECRET_KEY=replace-with-a-long-random-secret-before-use
DATABASE_URL=postgresql+psycopg://agentdesk:agentdesk_dev_only@localhost:5433/agentdesk
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
AUTH_RATE_LIMIT_ENABLED=true
AUTH_RATE_LIMIT_REQUESTS=10
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
```
Generate a strong secret key for production or local development:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Requirements
Python 3.11+, Node.js 20+, Docker Desktop, and optionally pgAdmin.

## Identity & Authentication Architecture (Phase 1)
AgenSpace implements an end-to-end, multi-user identity and security system:
- **Password Security**: Passwords hashed with **Argon2id** (RFC 9106 parameters).
- **Access Tokens**: Short-lived JWTs (default: 15 minutes) signed with HS256, verified for signature, expiry, issuer, audience, and subject UUID. Access tokens are held **strictly in-memory** in the frontend client (never stored in localStorage).
- **Refresh Tokens & Sessions**: Cryptographically random opaque tokens stored as SHA-256 hashes in PostgreSQL (`refresh_token_sessions` table). Delivered to browsers via **HttpOnly**, `SameSite=lax`, restricted-path (`/api/v1/auth`) cookies.
- **Rotation & Reuse Detection**: Every refresh rotates the refresh token. If a previously rotated token is presented (reuse attempt), the entire session family chain is revoked immediately.
- **Logout & Revocation**: Endpoints support single-session logout (`/auth/logout`) and multi-session revocation (`/auth/logout-all`). Changing passwords automatically revokes all other active sessions.
- **CSRF & Origin Defenses**: Origin verification blocks cross-origin cookie-authenticated requests.
- **Rate Limiting**: Sliding-window rate limiter protects registration, login, and refresh endpoints. Pluggable design allows future Redis backend integration.

### API Endpoints
- `POST /api/v1/auth/register` — Register a new account (email, display name, password).
- `POST /api/v1/auth/login` — Authenticate credentials; sets HttpOnly refresh cookie and returns access token.
- `POST /api/v1/auth/refresh` — Rotates refresh token session and issues fresh access token.
- `POST /api/v1/auth/logout` — Revokes current session and clears refresh cookie.
- `POST /api/v1/auth/logout-all` — Revokes all active refresh sessions for authenticated user.
- `GET /api/v1/users/me` — Retrieve current authenticated user profile.
- `PATCH /api/v1/users/me` — Update display name.
- `POST /api/v1/users/me/password` — Change password and revoke existing refresh sessions.

## Backend and Database on Windows

Start the PostgreSQL service from the project root:
```powershell
docker compose up -d db
docker compose ps
```
Compose publishes container port `5432` on Windows host port `5433` (`5433:5432`).

Activate the Conda environment and install dependencies:
```powershell
conda activate agent_desk
Set-Location .\backend
python -m pip install -e ".[dev]"
```

Apply database migrations:
```powershell
python -m alembic upgrade head
```
Migration revision `9171e84a323e` creates `users` and `refresh_token_sessions` tables.

Start the FastAPI application:
```powershell
python -m uvicorn app.main:app --reload
```

Run backend test suite:
```powershell
conda run -n agent_desk python -m pytest
```

Check API liveness and database readiness:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/ready
```

## Frontend

From the `frontend` directory:
```powershell
Set-Location .\frontend
npm.cmd install
npm.cmd run build   # Type-check and production bundle build
npm.cmd run lint    # ESLint check
npm.cmd test        # Vitest test suite
npm.cmd run dev     # Development server (http://localhost:5173)
```

## Manual Verification Steps
1. Start backend: `conda run -n agent_desk python -m uvicorn app.main:app --port 8000`
2. Start frontend: `npm.cmd run dev` in `frontend` directory.
3. Open `http://localhost:5173` in a browser.
4. Click "Create account", register with `user@example.com`, display name, and password. You will be authenticated into the AgenSpace workspace shell.
5. In the topbar or sidebar, click "Account Settings". Update display name and verify immediate update.
6. Test changing password under "Password security".
7. Click "Sign out" and verify redirection to login. Log in with the new password.
8. Inspect browser dev tools: verify `access_token` is never in `localStorage` or `sessionStorage`, and `refresh_token` cookie has `HttpOnly` flag set with path `/api/v1/auth`.

## Known Limitations & Future Work
- **Email Delivery Provider**: Direct verification email dispatch is pending integration of an external transactional email provider (e.g., Resend / SendGrid / Postmark). Newly registered accounts are active immediately, with `is_verified=False`.
- **Multi-Worker Rate Limiting**: The sliding-window rate limiter runs in-process. In a horizontally scaled multi-worker deployment, connect this interface to a shared Redis instance.
