from __future__ import annotations

from dataclasses import dataclass, field
from collections.abc import AsyncIterator, Callable
from time import perf_counter
from uuid import uuid4

from pydantic import BaseModel

from weiguan.canonical import Platform
from weiguan.engine.base import Engine, RunDelta
from weiguan.engine.config import RunConfig
from weiguan.obs.emit import MetricSink, NullSink, RunMetric, emit

from .bridge import select_bridgeable, to_bridge_events
from .models import WorldEvent
from .run_bridge import delta_to_events, ensure_account_for_actor
from .store import WorldStore


class PlatformRunSpec(BaseModel):  # review:P9-T2
    platform: Platform
    config: RunConfig
    poster_account_id: str


@dataclass
class _RunningPlatform:
    spec: PlatformRunSpec
    run_id: str
    account_of: dict[int, str] = field(default_factory=dict)


class WorldOrchestrator:  # review:P9-T2
    def __init__(
        self,
        store: WorldStore,
        engine_builder: Callable[[PlatformRunSpec], Engine],
        *,
        bridge_min_engagement: int = 3,
        metric_sink: MetricSink | None = None,
    ) -> None:
        self._store = store
        self._engine_builder = engine_builder
        self._bridge_min_engagement = bridge_min_engagement
        self._metric_sink = metric_sink or NullSink()

    async def orchestrate(
        self, world_id: str, specs: list[PlatformRunSpec]
    ) -> AsyncIterator[dict]:
        if self._store.get_world(world_id) is None:
            raise ValueError(f"unknown world: {world_id}")

        runs = [
            _RunningPlatform(
                spec=spec,
                run_id=f"{world_id}:{spec.platform.value}:{uuid4().hex}",
            )
            for spec in specs
        ]
        iterators = {
            run.run_id: self._engine_builder(run.spec).run(
                run.spec.config.model_copy(update={"platform": run.spec.platform})
            )
            for run in runs
        }
        active = {run.run_id for run in runs}
        tick = 0

        while active:
            tick += 1
            emitted_events: list[WorldEvent] = []
            for run in runs:
                if run.run_id not in active:
                    continue
                try:
                    started = perf_counter()
                    delta = await anext(iterators[run.run_id])
                except StopAsyncIteration:
                    active.remove(run.run_id)
                    continue

                shared_delta = RunDelta(step=tick, snapshot=delta.snapshot)
                self._map_seed_author(run, shared_delta)
                self._map_actors(world_id, run, shared_delta)
                events = delta_to_events(
                    shared_delta,
                    world_id=world_id,
                    run_id=run.run_id,
                    platform=run.spec.platform,
                    account_of=run.account_of,
                )
                for event in events:
                    self._store.append_event(event)
                emitted_events.extend(events)
                emit(
                    self._metric_sink,
                    RunMetric(
                        world_id=world_id,
                        run_id=run.run_id,
                        tick=tick,
                        platform=run.spec.platform.value,
                        wall_ms=(perf_counter() - started) * 1000,
                        active_accounts=len(shared_delta.snapshot.actors),
                        llm_calls=0,
                        snapshot_delta_size=self._snapshot_delta_size(shared_delta.snapshot),
                    ),
                )
                yield {
                    "tick": tick,
                    "platform": run.spec.platform.value,
                    "delta": shared_delta.model_dump(mode="json"),
                }

            if not emitted_events:
                break
            self._append_bridge_events(world_id, runs, emitted_events, tick + 1)
            self._store.set_clock_tick(world_id, tick)

    def _map_seed_author(self, run: _RunningPlatform, delta: RunDelta) -> None:
        if delta.snapshot.seed_post_id is None:
            return
        for post in delta.snapshot.posts:
            if post.post_id == delta.snapshot.seed_post_id:
                run.account_of[post.author_id] = run.spec.poster_account_id

    def _map_actors(self, world_id: str, run: _RunningPlatform, delta: RunDelta) -> None:
        for actor in delta.snapshot.actors:
            if actor.user_id in run.account_of:
                continue
            run.account_of[actor.user_id] = ensure_account_for_actor(
                self._store,
                world_id=world_id,
                platform=run.spec.platform,
                actor_id=actor.user_id,
                display_name=actor.name or actor.user_name or f"actor_{actor.user_id}",
            )

    def _append_bridge_events(
        self,
        world_id: str,
        runs: list[_RunningPlatform],
        emitted_events: list[WorldEvent],
        tick: int,
    ) -> None:
        for source in runs:
            candidates = select_bridgeable(
                [event for event in emitted_events if event.platform == source.spec.platform],
                min_engagement=self._bridge_min_engagement,
            )
            if not candidates:
                continue
            for target in runs:
                if target.spec.platform == source.spec.platform:
                    continue
                for event in to_bridge_events(
                    candidates,
                    target_platform=target.spec.platform,
                    target_account_id=target.spec.poster_account_id,
                    tick=tick,
                    world_id=world_id,
                    run_id=target.run_id,
                ):
                    self._store.append_event(event)

    def _snapshot_delta_size(self, snapshot) -> int:
        return sum(
            len(getattr(snapshot, field_name))
            for field_name in (
                "actors",
                "posts",
                "replies",
                "reactions",
                "follows",
                "reports",
                "traces",
            )
        )
