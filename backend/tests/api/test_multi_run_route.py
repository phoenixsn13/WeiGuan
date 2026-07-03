from __future__ import annotations

import asyncio
from typing import AsyncIterator

from fastapi.testclient import TestClient

from weiguan.api.app import create_app
from weiguan.canonical import Actor, Platform, Post, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.fake import FakeEngine
from weiguan.world.models import WorldEventKind


class RoutePlatformEngine:
    def __init__(self, platform: Platform) -> None:
        self.platform = platform

    async def run(self, config) -> AsyncIterator[RunDelta]:
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
                            num_likes=5 if self.platform == Platform.TWITTER and step == 1 else 0,
                        )
                    ],
                ),
            )

    async def interview(self, config, snapshot, actor_id, question) -> str:
        return "ok"


def _client(tmp_path):
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    app.state.orchestrator_engine_builder = lambda spec: RoutePlatformEngine(spec.platform)
    app.state.scheduled_world_tasks = []
    app.state.world_task_factory = lambda coro: app.state.scheduled_world_tasks.append(coro)
    return app, TestClient(app)


def _drain_world_tasks(app) -> None:
    while app.state.scheduled_world_tasks:
        asyncio.run(app.state.scheduled_world_tasks.pop(0))


def _body(platforms: list[str]) -> dict:
    return {
        "content": "这条内容同时发到多个平台会怎样",
        "audience": {"crowd_id": "tech_devs"},
        "persona": "verified",
        "platforms": platforms,
        "steps": 2,
        "person_memory_budget": 4,
    }


def test_multi_run_creates_world_specs_accounts_and_bridge(tmp_path):  # review:P11-T2-AC1
    app, client = _client(tmp_path)

    response = client.post(
        "/api/multi-runs",
        json=_body(["twitter", "reddit"]),
        headers={"X-LLM-Key": "sk", "X-LLM-Model": "m"},
    )

    assert response.status_code == 200
    world_id = response.json()["world_id"]
    _drain_world_tasks(app)
    world = app.state.world_store.get_world(world_id)
    assert world is not None
    assert world.persistent is True

    events = app.state.world_store.read_world_events(world_id)
    assert {event.platform for event in events} >= {Platform.TWITTER, Platform.REDDIT}
    assert any(event.kind == WorldEventKind.BRIDGE_INJECT for event in events)

    poster_views = [
        view
        for view in app.state.world_store.list_persons(world_id)
        if view.person.persona_kind.value == "verified"
    ]
    assert len(poster_views) == 1
    assert {account.platform for account in poster_views[0].person.accounts} == {
        Platform.TWITTER,
        Platform.REDDIT,
    }


def test_multi_run_single_platform_degenerates_to_one_platform_world(tmp_path):  # review:P11-T2-AC2
    app, client = _client(tmp_path)

    response = client.post(
        "/api/multi-runs",
        json=_body(["twitter"]),
        headers={"X-LLM-Key": "sk", "X-LLM-Model": "m"},
    )

    assert response.status_code == 200
    _drain_world_tasks(app)
    events = app.state.world_store.read_world_events(response.json()["world_id"])
    assert {event.platform for event in events} == {Platform.TWITTER}


def test_multi_run_rejects_empty_platforms(tmp_path):  # review:P11-T2-AC3
    _, client = _client(tmp_path)

    response = client.post(
        "/api/multi-runs",
        json=_body([]),
        headers={"X-LLM-Key": "sk", "X-LLM-Model": "m"},
    )

    assert response.status_code in {400, 422}


def test_multi_run_returns_before_world_orchestration_finishes(tmp_path):  # review:P11-T7-AC1
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    scheduled: list[object] = []

    async def never_run(_config) -> AsyncIterator[RunDelta]:
        raise AssertionError("route must not await orchestration before responding")
        yield  # pragma: no cover

    class HangingEngine:
        async def run(self, config) -> AsyncIterator[RunDelta]:
            async for delta in never_run(config):
                yield delta

        async def interview(self, config, snapshot, actor_id, question) -> str:
            return "ok"

    app.state.orchestrator_engine_builder = lambda spec: HangingEngine()

    def schedule(coro):
        scheduled.append(coro)
        return object()

    app.state.world_task_factory = schedule
    client = TestClient(app)

    response = client.post(
        "/api/multi-runs",
        json=_body(["twitter", "reddit"]),
        headers={"X-LLM-Key": "sk", "X-LLM-Model": "m"},
    )

    assert response.status_code == 200
    assert response.json()["world_id"]
    assert len(scheduled) == 1
    assert app.state.world_store.read_world_events(response.json()["world_id"]) == []

    scheduled[0].close()
