"""Account-owned Inspector entries, terminal output, and command history."""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, JsonValue
from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.history import HistoryEntry
from app.models.user import User
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])
Kind = Literal["inspector", "terminal", "commands"]
LIMITS = {"inspector": 200, "terminal": 500, "commands": 200}


class Entry(BaseModel):
    id: UUID
    payload: dict[str, JsonValue]


class Append(BaseModel):
    entries: list[Entry] = Field(min_length=1, max_length=500)


@router.get("")
def read_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = {kind: [] for kind in LIMITS}
    rows = db.scalars(select(HistoryEntry).where(
        HistoryEntry.user_id == user.id
    ).order_by(HistoryEntry.id))
    for row in rows:
        result[row.kind].append(row.payload)
    return result


@router.post("/{kind}", status_code=204)
def append_history(kind: Kind, data: Append,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Idempotent appends let a browser retry an interrupted save safely.
    db.execute(insert(HistoryEntry).values([
        dict(user_id=user.id, entry_id=str(entry.id), kind=kind, payload=entry.payload)
        for entry in data.entries
    ]).on_conflict_do_nothing(index_elements=["user_id", "entry_id"]))
    keep = select(HistoryEntry.id).where(
        HistoryEntry.user_id == user.id, HistoryEntry.kind == kind
    ).order_by(HistoryEntry.id.desc()).limit(LIMITS[kind])
    db.execute(delete(HistoryEntry).where(
        HistoryEntry.user_id == user.id, HistoryEntry.kind == kind,
        HistoryEntry.id.not_in(keep),
    ), execution_options={"synchronize_session": False})
    db.commit()


@router.delete("/{kind}", status_code=204)
def clear_history(kind: Kind, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    db.execute(delete(HistoryEntry).where(
        HistoryEntry.user_id == user.id, HistoryEntry.kind == kind
    ))
    db.commit()
