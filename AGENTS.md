# AGENTS.md

Guidance for AI agents working in this repository.

## What this is

AWS OpenConsole — a GUI for managing AWS (an "AWS CLI GUI"). A Vite/React/TypeScript frontend talks to a FastAPI backend that executes AWS calls with boto3 (and, for the terminal, the real `aws` CLI). LocalStack can stand in for real AWS.

## Commands

Python package (managed with **uv**, Python 3.13, run from the repo root):
```bash
uv sync                                       # install deps
uv run aws-openconsole --reload               # http://127.0.0.1:8000 — serves the API + compiled UI, runs migrations on startup
uv run aws-openconsole --host 0.0.0.0         # expose on the LAN / tailnet
uv run pytest                                 # full test suite (25 tests)
uv run pytest tests/test_cli.py         # a single test file
uv run pytest tests/test_cli.py::test_cli_route_rejects_non_aws   # a single test
uv run alembic upgrade head                   # explicit migration — normally unnecessary, startup already runs it
uv run alembic revision --autogenerate -m "msg"   # new migration after a model change
```

End users run none of this: `uvx --from "git+https://github.com/0xAungkon/openconsole-aws" aws-openconsole` needs no clone and no Node, because the compiled UI and the migrations ship inside the wheel.

Frontend (`cd frontend`, Node 20+, `npm install`):
```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build — run this to typecheck; the build FAILS on unused vars
npm run preview    # serve the built bundle on http://localhost:4173 (/api proxied to :8000)
npm run lint       # oxlint
```

**Embedded frontend**: the compiled bundle lives in `aws_openconsole/frontend_dist/` and is served at `/`, so one process gives the whole app. That directory is **committed on purpose, not gitignored** — it ships inside the wheel, which is what lets `uvx aws-openconsole` serve a working UI with no Node installed. Deleting or ignoring it breaks every installed copy. When run from a git checkout with `frontend/node_modules` present, `aws_openconsole/services/frontend.py` recompiles it on startup if the sources are newer; when installed from a wheel there is no `frontend/` source, so it logs "serving the bundled UI build" and skips the build. It registers a catch-all `GET /{path}` *after* every API route, so API/docs always win and unknown paths return `index.html` for React Router. `AUTO_BUILD_FRONTEND=false` disables the build (tests set this). Because `npm run build` and the backend build share that output dir, both must emit same-origin bundles — see the `.env.*` modes below.

**Vite env modes** (mode files override `.env`; a real env var overrides everything):

| File | Used by | `VITE_API_URL` |
| --- | --- | --- |
| `.env` | dev, all modes | `http://localhost:8000` (cross-origin, CORS) |
| `.env.production` | `npm run build` | empty → same-origin |
| `.env.embedded` | backend startup build | empty → same-origin |

**There is no frontend test runner configured.** After frontend changes, run `npm run build` — it typechecks the whole project (`tsc -b` with `noUnusedLocals`), so an unused import/var breaks the build.

`frontend/tests/run-history.mjs` is a standalone history-persistence check. It is **not** runnable as documented: it imports `rolldown`, which is not in `package.json` and not installed. `npm install` does not provide it. Don't run it or add it without asking — just use `npm run build` for verification.

There is no CI (`.github/` does not exist), so `npm run build` + `uv run pytest` is the entire verification story.

## Run against LocalStack (no real AWS)

```bash
docker run -d --name floci -p 4566:4566 localstack/localstack:3.0
```
Then use Guest mode with endpoint `http://localhost:4566` and dummy creds `test`/`test`. Do not touch a pre-existing `floci-*` container if one is already running — it may be the user's.

## Architecture

**The frontend never calls AWS or signs requests.** In both auth modes it POSTs a raw query to the backend, which executes it. Two backend execution paths:

1. **`POST /api/proxy`** — generic boto3 dispatcher (`aws_openconsole/services/aws_proxy.py`). Body: `{ service, operation, region, params, endpoint_url?, credentials? | profile_id }`. It does `getattr(boto3.client(service, ...), operation)(**params)` and returns a JSON-safe result (datetimes→ISO, Decimal→float, bytes→text/base64, `ResponseMetadata` stripped). Binary params (e.g. an S3 upload `Body`) are sent as `{"__bytes_base64__": "<b64>"}` and decoded server-side. `POST /api/proxy/lambda-code` is the one special case: it downloads a Lambda deployment package server-side from the presigned `Code.Location` of `get_function` (browsers can't — no CORS), capped at 10 MB. Because it's otherwise fully generic, **adding an AWS service or action requires no backend change** — it's a frontend catalog edit.

2. **`POST /api/cli`** — runs the real `aws` binary (`aws_openconsole/services/cli_runner.py`) for the in-app terminal. Hard security constraints: the command's first token must be `aws`; it's parsed with `shlex` and run as an argv list **without a shell** (no metacharacter injection); credentials are injected via **environment variables only** (never argv, never logged); `AWS_CONFIG_FILE`/`AWS_SHARED_CREDENTIALS_FILE` are pinned to `os.devnull` so the server's own profiles can't leak in.

Both paths resolve credentials identically via `aws_openconsole/services/request_auth.py::resolve_credentials`:
- **Guest mode** — inline credentials in the request body. Used transiently to build the client/env; **never persisted or logged**. Stored only in the browser (localStorage).
- **Register mode** — JWT (`Authorization: Bearer`) + `profile_id`. The stored profile's secrets are **encrypted at rest with Fernet** (`aws_openconsole/utils/crypto.py`), decrypted only in memory, and never returned by the API.

```
Guest:    Browser (creds in localStorage) ─query + inline creds─▶ /api/proxy|/api/cli ─boto3/aws─▶ AWS/LocalStack
Register: Browser (JWT + profile_id) ──────query──────▶ backend ─decrypt stored creds─▶ boto3/aws ─▶ AWS/LocalStack
```

Errors: `run_query` raises `ProxyExecutionError(ProxyError(code, message), status_code)`; AWS `ClientError` codes/messages surface to the UI. The frontend treats non-2xx from `/api/proxy` as a normal error payload, not an auth failure.

## Frontend conventions

- **Service catalog is the source of truth** (`src/services/catalog.ts`). Each `ServiceDef` has `key` (the boto3 service name, e.g. `ec2`), a separate non-technical `route` slug (e.g. `compute`) used in URLs, a friendly `label`, a `code` badge, and `actions`. List actions supply a `getRows` transform + `columns`; mutations declare form `fields`. Keep `key` (boto3) and `route` (URL) distinct. The generic `ServicePage` renders from this, but it is only a **fallback** — all six shipped services have bespoke pages.
- **Bespoke pages, not catalog-driven.** Under `/:profile` in `App.tsx`, ahead of the generic `:service` route: `compute`/`compute/:instanceId` (EC2 power/rename/resize/firewall/tags/backup/volumes), `storage`/`storage/:bucket` (bucket list + S3 file browser with `?prefix=` navigation, upload/download/move, versioning, encryption, website hosting), `functions`/`functions/:name` (Lambda create with `fflate`-zipped inline code, invoke, deploys, triggers, URLs), `databases`/`databases/:id` (RDS), `nosql`/`nosql/:table` (DynamoDB items/GSIs/TTL/streams), `access/...` (IAM users/roles/groups/policies with cascading deletes). Shared helpers: `src/lib/{ec2,s3,lambda,rds,dynamodb,iam}.ts`, IAM cards in `components/iam/`, CloudWatch tiles in `components/MetricsCard.tsx`. All still go through `runQuery(...)`.
- **API layer**: `src/api/client.ts` is the axios instance (base URL from `API_BASE_URL` in `src/api/baseUrl.ts`, attaches the JWT). `src/api/proxy.ts::runQuery` assembles the mode-specific body and logs every call to the Inspector; `src/api/cli.ts::runCli` does the same for the terminal.
- **State**: React Query for server data; Zustand (with `persist`) for client state — `authStore`, `sessionStore` (region/profile/endpoint), `logStore` (Inspector), `cliStore`, `themeStore`. Signed-in history syncs to the backend via `store/historySync.ts`; guest history stays in localStorage.
- **UI is shadcn/ui** (`src/components/ui/*`). Toasts are Sonner; failed queries/toasts auto-fire via the QueryClient caches in `main.tsx` (opt out with `meta: { silent: true }`). **Errors must go through `toastError()` in `src/lib/toast.tsx`** (not `toast.error`) — it attaches a copy button so the message can be pasted elsewhere, and holds for 8s instead of Sonner's 4s. Success/info toasts keep using `toast.*` directly; so do the `'Clipboard is unavailable in this browser'` notices, since a copy button there would fail too. Destructive actions use `components/ConfirmDialog.tsx`, **never** `window.confirm`.
- **Responsive layout**. The shell (`pages/AppLayout.tsx`) is a flex row: `components/Sidebar.tsx` is `hidden lg:flex`, and below `lg` a hamburger in `components/TopBar.tsx` opens `components/MobileNav.tsx` (a Sheet wrapping the same `SidebarNav`). Both read `useParams` themselves — pass only `collapsed` and an optional `onNavigate` (the drawer closes on it). Never add a fixed width that can't shrink: bound long labels with `max-w-… truncate` (see the endpoint button in `BottomDock.tsx`) and give SVG charts `min-w-0`. **Responsive grids need an explicit base column** — write `grid grid-cols-1 gap-4 lg:grid-cols-2`. A bare `grid gap-4 lg:grid-cols-2` uses an implicit `auto` track that sizes to max-content and overflows narrow phones (it silently hid the Overview Services card). `index.css` pins `html/body/#root` to `100dvh` and the dock pads by `env(safe-area-inset-bottom)`.
- **Insecure origins are supported and easy to break silently.** The app is routinely served over plain HTTP on a LAN/Tailscale IP (`http://100.106.225.24:8000`), where `window.isSecureContext` is false: `crypto.randomUUID` and `navigator.clipboard` are both **undefined** there, while `localhost` is treated as trustworthy and hides the breakage. Anything needing an id must go through `lib/uid.ts::uid()` (falls back to `getRandomValues`) and anything copying must go through `lib/clipboard.ts::copyText()` (falls back to `document.execCommand`). Never call `crypto.randomUUID()` or `navigator.clipboard.*` directly. Always verify on a non-localhost host, not just `:8000`.
- **Styling**: Tailwind v4 via `@tailwindcss/vite`; class-based dark mode (`.dark` on `<html>`) plus `data-theme` accent, from `store/themeStore.ts`. The `brand` palette and `canvas` are in `src/index.css` `@theme` — only shades 50–900 exist, **no `brand-950`**. Branding text comes from `VITE_BRAND_BADGE`/`VITE_BRAND_NAME` in `frontend/.env`; Vite reads `.env` only at startup, so restart the dev server after changing it.

## Backend layout

`aws_openconsole/routes/` (auth, credentials, proxy, cli, history) → thin HTTP handlers. `aws_openconsole/services/` holds the real logic (`aws_proxy`, `cli_runner`, `request_auth`, `credential_store`, `auth_service`, `history_store`, `frontend`). `aws_openconsole/models/` + Alembic for persistence (SQLite `dev.db` in dev; `users`, `aws_credentials`, plus `history`/`session` tables from `alembic/versions/8fa24b2c1910_add_history.py` — actual table names are `history_entries`/`sessions`). `aws_openconsole/utils/` for `crypto` (Fernet) and `security` (JWT/bcrypt, `current_user` dependency). Config via pydantic-settings from `.env` (`JWT_SECRET`, `ENCRYPTION_KEY`, DB URL, CORS origins, frontend build settings).

**Logging**: the app configures nothing, so the root logger sits at WARNING and `logger.info(...)` is invisible. `aws_openconsole/main.py` attaches a handler to the `aws_openconsole` logger at INFO (scoped, so `sqlalchemy`/`httpx`/`boto3` stay quiet). Put app logs under `aws_openconsole.*` or they'll be silently dropped.

**Tests** (`tests/`, `uv run pytest`): 25 tests across 6 files. `tests/conftest.py` sets `DATABASE_URL`/`JWT_SECRET`/`ENCRYPTION_KEY` env defaults **before** app modules import their cached `settings`, and overrides `get_db` with an in-memory SQLite engine — don't reorder that. Only `tests/test_proxy.py` uses `moto`; the CLI tests exercise **rejection paths only** and never spawn a real `aws` process.
