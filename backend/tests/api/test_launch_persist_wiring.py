from __future__ import annotations

import asyncio
import re

from fastapi.testclient import TestClient

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine


NAKED_ID = re.compile(r"[0-9a-f]{12,}")


def _client(tmp_path):
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    scheduled: list[object] = []
    app.state.runner._task_factory = lambda coro: scheduled.append(coro) or object()
    app.state.scheduled_run_tasks = scheduled
    app.state.scheduled_world_tasks = []
    app.state.world_task_factory = lambda coro: app.state.scheduled_world_tasks.append(coro)
    return app, TestClient(app)


def _drain(coros: list[object]) -> None:
    while coros:
        asyncio.run(coros.pop(0))


def _run_body(**kw):
    body = {
        "audience": {"crowd_id": "tech_devs"},
        "content": "新身份发起也应该进入世界列表",
        "steps": 2,
        "platform": "twitter",
    }
    body.update(kw)
    return body


def _multi_body(**kw):
    body = {
        "audience": {"crowd_id": "tech_devs"},
        "content": "多平台新建世界",
        "steps": 2,
        "platforms": ["twitter", "reddit"],
        "persona": "kol",
    }
    body.update(kw)
    return body


def test_single_run_persists_new_world_and_appears_in_world_list(tmp_path):  # review:P14-T3
    app, client = _client(tmp_path)

    response = client.post(
        "/api/runs",
        json=_run_body(world_name="单平台世界"),
        headers={"X-LLM-Key": "sk", "X-LLM-Model": "m"},
    )
    assert response.status_code == 200
    _drain(app.state.scheduled_run_tasks)
    run_id = response.json()["run_id"]
    record = app.state.store.get(run_id)
    assert record is not None
    world = app.state.world_store.get_world(record.config.world_id)

    assert world is not None
    assert world.persistent is True
    assert world.name == "单平台世界"
    worlds = client.get("/api/worlds").json()["worlds"]
    assert [item["world_id"] for item in worlds] == [world.world_id]
    assert worlds[0]["name"] == "单平台世界"


def test_multi_run_world_name_only_applies_when_creating_world(tmp_path):  # review:P14-T3
    app, client = _client(tmp_path)
    existing = app.state.world_store.create_world(persistent=True, name="已有世界")

    created = client.post(
        "/api/multi-runs",
        json=_multi_body(world_name="多平台测试世界"),
        headers={"X-LLM-Key": "sk", "X-LLM-Model": "m"},
    )
    reused = client.post(
        "/api/multi-runs",
        json=_multi_body(world_id=existing.world_id, world_name="不覆盖"),
        headers={"X-LLM-Key": "sk", "X-LLM-Model": "m"},
    )

    assert created.status_code == 200
    assert reused.status_code == 200
    assert (
        app.state.world_store.get_world(created.json()["world_id"]).name
        == "多平台测试世界"
    )
    assert app.state.world_store.get_world(existing.world_id).name == "已有世界"
    assert not NAKED_ID.search(
        app.state.world_store.list_persons(created.json()["world_id"])[0].person.display_name
    )

    for task in [*app.state.scheduled_world_tasks]:
        task.close()


def test_create_person_new_world_accepts_world_name(tmp_path):  # review:P14-T3
    app, client = _client(tmp_path)

    response = client.post(
        "/api/persons",
        json={
            "world_name": "身份起点世界",
            "display_name": "川普观察员",
            "persona_kind": "verified",
            "platform": "twitter",
            "handle": "trump-watch",
        },
    )

    assert response.status_code == 200
    world = app.state.world_store.get_world(response.json()["world_id"])
    assert world is not None
    assert world.persistent is True
    assert world.name == "身份起点世界"
