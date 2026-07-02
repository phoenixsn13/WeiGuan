import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine


HDR = {"X-LLM-Key": "sk-x", "X-LLM-Model": "gpt-4o-mini"}


def _body(**kw):
    base = {
        "audience": {"crowd_id": "tech_devs"},
        "content": "构建砍到3秒",
        "steps": 4,
        "platform": "twitter",
    }
    base.update(kw)
    return base


async def test_create_and_get_world(tmp_path):  # review:P6-T8-AC1
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        created = await client.post("/api/worlds", json={"persistent": True})
        loaded = await client.get(f"/api/worlds/{created.json()['world_id']}")

    assert created.status_code == 200
    assert loaded.status_code == 200
    assert loaded.json()["world_id"] == created.json()["world_id"]
    assert loaded.json()["persistent"] is True


async def test_unknown_world_and_person_return_404(tmp_path):  # review:P6-T8-AC2
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        missing_world = await client.get("/api/worlds/w_missing")
        missing_person = await client.get(
            "/api/persons/p_missing", params={"world_id": "w_missing"}
        )

    assert missing_world.status_code == 404
    assert missing_person.status_code == 404


async def test_run_frames_are_available_after_fake_run(tmp_path):  # review:P6-T8-AC3
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        run_id = (
            await client.post("/api/runs", json=_body(), headers=HDR)
        ).json()["run_id"]
        await client.get(f"/api/runs/{run_id}/events")
        response = await client.get(f"/api/runs/{run_id}/frames")

    assert response.status_code == 200
    frames = response.json()["frames"]
    assert frames
    assert [frame["tick"] for frame in frames] == sorted(frame["tick"] for frame in frames)
    assert frames[0]["kind"] == "seed"


async def test_create_run_passes_world_fields_and_degenerate_body_still_works(
    tmp_path,
):  # review:P6-T8-AC4
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        world = (await client.post("/api/worlds", json={"persistent": True})).json()
        with_world = await client.post(
            "/api/runs",
            json=_body(
                world_id=world["world_id"],
                poster_persona="kol",
                poster_person_id="p_author",
                person_memory_budget=2,
            ),
            headers=HDR,
        )
        degenerate = await client.post("/api/runs", json=_body(), headers=HDR)

    assert with_world.status_code == 200
    assert degenerate.status_code == 200
    record = app.state.store.get(with_world.json()["run_id"])
    assert record.config.world_id == world["world_id"]
    assert record.config.poster_persona == "kol"
    assert record.config.poster_person_id == "p_author"
    assert record.config.person_memory_budget == 2
