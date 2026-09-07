from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, JsonValue

HistoryKind = Literal["inspector", "terminal", "commands"]


class InspectorEntry(BaseModel):
    id: UUID
    ts: int
    source: Literal["gui", "cli"]
    command: str
    status: Literal["ok", "error"]
    durationMs: int
    service: str | None = None
    operation: str | None = None
    params: dict[str, JsonValue] | None = None
    result: JsonValue = None
    error: dict[str, str] | None = None
    stdout: str | None = None
    stderr: str | None = None
    exitCode: int | None = None


class TerminalLine(BaseModel):
    kind: Literal["cmd", "out", "err", "info"]
    text: str


class Command(BaseModel):
    text: str


class Entry(BaseModel):
    id: UUID
    payload: dict[str, JsonValue]


class AppendHistory(BaseModel):
    entries: list[Entry] = Field(min_length=1, max_length=500)
