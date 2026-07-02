import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine


async def test_identities_route_lists_persistent_identities(tmp_path):  # review:P7-T11-AC4
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        created = await client.post(
            "/api/persons",
            json={
                "display_name": "财经大号",
                "persona_kind": "kol",
                "platform": "twitter",
                "handle": "finance_kol",
            },
        )
        listed = await client.get("/api/identities")

    assert created.status_code == 200
    assert listed.status_code == 200
    identities = listed.json()["identities"]
    assert len(identities) == 1
    assert identities[0]["world_id"] == created.json()["world_id"]
    assert identities[0]["person_id"] == created.json()["person"]["person_id"]
    assert identities[0]["display_name"] == "财经大号"
