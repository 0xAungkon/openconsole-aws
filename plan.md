
## Context
an "AWS CLI GUI." The user wants it
expanded into a complete v1 draft **idea document** (a spec/vision doc, not code) for a GUI that
lets users manage AWS services through a friendly interface. 

Key architecture the user specified:
- **Two entry modes**
  - **Guest mode** — no registration. Frontend runs fully standalone (no backend required). The
    user's AWS credentials are stored in the **browser profile** (localStorage/IndexedDB). The
    React frontend signs and sends AWS API requests **directly** to AWS/Floci.
  - **Register mode** — user creates an account (name, email, password) in *our* system. They then
    store their AWS CLI credentials with the account. The frontend issues logical AWS "queries"; the
    **FastAPI backend proxies** them to real AWS/Floci using the stored credentials.
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
   - `frontend/` — Vite + React app (`src/`, components, pages, api client, store).
   - `backend/` — FastAPI app arranged into dedicated folders:
     - `routes/` — API endpoint routers (auth, credentials, proxy, services).
     - `models/` — DB/ORM models (register mode: user, aws_credential, session).
     - `schemas/` — Pydantic request/response schemas.
     - `services/` — business logic (auth service, credential store, AWS proxy/boto3 caller).
     - `utils/` — helpers (crypto for creds-at-rest, SigV4/endpoint helpers, config).
     - plus `main.py`, `pyproject.toml` (uv), `config`/settings.
10. **Data model (register mode)** — user, aws_credential, session (sketch only).
11. 7. **Results** — table view for list-type responses + a collapsible raw-JSON inspector; errors
   shown clearly with the underlying AWS error code/message.

### Design language (UI reference: 1Panel-style admin panel)

The UI should feel like a **modern, friendly server admin panel** (reference: 1Panel) — clean,
card-based, and approachable for non-technical users. Key traits:

- **Left icon sidebar** — a fixed vertical nav with an icon + label per item and a highlighted
  active item. Top = **Overview/Dashboard**; below it the AWS **services** (S3, EC2, Lambda, …),
  each with its own icon; **Settings** pinned at the bottom. Collapsible to icons-only.
- **Overview dashboard (landing page)** — the first thing a user sees after login:
  - A row of **stat tiles** (big number + label) — e.g. Buckets, Instances, Functions, Regions.
  - **Donut / gauge widgets** for at-a-glance status (e.g. running vs stopped instances).
  - A **right-hand info panel** summarizing the active connection: endpoint (AWS ⇄ Floci badge),
    profile, region, account/identity — mirroring 1Panel's "System information" card.
- **Card-based content** — every section (lists, forms, results) sits in a rounded white card with
  a subtle title bar and light borders, on a soft off-white background.
- **Light, calm theme** — blue accent for primary actions/active state, generous white space,
  restrained color (green = ok/running, red = error/stopped). Dark mode as a later add-on.
- **Consistent action affordances** — primary buttons (Run, Install-style) on the right of a row;
  inline actions (Start/Stop/More) as small links, like the reference's app list.
- **Data-first, jargon-light** — human labels over API names ("Storage (S3)", "Servers (EC2)"),
  friendly empty states, and tooltips explaining anything technical (as in the hover card in the
  reference screenshot).
- **Persistent top bar** — profile · region · endpoint switcher · account menu, always visible.
- **Responsive** — sidebar collapses and cards stack on narrow screens.

- **M1 — Guest mode skeleton + admin shell**: Vite app with the **1Panel-style layout** (left icon
  sidebar, top bar, card-based content, Overview dashboard shell), mode picker, credential +
  endpoint form, browser storage, and a working **S3** list/read against Floci.
- **M2 — More services (guest)**: **EC2** (describe instances) and **Lambda** (list/get functions),
  region switching, JSON viewer, action history.
- **M3 — Member mode + backend**: FastAPI (`uv`) with routes/models/schemas/services/utils,

13. **Open questions / risks** — browser CORS/SigV4 reachability, credential security, service
    breadth, standalone-frontend distribution.


