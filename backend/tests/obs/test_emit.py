from __future__ import annotations

from typing import AsyncIterator

from weiguan.canonical import Actor, Platform, Post, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.config import Audience, RunConfig
from weiguan.obs.emit import MemorySink, NullSink, RunMetric, emit
from weiguan.world.orchestrator import PlatformRunSpec, WorldOrchestrator
from weiguan.world.store import WorldStore


class OneStepEngine:
    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        yield RunDelta(
            step=1,
            snapshot=RunSnapshot(
                platform=config.platform,
                seed_post_id=1,
                actors=[Actor(user_id=1, name="作者")],
                posts=[Post(post_id=1, author_id=1, content=config.content)],
            ),
        )

    async def interview(self, config, snapshot, actor_id, question) -> str:
        return "ok"


class FailingSink:
    def record(self, metric: RunMetric) -> None:
        raise RuntimeError("collector unavailable")


def _spec(platform: Platform) -> PlatformRunSpec:
    return PlatformRunSpec(
        platform=platform,
        poster_account_id=f"acct_{platform.value}",
        config=RunConfig(
            audience=Audience(crowd_id="tech_devs"),
            content=f"{platform.value} 内容",
            steps=1,
            platform=platform,
            llm_key="sk",
            llm_model="m",
        ),
    )


async def test_orchestrator_emits_run_metrics_to_memory_sink(tmp_path):  # review:P10-T4
    sink = MemorySink()
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    orchestrator = WorldOrchestrator(store, lambda spec: OneStepEngine(), metric_sink=sink)

    deltas = [
        delta
        async for delta in orchestrator.orchestrate(
            world.world_id, [_spec(Platform.TWITTER), _spec(Platform.REDDIT)]
        )
    ]

    assert [delta["tick"] for delta in deltas] == [1, 1]
    assert len(sink.metrics) == 2
    assert [metric.tick for metric in sink.metrics] == [1, 1]
    assert {metric.platform for metric in sink.metrics} == {"twitter", "reddit"}
    assert all(metric.wall_ms >= 0 for metric in sink.metrics)
    assert all(metric.active_accounts == 1 for metric in sink.metrics)


async def test_null_sink_does_not_change_orchestrator_output(tmp_path):  # review:P10-T4
    specs = [_spec(Platform.TWITTER), _spec(Platform.REDDIT)]
    plain_store = WorldStore(str(tmp_path / "plain"))
    plain_world = plain_store.create_world(persistent=True)
    plain = WorldOrchestrator(plain_store, lambda spec: OneStepEngine())

    null_store = WorldStore(str(tmp_path / "null"))
    null_world = null_store.create_world(persistent=True)
    with_null = WorldOrchestrator(
        null_store, lambda spec: OneStepEngine(), metric_sink=NullSink()
    )

    plain_output = [
        delta async for delta in plain.orchestrate(plain_world.world_id, specs)
    ]
    null_output = [
        delta async for delta in with_null.orchestrate(null_world.world_id, specs)
    ]

    def normalize(items: list[dict]) -> list[tuple[int, str, dict]]:
        return [(item["tick"], item["platform"], item["delta"]) for item in items]

    assert normalize(null_output) == normalize(plain_output)


def test_emit_never_raises_from_sink_failure():  # review:P10-T4
    metric = RunMetric(
        world_id=None,
        run_id="r1",
        tick=1,
        platform="twitter",
        wall_ms=1.0,
        active_accounts=1,
        llm_calls=0,
        snapshot_delta_size=2,
    )

    emit(FailingSink(), metric)
