from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from weiguan.canonical import Platform

from .models import WorldEvent, WorldEventKind


def _engagement(payload: dict[str, Any]) -> int:
    explicit = payload.get("engagement")
    if isinstance(explicit, int | float):
        return int(explicit)
    return sum(
        int(value)
        for key in (
            "num_likes",
            "num_reposts",
            "num_shares",
            "num_comments",
            "reply_count",
            "repost_count",
        )
        for value in [payload.get(key)]
        if isinstance(value, int | float)
    )


def _content(payload: dict[str, Any]) -> str:
    for key in ("content", "text", "quote_content", "comment"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def select_bridgeable(  # review:P9-T1
    events: list[WorldEvent], *, min_engagement: int
) -> list[WorldEvent]:
    return [
        event
        for event in events
        if event.kind in {WorldEventKind.SEED, WorldEventKind.POST}
        and _engagement(event.payload) >= min_engagement
    ]


def to_bridge_events(  # review:P9-T1
    candidates: list[WorldEvent],
    *,
    target_platform: Platform,
    target_account_id: str,
    tick: int,
    world_id: str,
    run_id: str,
) -> list[WorldEvent]:
    created_at = datetime.now(timezone.utc).isoformat()
    bridged: list[WorldEvent] = []
    for index, source in enumerate(candidates):
        bridged.append(
            WorldEvent(
                event_id=(
                    f"{world_id}:{run_id}:{tick}:bridge:"
                    f"{target_platform.value}:{source.event_id}:{index}"
                ),
                world_id=world_id,
                tick=tick,
                created_at=created_at,
                platform=target_platform,
                actor_account_id=target_account_id,
                kind=WorldEventKind.BRIDGE_INJECT,
                payload={
                    "source_platform": source.platform.value,
                    "source_event_id": source.event_id,
                    "source_run_id": source.run_id,
                    "source_post_id": source.payload.get("post_id"),
                    "content": _content(source.payload),
                },
                run_id=run_id,
            )
        )
    return bridged
