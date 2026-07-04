from __future__ import annotations

import httpx

from weiguan.api.app import create_app
from weiguan.canonical import (
    Actor,
    Follow,
    Platform,
    Post,
    Reaction,
    ReactionKind,
    Reply,
    Report,
    RunSnapshot,
    TargetType,
    TraceEvent,
)
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine


def _app_with_snapshot(snapshot: RunSnapshot):
    app = create_app(FakeEngine())
    run_id = app.state.store.create(
        RunConfig(
            audience=Audience(crowd_id="tech_devs"),
            content="窗口测试",
            steps=6,
            llm_key="sk",
            llm_model="m",
            platform=Platform.TWITTER,
        )
    )
    app.state.store.get(run_id).snapshot = snapshot
    return app, run_id


def _snapshot() -> RunSnapshot:
    return RunSnapshot(
        seed_post_id=1,
        actors=[Actor(user_id=item, name=f"用户{item}") for item in range(1, 7)],
        posts=[
            Post(post_id=1, author_id=1, content="seed"),
            Post(post_id=2, author_id=2, content="post 2"),
            Post(post_id=3, author_id=3, content="post 3"),
            Post(post_id=4, author_id=4, content="post 4"),
        ],
        replies=[
            Reply(comment_id=item, post_id=1, author_id=item, content=f"reply {item}")
            for item in range(1, 6)
        ],
        reactions=[
            Reaction(
                kind=ReactionKind.LIKE,
                actor_id=item,
                target_type=TargetType.POST,
                target_id=1,
            )
            for item in range(1, 6)
        ],
        follows=[
            Follow(follower_id=1, followee_id=2),
            Follow(follower_id=3, followee_id=4),
            Follow(follower_id=5, followee_id=6),
        ],
        reports=[Report(actor_id=2, post_id=1), Report(actor_id=6, post_id=1)],
        traces=[
            TraceEvent(actor_id=1, action="observe"),
            TraceEvent(actor_id=5, action="observe"),
        ],
    )


async def test_snapshot_without_window_is_byte_compatible():  # review:P12-T7
    snapshot = _snapshot()
    app, run_id = _app_with_snapshot(snapshot)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"/api/runs/{run_id}/snapshot")

    assert response.status_code == 200
    assert response.json() == snapshot.model_dump(mode="json")


async def test_snapshot_tail_returns_bounded_window():  # review:P12-T7
    app, run_id = _app_with_snapshot(_snapshot())

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"/api/runs/{run_id}/snapshot", params={"tail": 2})

    assert response.status_code == 200
    payload = response.json()
    assert [post["post_id"] for post in payload["posts"]] == [1, 3, 4]
    assert [reply["comment_id"] for reply in payload["replies"]] == [4, 5]
    assert len(payload["reactions"]) == 2
    assert len(payload["follows"]) == 2
    assert len(payload["reports"]) == 2
    assert len(payload["traces"]) == 2
    assert payload["window"] == {
        "tail": 2,
        "totals": {
            "posts": 4,
            "replies": 5,
            "reactions": 5,
            "follows": 3,
            "reports": 2,
            "traces": 2,
        },
    }


async def test_snapshot_reply_page_uses_tail_offset():  # review:P12-T7
    app, run_id = _app_with_snapshot(_snapshot())

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"/api/runs/{run_id}/snapshot",
            params={"replies_offset": 2, "replies_limit": 2},
        )

    assert response.status_code == 200
    payload = response.json()
    assert [reply["comment_id"] for reply in payload["replies"]] == [2, 3]
    assert [post["post_id"] for post in payload["posts"]] == [1]
    assert payload["window"]["replies_offset"] == 2
    assert payload["window"]["replies_limit"] == 2
    assert payload["window"]["totals"]["replies"] == 5


async def test_snapshot_rejects_tail_and_reply_page_together():  # review:P12-T7
    app, run_id = _app_with_snapshot(_snapshot())

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"/api/runs/{run_id}/snapshot",
            params={"tail": 2, "replies_offset": 0, "replies_limit": 2},
        )

    assert response.status_code == 400
