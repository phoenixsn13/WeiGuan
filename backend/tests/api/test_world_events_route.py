from datetime import datetime, timezone

import httpx

from weiguan.api.app import create_app
from weiguan.canonical import Platform
from weiguan.engine.fake import FakeEngine
from weiguan.world.models import WorldEvent, WorldEventKind


def _client(tmp_path):
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    return app, httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    )


def _event(world_id: str, event_id: str, tick: int, run_id: str = "r_1") -> WorldEvent:
    return WorldEvent(
        event_id=event_id,
        world_id=world_id,
        tick=tick,
        created_at=datetime.now(timezone.utc).isoformat(),
        platform=Platform.TWITTER,
        actor_account_id="acct_1",
        kind=WorldEventKind.REPLY,
        payload={"content": f"event {event_id}"},
        run_id=run_id,
    )


async def test_world_events_returns_timeline_frames(tmp_path):  # review:P11-T1-AC1
    app, client = _client(tmp_path)
    async with client:
        world = (await client.post("/api/worlds", json={"persistent": True})).json()
        app.state.world_store.set_clock_tick(world["world_id"], 7)
        app.state.world_store.append_event(_event(world["world_id"], "e_2", 2))
        app.state.world_store.append_event(_event(world["world_id"], "e_1", 1))

        response = await client.get(f"/api/worlds/{world['world_id']}/events")

    assert response.status_code == 200
    payload = response.json()
    frames = payload["frames"]
    assert [frame["event_id"] for frame in frames] == ["e_1", "e_2"]
    assert frames[0]["kind"] == "reply"
    assert frames[0]["platform"] == "twitter"
    assert payload["next_after"] == 2
    assert payload["clock_tick"] == 7
    assert payload["launch_status"] is None


async def test_world_events_returns_empty_frames_for_empty_world(tmp_path):  # review:P11-T1-AC2
    _, client = _client(tmp_path)
    async with client:
        world = (await client.post("/api/worlds", json={"persistent": True})).json()

        response = await client.get(f"/api/worlds/{world['world_id']}/events")

    assert response.status_code == 200
    assert response.json() == {
        "frames": [],
        "next_after": 0,
        "clock_tick": 0,
        "launch_status": None,
    }


async def test_world_events_can_filter_to_current_run_group(tmp_path):  # review:P11-T9-AC1
    app, client = _client(tmp_path)
    async with client:
        world = (await client.post("/api/worlds", json={"persistent": True})).json()
        world_id = world["world_id"]
        app.state.world_store.append_event(_event(world_id, "old", 1, run_id="old-twitter"))
        app.state.world_store.append_event(_event(world_id, "new-rd", 2, run_id="new-reddit"))
        app.state.world_store.append_event(_event(world_id, "new-tw", 1, run_id="new-twitter"))

        response = await client.get(
            f"/api/worlds/{world_id}/events",
            params=[("run_id", "new-twitter"), ("run_id", "new-reddit")],
        )

    assert response.status_code == 200
    assert [frame["event_id"] for frame in response.json()["frames"]] == ["new-tw", "new-rd"]


async def test_world_events_after_cursor_combines_with_run_filter(tmp_path):  # review:P12-T1-AC2
    app, client = _client(tmp_path)
    async with client:
        world = (await client.post("/api/worlds", json={"persistent": True})).json()
        world_id = world["world_id"]
        app.state.world_store.append_event(_event(world_id, "old", 1, run_id="old-twitter"))
        app.state.world_store.append_event(_event(world_id, "new-tw-1", 2, run_id="new-twitter"))
        app.state.world_store.append_event(_event(world_id, "new-rd", 4, run_id="new-reddit"))
        app.state.world_store.append_event(_event(world_id, "new-tw-2", 3, run_id="new-twitter"))
        app.state.world_store.append_event(_event(world_id, "ignored-late", 5, run_id="old-twitter"))

        response = await client.get(
            f"/api/worlds/{world_id}/events",
            params=[
                ("after", "2"),
                ("run_id", "new-twitter"),
                ("run_id", "new-reddit"),
            ],
        )

    assert response.status_code == 200
    payload = response.json()
    assert [frame["event_id"] for frame in payload["frames"]] == ["new-tw-2", "new-rd"]
    assert payload["next_after"] == 5
    assert payload["launch_status"] is None


async def test_world_events_unknown_world_returns_404(tmp_path):  # review:P11-T1-AC3
    _, client = _client(tmp_path)
    async with client:
        response = await client.get("/api/worlds/w_missing/events")

    assert response.status_code == 404
