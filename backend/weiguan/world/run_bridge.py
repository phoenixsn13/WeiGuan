from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from weiguan.canonical import Platform, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.config import RunConfig

from .models import (
    Account,
    Person,
    PersonaKind,
    World,
    WorldEvent,
    WorldEventKind,
    persona_starting_standing,
)
from .store import WorldStore


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _event_id(run_id: str, step: int, label: str, item_id: object) -> str:
    return f"{run_id}:{step}:{label}:{item_id}"


def _account_id(world_id: str, platform: Platform, actor_id: int) -> str:
    return f"acct_{world_id}_{platform.value}_{actor_id}"


def poster_account_id(world_id: str, platform: Platform, person_id: str) -> str:
    return f"acct_{world_id}_{platform.value}_{person_id}"


def _poster_account(
    *,
    world_id: str,
    platform: Platform,
    person_id: str,
    followers: int,
    influence: float,
) -> Account:
    return Account(
        account_id=poster_account_id(world_id, platform, person_id),
        person_id=person_id,
        platform=platform,
        handle=person_id,
        avatar_seed=person_id,
        num_followers=followers,
        influence_score=influence,
    )


def ensure_world_for_run(store: WorldStore, config: RunConfig) -> tuple[World, Person]:
    """Create or reuse a world and ensure the posting person exists."""

    persistent = bool(config.world_id or config.poster_person_id)
    world = store.get_world(config.world_id) if config.world_id else None
    if world is None:
        world = store.create_world(persistent=persistent)
    elif persistent and not world.persistent:
        world = store.persist_world(world.world_id) or world

    person_id = config.poster_person_id or f"p_{uuid4().hex}"
    followers, influence = persona_starting_standing(config.poster_persona)
    existing = store.get_person(world.world_id, person_id)
    account = _poster_account(
        world_id=world.world_id,
        platform=config.platform,
        person_id=person_id,
        followers=followers,
        influence=influence,
    )
    if existing is None:
        person = Person(
            person_id=person_id,
            display_name="我" if config.poster_person_id is None else person_id,
            persona_kind=config.poster_persona,
            accounts=[account],
        )
    else:
        accounts = [item for item in existing.accounts if item.account_id != account.account_id]
        person = existing.model_copy(update={"accounts": [*accounts, account]})
    store.upsert_person(world.world_id, person)
    return world, person


def delta_to_events(  # review:P6-T6
    delta: RunDelta,
    *,
    world_id: str,
    run_id: str,
    platform: Platform,
    account_of: dict[int, str],
) -> list[WorldEvent]:
    """Convert one RunDelta snapshot into append-only world events."""

    snapshot: RunSnapshot = delta.snapshot
    events: list[WorldEvent] = []
    created_at = _now()

    for post in snapshot.posts:
        kind = (
            WorldEventKind.SEED
            if snapshot.seed_post_id is not None and post.post_id == snapshot.seed_post_id
            else WorldEventKind.POST
        )
        events.append(
            WorldEvent(
                event_id=_event_id(run_id, delta.step, kind.value, post.post_id),
                world_id=world_id,
                tick=delta.step,
                created_at=post.created_at or created_at,
                platform=platform,
                actor_account_id=account_of.get(post.author_id),
                kind=kind,
                payload=post.model_dump(mode="json"),
                run_id=run_id,
            )
        )

    for reply in snapshot.replies:
        events.append(
            WorldEvent(
                event_id=_event_id(run_id, delta.step, "reply", reply.comment_id),
                world_id=world_id,
                tick=delta.step,
                created_at=reply.created_at or created_at,
                platform=platform,
                actor_account_id=account_of.get(reply.author_id),
                kind=WorldEventKind.REPLY,
                payload=reply.model_dump(mode="json"),
                run_id=run_id,
            )
        )

    for reaction in snapshot.reactions:
        events.append(
            WorldEvent(
                event_id=_event_id(
                    run_id,
                    delta.step,
                    "reaction",
                    f"{reaction.actor_id}:{reaction.target_type}:{reaction.target_id}",
                ),
                world_id=world_id,
                tick=delta.step,
                created_at=reaction.created_at or created_at,
                platform=platform,
                actor_account_id=account_of.get(reaction.actor_id),
                kind=WorldEventKind.REACTION,
                payload=reaction.model_dump(mode="json"),
                run_id=run_id,
            )
        )

    for follow in snapshot.follows:
        events.append(
            WorldEvent(
                event_id=_event_id(
                    run_id,
                    delta.step,
                    "follow",
                    f"{follow.follower_id}:{follow.followee_id}",
                ),
                world_id=world_id,
                tick=delta.step,
                created_at=follow.created_at or created_at,
                platform=platform,
                actor_account_id=account_of.get(follow.follower_id),
                kind=WorldEventKind.FOLLOW,
                payload={
                    **follow.model_dump(mode="json"),
                    "target_account_id": account_of.get(follow.followee_id),
                },
                run_id=run_id,
            )
        )

    for report in snapshot.reports:
        events.append(
            WorldEvent(
                event_id=_event_id(run_id, delta.step, "report", report.post_id),
                world_id=world_id,
                tick=delta.step,
                created_at=report.created_at or created_at,
                platform=platform,
                actor_account_id=account_of.get(report.actor_id),
                kind=WorldEventKind.REPORT,
                payload=report.model_dump(mode="json"),
                run_id=run_id,
            )
        )

    return events


def ensure_account_for_actor(
    store: WorldStore,
    *,
    world_id: str,
    platform: Platform,
    actor_id: int,
    display_name: str,
) -> str:
    person_id = f"p_actor_{actor_id}"
    account_id = _account_id(world_id, platform, actor_id)
    store.upsert_person(
        world_id,
        Person(
            person_id=person_id,
            display_name=display_name,
            persona_kind=PersonaKind.ORDINARY,
            accounts=[
                Account(
                    account_id=account_id,
                    person_id=person_id,
                    platform=platform,
                    handle=display_name,
                    avatar_seed=str(actor_id),
                    num_followers=20,
                    influence_score=1.0,
                )
            ],
        ),
    )
    return account_id
