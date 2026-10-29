"""Account-owned Inspector entries, terminal output, and command history."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from aws_openconsole.database import get_db
from aws_openconsole.models.user import User
from aws_openconsole.schemas.history import (
    AppendHistory, Command, HistoryKind, InspectorEntry, TerminalLine,
)
from aws_openconsole.services import history_store
from aws_openconsole.utils.security import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])
PAYLOAD_MODELS = {"inspector": InspectorEntry, "terminal": TerminalLine, "commands": Command}


@router.get("")
def read_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return history_store.read_history(db, user.id)


@router.post("/{kind}", status_code=204)
def append_history(kind: HistoryKind, data: AppendHistory,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        for entry in data.entries:
            entry.payload = PAYLOAD_MODELS[kind].model_validate(entry.payload).model_dump(
                mode="json", exclude_unset=True,
            )
    except ValidationError:
        raise HTTPException(status_code=422, detail="Invalid history entry") from None
    history_store.append_history(db, user.id, kind, data.entries)


@router.delete("/{kind}", status_code=204)
def clear_history(kind: HistoryKind, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    history_store.clear_history(db, user.id, kind)
