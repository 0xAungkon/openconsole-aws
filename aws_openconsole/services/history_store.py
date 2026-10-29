from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from aws_openconsole.models.history import HistoryEntry
from aws_openconsole.schemas.history import Entry

LIMITS = {"inspector": 200, "terminal": 500, "commands": 200}


def read_history(db: Session, user_id: int) -> dict[str, list[dict]]:
    result = {kind: [] for kind in LIMITS}
    rows = db.scalars(select(HistoryEntry).where(
        HistoryEntry.user_id == user_id
    ).order_by(HistoryEntry.id))
    for row in rows:
        result[row.kind].append(row.payload)
    return result


def append_history(db: Session, user_id: int, kind: str, entries: list[Entry]) -> None:
    # SQLite is the application's database. Idempotent appends make retries safe.
    db.execute(insert(HistoryEntry).values([
        dict(user_id=user_id, entry_id=str(entry.id), kind=kind, payload=entry.payload)
        for entry in entries
    ]).on_conflict_do_nothing(index_elements=["user_id", "kind", "entry_id"]))
    keep = select(HistoryEntry.id).where(
        HistoryEntry.user_id == user_id, HistoryEntry.kind == kind
    ).order_by(HistoryEntry.id.desc()).limit(LIMITS[kind])
    db.execute(delete(HistoryEntry).where(
        HistoryEntry.user_id == user_id, HistoryEntry.kind == kind,
        HistoryEntry.id.not_in(keep),
    ), execution_options={"synchronize_session": False})
    db.commit()


def clear_history(db: Session, user_id: int, kind: str) -> None:
    db.execute(delete(HistoryEntry).where(
        HistoryEntry.user_id == user_id, HistoryEntry.kind == kind
    ))
    db.commit()
