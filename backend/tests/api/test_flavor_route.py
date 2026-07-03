import httpx

from weiguan.api.app import create_app
from weiguan.canonical import Platform, Post, Reply, RunSnapshot
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine


def _config(world_id: str | None = None, platform: Platform = Platform.TWITTER) -> RunConfig:
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="主帖",
        steps=6,
        platform=platform,
        world_id=world_id,
        llm_key="sk-test",
        llm_model="test",
    )


def _snapshot(platform: Platform, text: str) -> RunSnapshot:
    return RunSnapshot(
        platform=platform,
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=10, content=text, created_at="0")],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=20, content="应该是真的", created_at="1")
        ],
    )


async def test_flavor_route_returns_digest_for_stored_run(tmp_path):  # review:P10-T3
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    run_id = app.state.store.create(_config())
    record = app.state.store.get(run_id)
    assert record is not None
    record.snapshot = _snapshot(Platform.TWITTER, "微博主帖")
    app.state.store.save()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"/api/runs/{run_id}/flavor")

    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"world_id", "run_ids", "platforms", "cross_platform_notes"}
    assert data["run_ids"] == [run_id]
    assert data["platforms"][0]["platform"] == "twitter"


async def test_flavor_route_returns_404_for_unknown_run(tmp_path):  # review:P10-T3
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/runs/r_missing/flavor")

    assert response.status_code == 404


async def test_flavor_route_world_id_aggregates_world_runs(tmp_path):  # review:P10-T3
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    world_id = "w_eval"
    twitter_id = app.state.store.create(_config(world_id, Platform.TWITTER))
    reddit_id = app.state.store.create(_config(world_id, Platform.REDDIT))
    other_id = app.state.store.create(_config("w_other", Platform.TWITTER))
    app.state.store.get(twitter_id).snapshot = _snapshot(Platform.TWITTER, "微博主帖")  # type: ignore[union-attr]
    app.state.store.get(reddit_id).snapshot = _snapshot(Platform.REDDIT, "Reddit 主帖")  # type: ignore[union-attr]
    app.state.store.get(other_id).snapshot = _snapshot(Platform.TWITTER, "其他世界")  # type: ignore[union-attr]
    app.state.store.save()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"/api/runs/{twitter_id}/flavor", params={"world_id": world_id})

    assert response.status_code == 200
    data = response.json()
    assert data["world_id"] == world_id
    assert data["run_ids"] == [reddit_id, twitter_id]
    assert {item["platform"] for item in data["platforms"]} == {"twitter", "reddit"}
