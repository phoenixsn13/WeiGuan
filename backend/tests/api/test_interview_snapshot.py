import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine

HDR = {"X-LLM-Key": "sk-x", "X-LLM-Model": "m"}


def _client():
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_app(FakeEngine())),
        base_url="http://test",
    )


async def _mk(client: httpx.AsyncClient):
    body = {
        "audience": {"crowd_id": "t"},
        "content": "hi",
        "steps": 6,
        "platform": "twitter",
    }
    rid = (await client.post("/api/runs", json=body, headers=HDR)).json()["run_id"]
    await client.get(f"/api/runs/{rid}/events")
    return rid


async def test_snapshot_after_run():  # review:P2-T5-AC1
    async with _client() as client:
        rid = await _mk(client)
        snap = (await client.get(f"/api/runs/{rid}/snapshot")).json()
    assert snap["seed_post_id"] == 1
    assert any(p["post_id"] == 1 for p in snap["posts"])
    assert any(r["comment_id"] == 1 for r in snap["replies"])


async def test_snapshot_404():  # review:P2-T5-AC2
    async with _client() as client:
        r = await client.get("/api/runs/nope/snapshot")
    assert r.status_code == 404


async def test_interview_returns_answer():  # review:P2-T5-AC3
    async with _client() as client:
        rid = await _mk(client)
        r = await client.post(
            f"/api/runs/{rid}/interview",
            json={"actor_id": 2, "question": "为什么?"},
            headers=HDR,
        )
    assert r.status_code == 200
    assert r.json()["actor_id"] == 2 and r.json()["answer"]
