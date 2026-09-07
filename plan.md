i want to build an AWS CLI GUI (AWS OPENCONSOLE), a GUI that lets users manage AWS services through a friendly interface. 

Key architecture the user specified:
- **Two entry modes**
  - **Guest mode** — no registration. Frontend runs fully standalone (no backend required). The
    user's AWS credentials are stored in the **browser profile** (localStorage/IndexedDB). The
    React frontend signs and sends AWS API requests **directly** to AWS/Floci.
  - **Register mode** — user creates an account (name, email, password) in *our* system. They then
    store their AWS CLI credentials with the account. The frontend issues logical AWS "queries"; the
    **FastAPI backend proxies** them to real AWS using the stored credentials.
- **Profiles & regions** — switch between AWS profiles and regions easily.
- **Service selection** — pick a service (EC2, S3, Lambda, ...) and perform actions.
- **Stack** — React frontend (Vite), FastAPI backend (managed with `uv`).
- **Backend layout** — dedicated `routes/`, `models/`, `schemas/`, `services/`, `utils/` folders.
- **Endpoint targeting** — a custom-endpoint field so the same UI drives AWS or a local Floci.

## Deliverable
4. **Core features** — auth (guest vs register), profile/region switching, endpoint override,
   service selection, action forms, results view.
5. **Architecture** — the two-mode model spelled out with a request-flow description
   (guest: browser → AWS/Floci directly; register: browser → FastAPI → AWS/Floci).
   Include a small ASCII/mermaid flow diagram.
6. **Auth & credential handling** — where creds live in each mode; SigV4 signing in browser for
   guest; server-side encrypted storage for register; explicit security notes (browser CORS limits,
   why a proxy is needed for some services, credential-at-rest handling, never logging secrets).
7. **Tech stack** — React + **Vite** (frontend); **FastAPI** managed with **`uv`** (backend);
   notes on AWS SDK (JS in browser for guest mode / boto3 on backend for register mode), storage.
8. **Project structure** — document both trees:

10. **Data model (register mode)** — user, aws_credential, session (sketch only).
11. 7. **Results** — table view for list-type responses + a collapsible raw-JSON inspector; errors
   shown clearly with the underlying AWS error code/message.

techstake:
backend - fastapi , sqlite(for development), postgresql(for production) , use sqlalchemy and alembic. 
frontend - react, vite, tailwindcss, react-query, zustand, react-router


project structure:
   - `frontend/` — Vite + React app (`src/`, components, pages, api client, store).
   - `backend/` — FastAPI app arranged into dedicated folders:
     - `routes/` — API endpoint routers (auth, credentials, proxy, services).
     - `models/` — DB/ORM models (register mode: user, aws_credential, session).
     - `schemas/` — Pydantic request/response schemas.
     - `services/` — business logic (auth service, credential store, AWS proxy/boto3 caller).
     - `utils/` — helpers (crypto for creds-at-rest, SigV4/endpoint helpers, config).
     - plus `main.py`, `pyproject.toml` (uv), `config`/settings.



userflow: 
1. user open the plartform , the plartform ask for the mode (guest or nest) mode.
2. if user click guest mode, the platform will ask for the AWS credentials (url ,access key, secret key, session token) and store them in the browser's localStorage/IndexedDB. The user can then select a service, region, and perform actions directly through the frontend.
3. if user click register mode, the platform will ask for the user information (name, email, password) and create an account. The user can then store their AWS CLI credentials with the account. The frontend will issue logical AWS "queries" to the FastAPI backend, which will proxy them to real AWS using the stored credentials.
4. The user can switch between AWS profiles and regions easily in both modes.
