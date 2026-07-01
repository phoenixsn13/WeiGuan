from __future__ import annotations

from typing import AsyncIterator, Protocol

from pydantic import BaseModel

from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


# review:P2-T3
class RunDelta(BaseModel):
    step: int
    snapshot: RunSnapshot


class Engine(Protocol):
    def run(self, config: RunConfig) -> AsyncIterator[RunDelta]: ...

    async def interview(
        self,
        config: RunConfig,
        snapshot: RunSnapshot,
        actor_id: int,
        question: str,
    ) -> str: ...
