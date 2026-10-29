"""Build the Vite frontend and serve it from FastAPI at "/".

The server is self-contained. A compiled UI ships inside the package at
``aws_openconsole/frontend_dist``, so an installed instance serves it with no
Node toolchain at all. When running from a git checkout that has
``frontend/node_modules``, the build is refreshed on startup whenever the
sources are newer than the last build.

Unknown paths fall back to ``index.html`` so React Router can handle them
client-side. API routes, ``/docs`` and ``/openapi.json`` are registered first
and therefore always win.

Set ``AUTO_BUILD_FRONTEND=false`` to only serve an existing build (useful in CI
and in the test suite).
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, Response

from aws_openconsole.config import settings

logger = logging.getLogger(__name__)

# aws_openconsole/services/frontend.py -> services/ -> aws_openconsole/ -> repo root
PKG_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PKG_DIR.parent

# Files that invalidate the build when they change. node_modules is excluded.
_WATCHED = ("src", "public", "index.html", "vite.config.ts", "package.json", "tsconfig.json")

# Vite hashes asset filenames, so they can be cached forever; index.html cannot.
_IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}
_NO_CACHE = {"Cache-Control": "no-cache"}


def frontend_src() -> Path:
    return Path(settings.frontend_src).expanduser() if settings.frontend_src else REPO_ROOT / "frontend"


def frontend_dist() -> Path:
    return Path(settings.frontend_dist).expanduser() if settings.frontend_dist else PKG_DIR / "frontend_dist"


def _runner() -> list[str] | None:
    """Locate a JS package manager. npm is preferred (the repo has package-lock.json),
    falling back to corepack/npm and pnpm for environments where npm is not on PATH."""
    for candidate in (["npm"], ["corepack", "npm"], ["pnpm"], ["corepack", "pnpm"]):
        if shutil.which(candidate[0]):
            return candidate
    return None


def _installed() -> bool:
    return (frontend_src() / "node_modules" / ".bin" / "vite").exists()


def _newest_source_mtime() -> float:
    src = frontend_src()
    newest = 0.0
    for name in _WATCHED:
        target = src / name
        if target.is_file():
            newest = max(newest, target.stat().st_mtime)
        elif target.is_dir():
            for path in target.rglob("*"):
                if path.is_file():
                    newest = max(newest, path.stat().st_mtime)
    return newest


def is_stale() -> bool:
    """True when the sources are newer than the last successful build (or nothing was built)."""
    index = frontend_dist() / "index.html"
    if not index.is_file():
        return True
    return _newest_source_mtime() > index.stat().st_mtime


def build_frontend() -> bool:
    """Run the production build. Returns True when a servable build exists afterwards."""
    dist = frontend_dist()
    src = frontend_src()

    if not (src / "package.json").is_file():
        # Installed from a wheel: there is no frontend/ checkout to build, but
        # the compiled UI ships inside the package, so everything still works.
        if (dist / "index.html").is_file():
            logger.info("No frontend source at %s — serving the bundled UI build.", dist)
            return True
        logger.warning("Frontend source not found at %s — serving API only.", src)
        return False
    if not is_stale():
        logger.info("Frontend build is up to date (%s).", dist)
        return True
    if not _installed():
        logger.warning(
            "frontend/node_modules is missing — run `npm install` in %s to enable the frontend build.", src
        )
        return (dist / "index.html").is_file()

    runner = _runner()
    if runner is None:
        logger.warning("No npm/pnpm found on PATH — skipping the frontend build.")
        return (dist / "index.html").is_file()

    logger.info("Building frontend (%s run build:embedded)…", " ".join(runner))
    started = time.monotonic()
    try:
        proc = subprocess.run(
            [*runner, "run", "build:embedded"],
            cwd=src,
            capture_output=True,
            text=True,
            timeout=settings.frontend_build_timeout,
            env={**os.environ, "CI": "1"},
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.error("Frontend build failed to start: %s", exc)
        return (dist / "index.html").is_file()

    if proc.returncode != 0:
        # The build runs tsc first, so surface its diagnostics rather than a bare exit code.
        output = "\n".join(part.strip() for part in (proc.stdout, proc.stderr) if part and part.strip())
        logger.error("Frontend build failed (exit %s):\n%s", proc.returncode, output[-4000:])
        return (dist / "index.html").is_file()

    logger.info("Frontend built in %.1fs → %s", time.monotonic() - started, dist)
    return True


def _index_response() -> Response:
    index = frontend_dist() / "index.html"
    if not index.is_file():
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Frontend has not been built. Run `npm install && npm run build` "
                    f"in {frontend_src()}, or start the backend with AUTO_BUILD_FRONTEND=true."
                )
            },
        )
    return FileResponse(index, media_type="text/html", headers=_NO_CACHE)


def register_frontend(app: FastAPI) -> None:
    """Serve the built SPA. Must be called after every API route is registered.

    Everything is served by one catch-all route rather than a StaticFiles mount
    so cache headers can be set per-path (immutable for hashed assets, no-cache
    for index.html) — StaticFiles in Starlette 1.6 has no headers option.
    """
    dist = frontend_dist()
    assets = (dist / "assets").resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> Response:
        # Never let the SPA swallow API/docs paths that fell through to a 404 —
        # those must stay JSON, not HTML. Match whole segments so a real client
        # route such as /documentation is unaffected.
        segments = full_path.split("/", 1)
        if segments[0] in {"api", "docs", "redoc", "openapi.json"}:
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        if full_path:
            candidate = (dist / full_path).resolve()
            try:
                candidate.relative_to(dist.resolve())  # reject path traversal
            except ValueError:
                return JSONResponse(status_code=404, content={"detail": "Not Found"})
            if candidate.is_file():
                headers = _IMMUTABLE if candidate.is_relative_to(assets) else _NO_CACHE
                return FileResponse(candidate, headers=headers)

        # Unknown path → hand index.html to the client-side router.
        return _index_response()
