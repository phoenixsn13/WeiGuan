from __future__ import annotations

from collections.abc import AsyncIterator, Callable

from weiguan.canonical import RunSnapshot
from weiguan.engine.base import Engine, RunDelta
from weiguan.engine.config import RunConfig
from weiguan.engine.crowds import crowd_profile_path


# review:P4-T2
class RoutingEngine:
    def __init__(
        self,
        resolve_profile: Callable[[RunConfig], str],
        engine_builder: Callable[[str], Engine],
    ) -> None:
        self._resolve = resolve_profile
        self._build = engine_builder

    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        engine = self._build(self._resolve(config))
        async for delta in engine.run(config):
            yield delta

    async def interview(
        self,
        config: RunConfig,
        snapshot: RunSnapshot,
        actor_id: int,
        question: str,
    ) -> str:
        engine = self._build(self._resolve(config))
        return await engine.interview(config, snapshot, actor_id, question)


def make_resolver(
    workdir: str,
    custom_generator: Callable[[RunConfig, str], str],
) -> Callable[[RunConfig], str]:
    def resolve(config: RunConfig) -> str:
        if config.audience.crowd_id:
            return crowd_profile_path(config.audience.crowd_id)
        return custom_generator(config, workdir)

    return resolve
