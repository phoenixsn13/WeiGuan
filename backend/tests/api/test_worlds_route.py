from __future__ import annotations

import inspect
import re

from fastapi.testclient import TestClient

from weiguan.api import routes
from weiguan.api.app import create_app
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine
from weiguan.canonical import Platform
from weiguan.world.models import Launch, PersonaKind


NAKED_ID = re.compile(r"(?:[0-9a-f]{12,}|w_[0-9a-f]{6,})")


def _app(tmp_path):
    return create_app(FakeEngine(), store_path=tmp_path / "runs.json")


def _launch(world_id: str, *, launch_id: str, content: str, created_at: str) -> Launch:
    return Launch(
        launch_id=launch_id,
        world_id=world_id,
        content=content,
        steps=3,
        platforms=[Platform.TWITTER, Platform.REDDIT],
        run_ids=[f"{launch_id}:twitter", f"{launch_id}:reddit"],
        status="done",
        clock_tick=3,
        poster_person_id=None,
        poster_persona=PersonaKind.KOL,
        created_at=created_at,
    )


def _run_config(world_id: str, content: str) -> RunConfig:
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content=content,
        steps=2,
        platform=Platform.TWITTER,
        llm_key="sk",
        llm_model="m",
        world_id=world_id,
    )


def test_world_list_is_sync_route():  # review:P14-T2
    assert inspect.iscoroutinefunction(routes.world_list) is False


def test_world_list_returns_persistent_worlds_sorted_by_latest(tmp_path):  # review:P14-T2
    app = _app(tmp_path)
    world_store = app.state.world_store
    older = world_store.create_world(persistent=True)
    newer = world_store.create_world(persistent=True)
    hidden = world_store.create_world(persistent=False)

    world_store.create_person(
        newer.world_id,
        display_name="估值洁癖",
        persona_kind=PersonaKind.KOL,
        platform=Platform.TWITTER,
        handle="valuation",
    )
    world_store.create_person(
        older.world_id,
        display_name="硬核工程师",
        persona_kind=PersonaKind.ORDINARY,
        platform=Platform.REDDIT,
        handle="engineer",
    )
    world_store.create_launch(
        _launch(
            older.world_id,
            launch_id="l_old",
            content="旧世界里的第一条讨论内容",
            created_at="2026-07-05T08:00:00+00:00",
        )
    )
    world_store.create_launch(
        _launch(
            newer.world_id,
            launch_id="l_new",
            content="新的世界内容会排在更前面",
            created_at="2026-07-06T08:00:00+00:00",
        )
    )
    world_store.create_launch(
        _launch(
            hidden.world_id,
            launch_id="l_hidden",
            content="非持久世界不应该出现",
            created_at="2026-07-07T08:00:00+00:00",
        )
    )

    response = TestClient(app).get("/api/worlds")

    assert response.status_code == 200
    worlds = response.json()["worlds"]
    assert [item["world_id"] for item in worlds] == [newer.world_id, older.world_id]
    assert worlds[0]["name"] == "新的世界内容会排在更前面"[:12]
    assert worlds[0]["latest"]["run_ids"] == ["l_new:twitter", "l_new:reddit"]
    assert worlds[0]["latest"]["launch_id"] == "l_new"
    assert worlds[0]["identity_count"] == 1
    assert worlds[0]["primary_identity_person_id"]
    assert worlds[0]["primary_identity_name"] == "估值洁癖"
    assert worlds[0]["total_influence"] >= 50
    assert worlds[0]["platform_count"] == 2
    assert worlds[0]["run_count"] == 2
    assert not NAKED_ID.search(worlds[0]["name"])
    assert all(item["world_id"] != hidden.world_id for item in worlds)


def test_world_list_latest_comes_from_launch_not_run_store(tmp_path):  # review:P15-T2
    app = _app(tmp_path)
    world = app.state.world_store.create_world(persistent=True)
    app.state.world_store.create_launch(
        _launch(
            world.world_id,
            launch_id="launch_real",
            content="真实发起会话",
            created_at="2026-07-06T08:00:00+00:00",
        )
    )
    run_id = app.state.store.create(_run_config(world.world_id, "裸 run 不再进 latest"))
    record = app.state.store.get(run_id)
    assert record is not None
    record.status = "done"
    record.current_step = 2
    record.created_at = "2026-07-06T09:00:00+00:00"
    app.state.store.save()

    response = TestClient(app).get("/api/worlds")

    assert response.status_code == 200
    worlds = response.json()["worlds"]
    assert len(worlds) == 1
    assert worlds[0]["name"] == "真实发起会话"[:12]
    assert worlds[0]["latest"] == {
        "content": "真实发起会话",
        "created_at": "2026-07-06T08:00:00+00:00",
        "status": "done",
        "run_ids": ["launch_real:twitter", "launch_real:reddit"],
        "launch_id": "launch_real",
    }
    assert worlds[0]["platform_count"] == 2
    assert worlds[0]["run_count"] == 3
    assert not NAKED_ID.search(worlds[0]["name"])
