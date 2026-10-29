"""``aws-openconsole`` — start the AWS OpenConsole server.

    $ aws-openconsole                       # http://127.0.0.1:4567
    $ aws-openconsole --host 0.0.0.0        # reachable from your LAN / tailnet

One command, one port: the API and the compiled UI are served together, and
migrations run automatically on startup so a brand new database needs no
separate setup commands.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# aws_openconsole/__main__.py -> aws_openconsole/
PKG_DIR = Path(__file__).resolve().parent


def _upgrade_database() -> None:
    """Bring the configured database up to the latest schema.

    Deliberately runs *before* ``aws_openconsole.main`` is imported: alembic's
    ``fileConfig()`` reconfigures logging with ``disable_existing_loggers``,
    which would otherwise silence the app logger that ``main.py`` sets up.
    """
    from alembic import command
    from alembic.config import Config

    from aws_openconsole.config import settings

    ini = PKG_DIR / "alembic.ini"
    if not ini.is_file():
        return

    cfg = Config(str(ini))
    cfg.set_main_option("script_location", str(PKG_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="aws-openconsole",
        description="Run the AWS OpenConsole server (API + UI on one port).",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Interface to bind. Default: localhost only — use 0.0.0.0 to "
        "expose it on your LAN or tailnet (the UI has no login screen of its own).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=4567,
        help="Port to listen on (default: 4567).",
    )
    parser.add_argument("--reload", action="store_true", help="Restart on source changes (development).")
    parser.add_argument(
        "--no-migrate",
        action="store_true",
        help="Skip running database migrations on startup.",
    )
    args = parser.parse_args(argv)

    if not args.no_migrate:
        try:
            _upgrade_database()
        except Exception as exc:  # noqa: BLE001 — surface any migration failure plainly
            print(
                f"aws-openconsole: database migration failed: {exc}\n"
                "  Check DATABASE_URL / write permissions, or start with --no-migrate.",
                file=sys.stderr,
            )
            raise SystemExit(1) from exc

    # Imported only now, after migrations — see _upgrade_database().
    import uvicorn

    from aws_openconsole.main import app

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
