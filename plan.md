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

---

## UI / UX design

The interface follows an admin-dashboard layout modeled on the **1Panel** console:
a clean, light theme, a single blue accent color, and content composed of rounded
white cards on a light-grey canvas. Every card has a title preceded by a small
vertical blue accent bar. Generous whitespace, subtle 1px borders, and soft shadows.

### Global shell

```
┌────────────┬───────────────────────────────────────────────────────────────┐
│            │  [Overview]  breadcrumb / tab bar         [region ▾] [profile ▾] │
│  ⬡ AWS     ├───────────────────────────────────────────────────────────────┤
│  OpenConsole│                                             ┌───────────────┐   │
│            │  ┌─────────────────────────────────────┐    │  Quick actions│   │
│  ▸ Overview│  │ ▍Account summary                    │    └───────────────┘   │
│  ▸ EC2     │  │  Instances  Buckets  Functions  ...  │    ┌───────────────┐   │
│  ▸ S3      │  └─────────────────────────────────────┘    │  Services list│   │
│  ▸ Lambda  │  ┌─────────────────────────────────────┐    │  (scrollable, │   │
│  ▸ IAM     │  │ ▍Status  (gauges: running / limits) │    │   per-row     │   │
│  ▸ VPC     │  └─────────────────────────────────────┘    │   actions)    │   │
│  ▸ RDS     │  ┌─────────────────────────────────────┐    └───────────────┘   │
│  ▸ Logs    │  │ ▍Activity / results table + chart   │                        │
│  ▸ Settings│  └─────────────────────────────────────┘                        │
│  ─────     │                                                                  │
│  ◉ Endpoint│  Copyright · Docs · GitHub                     v0.1.0  Guest mode│
└────────────┴───────────────────────────────────────────────────────────────┘
```

- **Left sidebar** — fixed, collapsible (chevron toggle at the top-right of the
  logo, collapses to icons-only like 1Panel). Logo/brand ("AWS OpenConsole") pinned
  at the top. Vertical list of **icon + label** nav items, one per AWS service
  (Overview, EC2, S3, Lambda, IAM, VPC, RDS, CloudWatch/Logs, ...). Grouped services
  (e.g. "Compute", "Storage") use an expandable caret like 1Panel's AI/WebSites/System
  groups. Active item highlighted with a light-blue pill + blue icon/text.
- **Bottom of sidebar** — a status chip analogous to 1Panel's "Main Node": here it
  shows the **active endpoint** (AWS vs local Floci) and connection state, clickable to
  open the endpoint-override dialog.
- **Top bar** — breadcrumb/tab showing the current page, plus right-aligned
  **region selector** and **profile selector** dropdowns (the "switch profiles &
  regions easily" requirement). In guest mode a small "Guest" badge; in register
  mode the account name/avatar with a sign-out menu.
- **Footer** — copyright, Docs / GitHub links, version, and current mode — matching
  1Panel's footer row.

### Overview / dashboard page

Mirrors the 1Panel Overview screen, repurposed for AWS:

- **Account summary card** (like 1Panel's "Overview" counters row) — a row of big-number
  stat counters for the selected profile/region: EC2 instances, S3 buckets, Lambda
  functions, IAM users, etc. Numbers are clickable and deep-link to the service page.
- **Status card** (like the circular gauges) — ring/donut gauges for at-a-glance
  health & quotas: running vs stopped instances, service-quota usage, billing/estimated
  cost, storage used. Same thin-ring style with a big % / value in the center and a
  caption below.
- **Monitoring card** (like the network chart) — a line chart of CloudWatch metrics
  with toggle pills (e.g. **CPU / Network / Requests**), a resource/NIC-style selector,
  and small metric "pills" above the chart (e.g. current, peak, total).
- **Right column** —
  - a **"Memo"-style notes card** (optional scratch notes, persisted locally), and
  - a **Services / Quick-actions list card** (like 1Panel's "Application" list):
    scrollable rows with a service icon, name, a short descriptor line, per-row action
    links (e.g. *Start · Stop · More*) and a primary button (e.g. *Open* / *Launch*),
    exactly like 1Panel's *Stop / Restart / More* + *Install* pattern.

### Service pages (EC2, S3, Lambda, ...)

Each service page reuses the same card system:

- **Action bar** at the top of the content — the action selector (e.g. for EC2:
  *List instances · Start · Stop · Terminate*) plus a search/filter box and a refresh
  button, laid out like the 1Panel *Network / Disk I/O* toggle + selector row.
- **Action form card** — inputs for the chosen action, rendered from the action's
  schema; a primary blue "Run" button.
- **Results card** —
  - a **table view** for list-type responses (sortable columns, row actions), and
  - a **collapsible raw-JSON inspector** beneath it.
  - Errors render in a clear alert style showing the underlying **AWS error
    code + message** (never masking the real error).

### Entry / auth screens

- **Mode chooser** — a centered card on the light canvas with two large choices,
  **Guest mode** and **Register mode**, each with a short description and icon.
- **Guest credential form** — card asking for endpoint URL, access key, secret key,
  and optional session token; a note that credentials stay in the browser only.
- **Register / login forms** — standard name/email/password cards, then a
  credential-vault screen to store AWS CLI credentials against the account.

### Design tokens

- **Color** — light neutral background (`#f5f6f8`-ish), white cards, primary blue
  accent (`#1f6feb`-family) for active nav, buttons, links, and gauges; muted grey
  for secondary text; green/orange/red only for status (running / warning / error).
- **Accent bar** — every card/section title is prefixed with a 3px tall vertical
  blue bar (the 1Panel signature).
- **Shape** — `~8px` rounded corners, 1px light borders, soft shadow on cards.
- **Typography** — clean sans-serif; large semibold numbers for stat counters and
  gauge centers; small grey captions.
- **Dark mode** — Tailwind `dark:` variants; same layout with a dark canvas and cards.
- **Responsive** — sidebar auto-collapses to icons (then to a drawer) on narrow
  screens; cards reflow from the two-column (main + right rail) layout to a single
  column.

Tailwind CSS carries the styling; a small set of reusable components — `Sidebar`,
`TopBar`, `Card` (with accent-bar title), `StatCounter`, `GaugeRing`, `MetricChart`,
`ResourceList`, `DataTable`, `JsonInspector`, `ActionForm` — compose every page.
