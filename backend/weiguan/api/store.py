from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


class RunRecord(BaseModel):
    run_id: str
    config: RunConfig
    snapshot: RunSnapshot = Field(default_factory=RunSnapshot)
    status: str = "created"
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # review:P2-T4
    def accumulate(self, delta: RunSnapshot) -> None:
        if delta.seed_post_id is not None and self.snapshot.seed_post_id is None:
            self.snapshot.seed_post_id = delta.seed_post_id
        self.snapshot.platform = delta.platform
        for field in (
            "actors",
            "posts",
            "replies",
            "reactions",
            "follows",
            "reports",
            "traces",
        ):
            getattr(self.snapshot, field).extend(getattr(delta, field))


class RunStore:
    def __init__(self, path: str | Path | None = None) -> None:
        self._runs: dict[str, RunRecord] = {}
        self._path = Path(path) if path is not None else None
        self._load()

    def create(self, config: RunConfig) -> str:
        run_id = "r_" + secrets.token_hex(4)
        self._runs[run_id] = RunRecord(run_id=run_id, config=config)
        self.save()
        return run_id

    def get(self, run_id: str) -> RunRecord | None:
        return self._runs.get(run_id)

    def list(self) -> list[RunRecord]:
        return sorted(
            self._runs.values(),
            key=lambda record: record.created_at,
            reverse=True,
        )

    def save(self) -> None:
        if self._path is None:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        records = [self._public_record(record) for record in self._runs.values()]
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp.replace(self._path)

    def _load(self) -> None:
        if self._path is None or not self._path.exists():
            return
        data = json.loads(self._path.read_text(encoding="utf-8"))
        for item in data:
            record = RunRecord.model_validate(item)
            self._runs[record.run_id] = record

    def _public_record(self, record: RunRecord) -> dict:
        data = record.model_dump(mode="json")
        data["config"]["llm_key"] = "persisted-history"
        return data
