import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine


HDR = {"X-LLM-Key": "sk-x", "X-LLM-Model": "gpt-4o-mini"}


def _body():
    return {
        "audience": {"crowd_id": "tech_devs"},
        "content": "只读单源",
        "steps": 6,
        "platform": "twitter",
    }


async def test_launches_single_source_no_run_synthesis():  # review:P15-T2
    app = create_app(FakeEngine())
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        body = (await client.post("/api/runs", json=_body(), headers=HDR)).json()
        launches = (await client.get("/api/launches")).json()["launches"]

    ids = {launch["launch_id"] for launch in launches}
    assert body["launch_id"] in ids
    assert body["run_id"] not in ids
