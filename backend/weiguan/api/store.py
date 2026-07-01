from __future__ import annotations

import secrets

from pydantic import BaseModel, Field

from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


class RunRecord(BaseModel):
    run_id: str
    config: RunConfig
    snapshot: RunSnapshot = Field(default_factory=RunSnapshot)

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
    def __init__(self) -> None:
        self._runs: dict[str, RunRecord] = {}

    def create(self, config: RunConfig) -> str:
        run_id = "r_" + secrets.token_hex(4)
        self._runs[run_id] = RunRecord(run_id=run_id, config=config)
        return run_id

    def get(self, run_id: str) -> RunRecord | None:
        return self._runs.get(run_id)
