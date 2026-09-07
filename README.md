# AWS OpenConsole

A GUI for managing AWS services — an "AWS CLI GUI". Pick a service (EC2, S3,
Lambda, IAM, RDS…), fill in an action form, and see results as a table plus a
raw-JSON inspector. Switch regions and profiles, and point at a local
Floci/LocalStack endpoint instead of real AWS.

## Architecture

The frontend never calls AWS directly. In **both** modes it sends a *raw AWS
query* — `{ service, operation, region, params, endpoint_url?, credentials? }` —
to the FastAPI backend, which executes it with **boto3** and returns the result.
This sidesteps browser CORS and keeps the backend service-agnostic: adding a new
service/action is a change to the frontend catalog (`frontend/src/services/catalog.ts`),
not new backend code.

```
Guest mode:    Browser (creds in localStorage) ──query + inline creds──▶ FastAPI ──boto3──▶ AWS/Floci
Register mode: Browser (JWT + profile_id) ──────query──────▶ FastAPI ──decrypt creds──▶ boto3 ──▶ AWS/Floci
```

- **Guest mode** — no account. Credentials live in the browser and are sent per
  request; the backend uses them transiently and never persists or logs them.
- **Register mode** — create an account, store AWS profiles that are **encrypted
  at rest** (Fernet) and resolved server-side via a JWT + profile id.

## Layout

- `backend/` — FastAPI app (`app/routes`, `app/models`, `app/schemas`,
  `app/services`, `app/utils`), SQLAlchemy + Alembic, managed with **uv**.
- `frontend/` — Vite + React + TypeScript, Tailwind CSS, React Query, Zustand,
  React Router. 1Panel-style dashboard shell.

## Prerequisites

- Python 3.13 + [uv](https://docs.astral.sh/uv/)
- Node 20+
- (Optional) Docker, for a local AWS via LocalStack

## Backend

```bash
cd backend
cp .env.example .env        # then fill in JWT_SECRET and ENCRYPTION_KEY
# generate secrets:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"        # JWT_SECRET
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # ENCRYPTION_KEY

uv sync                     # install deps
uv run alembic upgrade head # create the SQLite schema
uv run uvicorn app.main:app --reload   # serves on http://localhost:8000
uv run pytest               # run the test suite
```

## Frontend

```bash
cd frontend
npm install
npm run dev                 # serves on http://localhost:5173 (proxies /api -> :8000)
```

Open http://localhost:5173.

## Try it against LocalStack (no real AWS needed)

```bash
docker run -d --name floci -p 4566:4566 localstack/localstack:3.0
```

Then in the app:

1. Choose **Guest mode**.
2. Endpoint URL: `http://localhost:4566`, access key / secret: `test` / `test`,
   region `us-east-1`.
3. Go to **S3** → *Create bucket* (name it `demo-bucket`) → *List buckets*.
4. Switch the region in the top bar; try **EC2 → List instances**.
5. Trigger an error (e.g. *Delete bucket* on a missing name) — the AWS error
   code and message are shown.

For **Register mode**, sign up, add a profile under **Profiles** (you can set the
same LocalStack endpoint per profile), select it in the top bar, and run the same
queries — now proxied with server-side stored credentials.

## Security notes

- Guest credentials are stored only in the browser and are never persisted or
  logged by the backend.
- Stored profiles encrypt secret material at rest with Fernet; secrets are never
  returned by the API.
- Register-mode auth uses JWT access tokens; passwords are bcrypt-hashed.
- CORS is restricted to the configured frontend origin(s).

## Extending

Add a service or action by editing `frontend/src/services/catalog.ts`. Each list
action provides a `getRows` transform and `columns`; mutations declare their form
`fields`. The backend needs no changes — it dispatches any valid boto3 operation.
