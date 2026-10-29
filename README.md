# AWS OpenConsole

### AWS for Homosapiens

![AWS OpenConsole overview](Assets/overview.png)

Skip the command line. OpenConsole is a graphical console for the AWS services
you use every day — spin up servers, manage files, deploy functions and control
access, all from your browser.

---

## Features

### Six services, fully browsable

| Service | What you can do |
| --- | --- |
| **Compute** (EC2) | Launch, start, stop and terminate instances. From an instance's page: rename, resize, edit firewall rules, manage tags and volumes, take backups. |
| **Storage** (S3) | Browse buckets and folders, upload, download and move files. Versioning, encryption and static website hosting included. |
| **Functions** (Lambda) | Write functions as inline code, deploy updates, attach triggers and manage function URLs. |
| **Access** (IAM) | Manage users, roles, groups and policies, with dependency-aware deletes that clean up what depends on something. |
| **Databases** (RDS) | List, start and stop database instances. |
| **NoSQL** (DynamoDB) | Browse tables and items, manage GSIs, TTL and streams. |

### Built for real work

- **Guest mode** — no sign-up. Paste credentials and go. They stay in your
  browser and are never stored on the server.
- **Register mode** — create an account and save connection profiles. AWS
  secrets are encrypted at rest and are never sent back to your browser.
- **In-app terminal** — a real `aws` CLI that shares your region and
  credentials with the GUI.
- **Inspector** — every call is logged with the raw JSON response *and* the
  exact CLI command to reproduce it.
- **LocalStack ready** — point the endpoint at a local AWS emulator and build
  against free fake AWS.
- **History** — signed-in sessions sync your activity across devices; guests
  keep it in the browser.
- **Dark mode**, and a layout that works on phone and desktop.

---

## Prerequisites

| Requirement | Version |
| --- | --- |
| [Node.js](https://nodejs.org/) | 20.19 or newer |
| [Python](https://www.python.org/) | 3.13 or newer |
| [uv](https://docs.astral.sh/uv/) | latest (installs and runs the backend) |
| AWS account | access keys — *or* skip it with LocalStack, below |

---

## Tech stack

**Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui,
React Query, Zustand.

**Backend** — FastAPI, boto3 (and the real `aws` CLI for the terminal),
SQLAlchemy + Alembic on SQLite. Auth is JWT sessions with bcrypt password
hashing; stored AWS secrets are encrypted with Fernet.

Your browser never talks to AWS. It sends each query to the backend, which
signs and executes it — so there's no browser CORS problem, and in register
mode your credentials stay server-side.

---

## Common commands

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (hot reload)
npm run build      # typecheck + production build
npm run preview    # serve the built bundle on http://localhost:4173
```

### Backend

```bash
cd backend
cp .env.example .env     # then set JWT_SECRET and ENCRYPTION_KEY
uv sync                  # install dependencies
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

The backend runs on **http://localhost:8000** and *also serves the built
frontend at `/`* — so that one URL gives you the whole app on a single port.

To run the frontend separately during development, use `npm run dev` above;
it talks to `:8000` automatically.

### Tests

```bash
cd backend
uv run pytest
```

### Try it without an AWS account

Run [LocalStack](https://localstack.cloud/) locally, then choose **Guest**
mode with endpoint `http://localhost:4566` and the dummy credentials
`test` / `test`.

```bash
docker run -d --name localstack -p 4566:4566 localstack/localstack:3.0
```

---

## License

Released under the [Creative Commons Attribution-NonCommercial 4.0](LICENSE)
International license.

You are free to use, modify and share this for **personal, non-commercial**
purposes. Commercial use is **not** permitted without permission.

Copyright © 2026 [0xAungkon](https://github.com/0xAungkon).
