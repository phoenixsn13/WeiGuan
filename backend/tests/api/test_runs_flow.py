import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine

HDR = {"X-LLM-Key": "sk-x", "X-LLM-Model": "gpt-4o-mini"}


def _body(steps=6):
    return {
        "audience": {"crowd_id": "tech_devs"},
        "content": "构建砍到3秒",
        "steps": steps,
        "platform": "twitter",
    }


def _client():
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_app(FakeEngine())),
        base_url="http://test",
    )


async def test_create_run_returns_id():  # review:P2-T4-AC1
    async with _client() as client:
        r = await client.post("/api/runs", json=_body(), headers=HDR)
    assert r.status_code == 200 and r.json()["run_id"].startswith("r_")


async def test_create_run_rejects_bad_steps():  # review:P2-T4-AC2
    async with _client() as client:
        r = await client.post("/api/runs", json=_body(steps=3), headers=HDR)
    assert r.status_code == 400


async def test_create_run_requires_key():  # review:P2-T4-AC3
    async with _client() as client:
        r = await client.post("/api/runs", json=_body(), headers={})
    assert r.status_code == 401


async def test_sse_stream_order_and_accumulation():  # review:P2-T4-AC4
    async with _client() as client:
        run_id = (await client.post("/api/runs", json=_body(6), headers=HDR)).json()[
            "run_id"
        ]
        text = (await client.get(f"/api/runs/{run_id}/events")).text
    events = [
        ln[len("event: ") :] for ln in text.splitlines() if ln.startswith("event: ")
    ]
    assert events[0] == "run_started"
    assert events.count("step_started") == 6
    assert events[-1] == "run_done"
