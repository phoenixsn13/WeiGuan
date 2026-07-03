from __future__ import annotations

from typing import AsyncIterator

from fastapi.testclient import TestClient

from weiguan.api.app import create_app
from weiguan.canonical import Actor, Platform, Post, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.fake import FakeEngine


class RoutePlatformEngine:
    def __init__(self, platform: Platform, *, likes: int = 0) -> None:
        self.platform = platform
        self.likes = likes

    async def run(self, config) -> AsyncIterator[RunDelta]:
        for step in range(1, config.steps + 1):
            yield RunDelta(
                step=step,
                snapshot=RunSnapshot(
                    platform=self.platform,
                    seed_post_id=step,
                    actors=[Actor(user_id=1, name=f"{self.platform.value}-作者")],
                    posts=[
                        Post(
                            post_id=step,
                            author_id=1,
                            content=f"{self.platform.value} 内容",
                            num_likes=self.likes if step == 1 else 0,
                        )
                    ],
                ),
            )

    async def interview(self, config, snapshot, actor_id, question) -> str:
        return "ok"


def _spec(platform: str, *, account: str | None = None) -> dict:
    return {
        "platform": platform,
        "poster_account_id": account or f"acct_{platform}",
        "config": {
            "audience": {"crowd_id": "tech_devs"},
            "content": f"{platform} 内容",
            "steps": 2,
            "platform": platform,
            "llm_key": "sk",
            "llm_model": "m",
        },
    }


def test_orchestrate_route_records_two_platform_events(tmp_path):  # review:P9-T3
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    app.state.orchestrator_engine_builder = lambda spec: RoutePlatformEngine(
        spec.platform, likes=5 if spec.platform == Platform.TWITTER else 0
    )
    client = TestClient(app)
    world_id = client.post("/api/worlds", json={"persistent": True}).json()["world_id"]

    response = client.post(
        f"/api/worlds/{world_id}/orchestrate",
        json={"specs": [_spec("twitter"), _spec("reddit")]},
    )

    assert response.status_code == 200
    data = response.json()
    assert {item["platform"] for item in data["events"]} >= {"twitter", "reddit"}
    assert any(item["kind"] == "bridge_inject" for item in data["frames"])


def test_orchestrate_route_unknown_world_404(tmp_path):  # review:P9-T3
    client = TestClient(create_app(FakeEngine(), store_path=tmp_path / "runs.json"))

    response = client.post(
        "/api/worlds/missing/orchestrate",
        json={"specs": [_spec("twitter")]},
    )

    assert response.status_code == 404


def test_orchestrate_route_single_platform_degenerates(tmp_path):  # review:P9-T3
    app = create_app(FakeEngine(), store_path=tmp_path / "runs.json")
    app.state.orchestrator_engine_builder = lambda spec: RoutePlatformEngine(spec.platform)
    client = TestClient(app)
    world_id = client.post("/api/worlds", json={"persistent": True}).json()["world_id"]

    response = client.post(
        f"/api/worlds/{world_id}/orchestrate",
        json={"specs": [_spec("twitter")]},
    )

    assert response.status_code == 200
    data = response.json()
    assert [item["platform"] for item in data["events"]] == ["twitter", "twitter"]
    assert {item["platform"] for item in data["frames"]} == {"twitter"}
