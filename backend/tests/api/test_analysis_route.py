import httpx

from weiguan.api.app import create_app
from weiguan.canonical import Post, Reply, RunSnapshot
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine


async def test_analysis_route_returns_projection_for_stored_run(tmp_path):  # review:P8-T5
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    run_id = app.state.store.create(
        RunConfig(
            audience=Audience(crowd_id="tech_devs"),
            content="主帖",
            steps=6,
            llm_key="sk-test",
            llm_model="test",
        )
    )
    record = app.state.store.get(run_id)
    assert record is not None
    record.snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=10)],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=20, content="应该是真的", created_at="1")
        ],
    )
    app.state.store.save()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"/api/runs/{run_id}/analysis")

    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"diffusion", "opinion", "influence", "temporal"}
    assert data["temporal"]["fermentation_curve"][0]["volume"] == 1


async def test_analysis_route_matches_default_provider_output(tmp_path):  # review:P10-T1
    from weiguan.analysis.provider import default_analysis_provider

    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    run_id = app.state.store.create(
        RunConfig(
            audience=Audience(crowd_id="tech_devs"),
            content="主帖",
            steps=6,
            llm_key="sk-test",
            llm_model="test",
        )
    )
    record = app.state.store.get(run_id)
    assert record is not None
    record.snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=10)],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=20, content="应该是真的", created_at="1")
        ],
    )
    app.state.store.save()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"/api/runs/{run_id}/analysis")

    assert response.status_code == 200
    assert response.json() == default_analysis_provider().analyze(record.snapshot).model_dump(
        mode="json"
    )


async def test_analysis_route_returns_404_for_unknown_run(tmp_path):  # review:P8-T5
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/runs/r_missing/analysis")

    assert response.status_code == 404
