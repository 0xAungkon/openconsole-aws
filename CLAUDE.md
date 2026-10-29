# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AWS OpenConsole — a GUI for managing AWS (an "AWS CLI GUI"). A Vite/React/TypeScript frontend talks to a FastAPI backend that executes AWS calls with boto3 (and, for the terminal, the real `aws` CLI). LocalStack can stand in for real AWS.

## Commands

Python package (managed with **uv**, Python 3.13, run from the repo root):
```bash
uv sync                                       # install deps
uv run aws-openconsole --reload               # http://127.0.0.1:4567 — API + compiled UI, runs migrations on startup
uv run aws-openconsole --host 0.0.0.0         # expose on the LAN / tailnet
uv run pytest                                 # full test suite
uv run pytest tests/test_cli.py         # a single test file
uv run pytest tests/test_cli.py::test_cli_route_rejects_non_aws   # a single test
uv run alembic upgrade head                   # explicit migration — normally unnecessary, startup already runs it
uv run alembic revision --autogenerate -m "msg"   # new migration after a model change
```

Frontend (`cd frontend`, Node 20+):
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build — run this to typecheck; the build FAILS on unused vars
npm run lint       # oxlint
```
There is no frontend test runner. **After frontend changes, run `npm run build`** — it typechecks the whole project (`tsc -b` with `noUnusedLocals`), so an unused import/var breaks the build.

Run against LocalStack (no real AWS): `docker run -d --name floci -p 4566:4566 -v /var/run/docker.sock:/var/run/docker.sock localstack/localstack:3.8`, then use Guest mode with endpoint `http://localhost:4566` and dummy creds `test`/`test`. The Docker socket mount is required for Lambda invokes (functions stay `Failed: Docker not available` without it; the first invoke pulls a runtime image and can take a minute). Avoid 3.0 — its zero-byte `PutObject` is broken, which breaks S3 "New folder". LocalStack Community has **no RDS**; to exercise the Databases pages locally run moto's server in an isolated env — `uvx --from 'moto[server]' moto_server -p 5000` — and set the endpoint override to `http://localhost:5000`. Do not touch a pre-existing `floci-*` container if one is already running — it may be the user's.

## Architecture

**The frontend never calls AWS or signs requests.** In both auth modes it POSTs a raw query to the backend, which executes it. Two backend execution paths:

1. **`POST /api/proxy`** — generic boto3 dispatcher (`aws_openconsole/services/aws_proxy.py`). Body: `{ service, operation, region, params, endpoint_url?, credentials? | profile_id }`. It does `getattr(boto3.client(service, ...), operation)(**params)` and returns a JSON-safe result (datetimes→ISO, Decimal→float, bytes→text/base64, `ResponseMetadata` stripped). Binary request params (e.g. an S3 upload `Body`) are sent as `{"__bytes_base64__": "<b64>"}` and decoded to `bytes` server-side (`bytesParam()` in `src/lib/s3.ts`). Client-side helpers like `generate_presigned_url` work too (used for S3 downloads). `POST /api/proxy/lambda-code` is the one special case: it downloads a Lambda deployment package server-side from the presigned `Code.Location` that `get_function` returns (browsers can't — no CORS), capped at 10 MB. Because it's otherwise fully generic, **adding an AWS service or action requires no backend change** — it's a frontend catalog edit.

2. **`POST /api/cli`** — runs the real `aws` binary (`aws_openconsole/services/cli_runner.py`) for the in-app terminal. Hard security constraints here: the command's first token must be `aws`; it's parsed with `shlex` and run as an argv list **without a shell** (no metacharacter injection); credentials are injected via **environment variables only** (never argv, never logged); `AWS_CONFIG_FILE`/`AWS_SHARED_CREDENTIALS_FILE` are pinned to `os.devnull` so the server's own profiles can't leak in.

Both paths resolve credentials the same way via `aws_openconsole/services/request_auth.py::resolve_credentials`:
- **Guest mode** — inline credentials in the request body. Used transiently to build the client/env; **never persisted or logged**. Stored only in the browser (localStorage).
- **Register mode** — JWT (`Authorization: Bearer`) + `profile_id`. The stored profile's secrets are **encrypted at rest with Fernet** (`aws_openconsole/utils/crypto.py`), decrypted only in memory, and never returned by the API.

```
Guest:    Browser (creds in localStorage) ─query + inline creds─▶ /api/proxy|/api/cli ─boto3/aws─▶ AWS/LocalStack
Register: Browser (JWT + profile_id) ──────query──────▶ backend ─decrypt stored creds─▶ boto3/aws ─▶ AWS/LocalStack
```

Errors: `run_query` raises `ProxyExecutionError(ProxyError(code, message), status_code)`; AWS `ClientError` codes/messages are surfaced to the UI. The frontend treats non-2xx from `/api/proxy` as a normal error payload, not an auth failure.

## Frontend conventions

- **Service catalog** (`src/services/catalog.ts`) still defines every service's `key`/`route`/`label`/`code`/icon (the sidebar and Overview read it), and its `actions` drive the generic `ServicePage` for any service without a bespoke page — currently all six shipped services have bespoke pages, so the generic path is the fallback for new services. Each `ServiceDef` has `key` (the boto3 service name, e.g. `ec2`), a separate non-technical `route` slug (e.g. `compute`) used in URLs, a friendly `label`, a `code` badge, and `actions`. List actions supply a `getRows` transform + `columns`; mutations declare form `fields`. Keep `key` (boto3) and `route` (URL) distinct — the generic `ServicePage`/`ActionForm`/`DataTable` render entirely from this.
- **EC2/Compute and S3/Storage are bespoke, not catalog-driven.** `pages/Ec2Page.tsx` (list) and `pages/Ec2InstancePage.tsx` (full management console — power, rename, resize, firewall, tags, backup image, volumes) route under `compute`/`compute/:instanceId`; `pages/StoragePage.tsx` (bucket list + create panel) and `pages/BucketPage.tsx` (file browser with folder navigation via `?prefix=`, upload/download/rename-move/properties+share-link/delete, bucket size calculation, versioning, public-access block, default encryption, static website hosting, tags, empty/delete bucket) route under `storage`/`storage/:bucket`; `pages/FunctionsPage.tsx` (list with runtime/state filters + quick invoke, create panel: inline starter code zipped in the browser with `fflate`, runtime/handler/memory/timeout, IAM role picker with "Basic role" creation) and `pages/FunctionPage.tsx` (invoke/test with tailed logs, configuration incl. execution role, env vars, code editor + redeploy/zip upload, public function URL, reserved concurrency, versions & aliases, event-source triggers, CloudWatch metrics + logs, tags, delete) route under `functions`/`functions/:name`; `pages/DatabasesPage.tsx` (RDS list + create panel with generated password) and `pages/DatabasePage.tsx` (inline rename, start/stop/reboot, connect snippets, modify class/storage/engine version/backups/windows/password/public/Multi-AZ/deletion protection, VPC security groups, snapshots take/restore/delete, CloudWatch metrics, log files, tags, delete with final snapshot) route under `databases`/`databases/:id`; `pages/TablesPage.tsx` (DynamoDB list + create panel: partition/sort keys, on-demand vs provisioned, deletion protection) and `pages/TablePage.tsx` (items explorer — scan with filter builder, query by key/sort condition or GSI, paginated "Load more", add/edit/duplicate/delete items as plain JSON with (un)marshalling in `src/lib/dynamodb.ts`, multi-select batch delete; capacity, GSIs create/delete, TTL, streams, deletion protection + PITR, on-demand backups/restore, CloudWatch metrics, tags, delete) route under `nosql`/`nosql/:table`; `pages/AccessPage.tsx` (IAM: users/roles/groups/policies tabs via `?tab=`, account summary, create panels — user with console password + access key shown once, role with service/account/custom trust, group, policy from JSON templates — and cascading deletes that detach/clean dependencies first) with `IamUserPage` (permissions, groups, access keys, console sign-in/MFA, tags), `IamRolePage` (trust policy editor, settings), `IamGroupPage` (members), `IamPolicyPage` (document editor → new default version, versions, attached entities) under `access/{users,roles,groups}/:name` and `access/policies/:arn`; shared IAM pieces live in `components/iam/` (`PolicyPicker`, `useManagedPolicies`, `PermissionsCard`, `IamTagsCard`, `SecretDialog`) and the cascading-delete helpers in `src/lib/iam.ts`. All are registered ahead of the generic `:service` route in `App.tsx` and still go through `runQuery(...)`. Shared helpers live in `src/lib/ec2.ts` / `src/lib/s3.ts` / `src/lib/lambda.ts` / `src/lib/rds.ts` / `src/lib/dynamodb.ts` / `src/lib/iam.ts`; `components/MetricsCard.tsx` renders CloudWatch `get_metric_statistics` trend tiles for any resource (note: LocalStack 3.8's CloudWatch rejects current botocore's JSON protocol — metrics only work against real AWS or moto).
- **UI is shadcn/ui** (`src/components/ui/*`, radix preset, `cn` from the `cn` package). Theme tokens are mapped onto the brand palette in `src/index.css`; light/dark/system + accent color live in `store/themeStore.ts` (`.dark` class + `data-theme` on `<html>`). Toasts are Sonner (`toast` from `sonner`); every failed query/mutation toasts automatically via the QueryClient caches in `main.tsx` (opt out with `meta: { silent: true }`), success toasts are per-mutation. Destructive actions use `components/ConfirmDialog.tsx`, never `window.confirm`.
- **API layer**: `src/api/client.ts` is the axios instance (base URL from `VITE_API_URL`, attaches the JWT). `src/api/proxy.ts::runQuery` assembles the mode-specific body and logs every call to the Inspector; `src/api/cli.ts::runCli` does the same for the terminal.
- **State**: React Query for server data; Zustand (with `persist`) for client state — `authStore` (mode/token/guest creds), `sessionStore` (region/profile/endpoint), `logStore` (Inspector entries), `cliStore` (terminal lines + history, persisted so the terminal survives tab switches and reloads).
- **Styling**: Tailwind v4 via `@tailwindcss/vite`; class-based dark mode (`.dark` on `<html>`). The `brand` color palette and `canvas` are defined in `src/index.css` `@theme` (only shades 50–900 exist — no `brand-950`). Branding text comes from `VITE_BRAND_BADGE`/`VITE_BRAND_NAME` in `frontend/.env` (Vite reads `.env` only at startup — restart dev server after changing it).

## Backend layout

`aws_openconsole/routes/` (auth, credentials, proxy, cli) → thin HTTP handlers. `aws_openconsole/services/` holds the real logic (`aws_proxy`, `cli_runner`, `request_auth`, `credential_store`, `auth_service`). `aws_openconsole/models/` + Alembic for persistence (SQLite `dev.db` in dev; `users` + `aws_credentials`). `aws_openconsole/utils/` for `crypto` (Fernet) and `security` (JWT/bcrypt, `current_user` dependency). Config via pydantic-settings from `.env` (`JWT_SECRET`, `ENCRYPTION_KEY`, DB URL, CORS origins). Tests use `moto` to mock AWS and only exercise CLI **rejection** paths (they never spawn a real `aws` process).
