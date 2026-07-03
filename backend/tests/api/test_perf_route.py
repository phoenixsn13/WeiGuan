import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine
from weiguan.obs.emit import MemorySink, RunMetric


async def test_perf_route_returns_zero_digest_without_metrics(tmp_path):  # review:P10-T5
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/runs/r_missing/perf")

    assert response.status_code == 200
    data = response.json()
    assert data["total_ticks"] == 0
    assert data["hotspots"] == []


async def test_perf_route_filters_memory_sink_metrics_by_run(tmp_path):  # review:P10-T5
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    sink = MemorySink()
    sink.record(
        RunMetric(
            world_id="w1",
            run_id="r_target",
            tick=1,
            platform="twitter",
            wall_ms=10,
            active_accounts=2,
            llm_calls=1,
            snapshot_delta_size=3,
        )
    )
    sink.record(
        RunMetric(
            world_id="w1",
            run_id="r_other",
            tick=1,
            platform="twitter",
            wall_ms=99,
            active_accounts=9,
            llm_calls=9,
            snapshot_delta_size=9,
        )
    )
    app.state.metric_sink = sink

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/runs/r_target/perf")

    assert response.status_code == 200
    data = response.json()
    assert data["run_id"] == "r_target"
    assert data["total_ticks"] == 1
    assert data["total_llm_calls"] == 1
    assert data["snapshot_growth"] == 3
