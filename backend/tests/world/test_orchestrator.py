from __future__ import annotations

from typing import AsyncIterator

from weiguan.canonical import Actor, Platform, Post, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.config import Audience, RunConfig
from weiguan.world.models import WorldEventKind
from weiguan.world.orchestrator import PlatformRunSpec, WorldOrchestrator
from weiguan.world.store import WorldStore


def _cfg(platform: Platform, *, steps: int = 2) -> RunConfig:
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content=f"{platform.value} 内容",
        steps=steps,
        platform=platform,
        llm_key="sk",
        llm_model="m",
    )


class PlatformEngine:
    def __init__(self, platform: Platform, *, likes: int = 0) -> None:
        self.platform = platform
        self.likes = likes

    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        for step in range(1, config.steps + 1):
            yield RunDelta(
                step=step,
                snapshot=RunSnapshot(
                    platform=self.platform,
                    seed_post_id=step,
                    actors=[Actor(user_id=1, name=f"{self.platform.value}-作者")],
                    posts=[
                        Post(
                            post_id=step,
                            author_id=1,
                            content=f"{self.platform.value} 第 {step} 拍",
                            num_likes=self.likes if step == 1 else 0,
                        )
                    ],
                ),
            )

    async def interview(self, config, snapshot, actor_id, question) -> str:
        return "ok"


def _spec(platform: Platform, *, steps: int = 2, account: str | None = None) -> PlatformRunSpec:
    return PlatformRunSpec(
        platform=platform,
        config=_cfg(platform, steps=steps),
        poster_account_id=account or f"acct_{platform.value}",
    )


async def test_two_platforms_share_clock(tmp_path):  # review:P9-T2
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    orchestrator = WorldOrchestrator(
        store,
        lambda spec: PlatformEngine(spec.platform),
    )

    deltas = [delta async for delta in orchestrator.orchestrate(world.world_id, [_spec(Platform.TWITTER), _spec(Platform.REDDIT)])]
    events = store.read_world_events(world.world_id)

    assert [delta["tick"] for delta in deltas] == [1, 1, 2, 2]
    assert store.get_world(world.world_id).clock_tick == 2
    assert {event.platform for event in events} >= {Platform.TWITTER, Platform.REDDIT}


async def test_bridge_injects_next_tick(tmp_path):  # review:P9-T2
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    orchestrator = WorldOrchestrator(
        store,
        lambda spec: PlatformEngine(spec.platform, likes=5 if spec.platform == Platform.TWITTER else 0),
        bridge_min_engagement=3,
    )

    [delta async for delta in orchestrator.orchestrate(world.world_id, [_spec(Platform.TWITTER), _spec(Platform.REDDIT)])]

    bridge = [
        event
        for event in store.read_world_events(world.world_id)
        if event.kind == WorldEventKind.BRIDGE_INJECT
    ]
    assert len(bridge) == 1
    assert bridge[0].platform == Platform.REDDIT
    assert bridge[0].tick == 2
    assert bridge[0].payload["source_platform"] == Platform.TWITTER.value


async def test_concurrent_events_not_clobbered(tmp_path):  # review:P9-T2
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    orchestrator = WorldOrchestrator(
        store,
        lambda spec: PlatformEngine(spec.platform),
    )

    [delta async for delta in orchestrator.orchestrate(world.world_id, [_spec(Platform.TWITTER), _spec(Platform.REDDIT)])]

    events = [
        event
        for event in store.read_world_events(world.world_id)
        if event.kind == WorldEventKind.SEED
    ]
    assert len(events) == 4


async def test_single_platform_orchestrate_degenerates(tmp_path):  # review:P9-T2
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    orchestrator = WorldOrchestrator(
        store,
        lambda spec: PlatformEngine(spec.platform),
    )

    deltas = [delta async for delta in orchestrator.orchestrate(world.world_id, [_spec(Platform.TWITTER, steps=2)])]

    assert [delta["platform"] for delta in deltas] == [Platform.TWITTER.value, Platform.TWITTER.value]
    assert all(event.platform == Platform.TWITTER for event in store.read_world_events(world.world_id))
