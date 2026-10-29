# syntax=docker/dockerfile:1

# Astral's official image ships `uv` plus a managed Python 3.13, so the build
# needs neither the host's Python nor Node: the UI is committed to the repo
# already compiled and rides along inside the package, so there is nothing to
# build here.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# --- dependencies: their own layer so they stay cached while code changes ---
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# --- application ------------------------------------------------------------
COPY . .
RUN uv sync --frozen --no-dev

# Run unprivileged, with somewhere SQLite can actually be written. The venv
# stays root-owned (read-only for `console`, which is all it needs).
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin console \
    && mkdir -p /app/data \
    && chown console:console /app/data
USER console

# Keep the database out of the container's own layer so it survives a rebuild.
ENV DATABASE_URL=sqlite:////app/data/dev.db

EXPOSE 4567

# 0.0.0.0 is mandatory inside a container — binding localhost would make it
# unreachable from outside the network namespace.
CMD ["/app/.venv/bin/aws-openconsole", "--host", "0.0.0.0", "--port", "4567"]
