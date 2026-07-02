import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine
from weiguan.world.models import PersonaKind, persona_starting_standing


def _client(tmp_path):
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    return app, httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    )


async def test_create_person_defaults_to_new_persistent_world(tmp_path):  # review:P7-T2-AC1
    app, client = _client(tmp_path)
    async with client:
        response = await client.post(
            "/api/persons",
            json={
                "display_name": "财经大号",
                "persona_kind": "kol",
                "platform": "twitter",
                "handle": "finance_kol",
            },
        )

    assert response.status_code == 200
    data = response.json()
    expected_followers, expected_influence = persona_starting_standing(PersonaKind.KOL)
    assert data["world_id"].startswith("w_")
    assert app.state.world_store.get_world(data["world_id"]).persistent is True
    assert data["person"]["accounts"][0]["num_followers"] == expected_followers
    assert data["person"]["accounts"][0]["influence_score"] == expected_influence


async def test_list_persons_for_world_returns_person_views(tmp_path):  # review:P7-T2-AC2
    _, client = _client(tmp_path)
    async with client:
        world = (await client.post("/api/worlds", json={"persistent": True})).json()
        created = await client.post(
            "/api/persons",
            json={
                "world_id": world["world_id"],
                "display_name": "普通人",
                "persona_kind": "ordinary",
                "platform": "twitter",
                "handle": "ordinary",
            },
        )
        listed = await client.get(f"/api/worlds/{world['world_id']}/persons")

    assert created.status_code == 200
    assert listed.status_code == 200
    assert listed.json()["persons"][0]["person"]["display_name"] == "普通人"


async def test_preview_cost_monotonic_and_budgeted(tmp_path):  # review:P7-T2-AC3
    _, client = _client(tmp_path)
    async with client:
        low = await client.get(
            "/api/runs/preview-cost",
            params={
                "steps": 4,
                "llm_max_agents": 8,
                "attention_comment_budget": 4,
                "person_memory_budget": 2,
            },
        )
        high = await client.get(
            "/api/runs/preview-cost",
            params={
                "steps": 20,
                "llm_max_agents": 8,
                "attention_comment_budget": 4,
                "person_memory_budget": 2,
            },
        )

    assert low.status_code == 200
    assert high.status_code == 200
    assert high.json()["estimated_rmb"] > low.json()["estimated_rmb"]
    assert high.json()["budgeted_agents"] <= 8
    assert high.json()["decision_steps"] == 19


async def test_create_person_rejects_invalid_persona(tmp_path):  # review:P7-T2-AC4
    _, client = _client(tmp_path)
    async with client:
        response = await client.post(
            "/api/persons",
            json={
                "display_name": "坏身份",
                "persona_kind": "not-a-persona",
                "platform": "twitter",
                "handle": "bad",
            },
        )

    assert response.status_code == 422
