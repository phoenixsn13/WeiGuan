from __future__ import annotations

from datetime import datetime, timezone

from weiguan.canonical import Platform
from weiguan.world.bridge import select_bridgeable, to_bridge_events
from weiguan.world.models import WorldEvent, WorldEventKind


def _event(
    event_id: str,
    *,
    kind: WorldEventKind = WorldEventKind.POST,
    platform: Platform = Platform.TWITTER,
    engagement: int = 0,
    post_id: int = 1,
) -> WorldEvent:
    return WorldEvent(
        event_id=event_id,
        world_id="w_bridge",
        tick=1,
        created_at=datetime(2026, 7, 3, 10, 0, tzinfo=timezone.utc).isoformat(),
        platform=platform,
        actor_account_id="acct_source",
        kind=kind,
        payload={
            "post_id": post_id,
            "content": f"内容 {post_id}",
            "engagement": engagement,
        },
        run_id="run_source",
    )


def test_select_bridgeable_keeps_high_engagement_posts_only():  # review:P9-T1
    high = _event("high", engagement=4)
    low = _event("low", engagement=2)
    reply = _event("reply", kind=WorldEventKind.REPLY, engagement=10)

    selected = select_bridgeable([low, reply, high], min_engagement=3)

    assert selected == [high]


def test_to_bridge_events_preserves_source_reference():  # review:P9-T1
    source = _event("high", engagement=5, post_id=42)

    bridged = to_bridge_events(
        [source],
        target_platform=Platform.REDDIT,
        target_account_id="acct_target",
        tick=2,
        world_id="w_bridge",
        run_id="run_target",
    )

    assert len(bridged) == 1
    event = bridged[0]
    assert event.kind == WorldEventKind.BRIDGE_INJECT
    assert event.platform == Platform.REDDIT
    assert event.actor_account_id == "acct_target"
    assert event.tick == 2
    assert event.run_id == "run_target"
    assert event.payload["source_platform"] == Platform.TWITTER.value
    assert event.payload["source_event_id"] == "high"
    assert event.payload["source_post_id"] == 42
    assert event.payload["content"] == "内容 42"


def test_to_bridge_events_empty_candidates_empty():  # review:P9-T1
    assert (
        to_bridge_events(
            [],
            target_platform=Platform.REDDIT,
            target_account_id="acct_target",
            tick=2,
            world_id="w_bridge",
            run_id="run_target",
        )
        == []
    )
