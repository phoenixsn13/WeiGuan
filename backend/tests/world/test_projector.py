from __future__ import annotations

from datetime import datetime, timezone

from weiguan.canonical.models import Actor, Platform, RunSnapshot
from weiguan.world.models import (
    Account,
    Person,
    PersonaKind,
    World,
    WorldEvent,
    WorldEventKind,
)
from weiguan.world.projector import (
    fold_world,
    project_bounded_memory,
    project_stance,
)


def _created_at(tick: int) -> str:
    return datetime(2026, 7, 2, 12, tick, tzinfo=timezone.utc).isoformat()


def _event(
    event_id: str,
    *,
    tick: int,
    account_id: str,
    kind: WorldEventKind = WorldEventKind.REPLY,
    payload: dict | None = None,
    run_id: str = "run_1",
) -> WorldEvent:
    return WorldEvent(
        event_id=event_id,
        world_id="w_test",
        tick=tick,
        created_at=_created_at(tick),
        platform=Platform.TWITTER,
        actor_account_id=account_id,
        kind=kind,
        payload=payload or {"content": "reply"},
        run_id=run_id,
    )


def _person(person_id: str, account_id: str) -> Person:
    return Person(
        person_id=person_id,
        display_name=person_id,
        persona_kind=PersonaKind.ORDINARY,
        accounts=[
            Account(
                account_id=account_id,
                person_id=person_id,
                platform=Platform.TWITTER,
                handle=person_id,
                num_followers=10,
                influence_score=1.0,
            )
        ],
    )


def test_project_stance_dominant():  # review:P6-T3-AC1
    events = [
        _event("e1", tick=1, account_id="acct_1", payload={"content": "有来源和证据吗"}),
        _event("e2", tick=2, account_id="acct_1", payload={"content": "链接发一下"}),
        _event("e3", tick=3, account_id="acct_2", payload={"content": "应该是真的"}),
    ]

    stance = project_stance(events, "acct_1")

    assert stance.dominant == "question"
    assert stance.stance_counts["question"] == 2


def test_bounded_memory_respects_budget():  # review:P6-T3-AC2
    events = [
        _event(f"e{index}", tick=index, account_id="acct_1", payload={"content": f"内容 {index}"})
        for index in range(10)
    ]

    memory = project_bounded_memory(events, "acct_1", budget=3)

    assert memory.recent_utterances == ["内容 7", "内容 8", "内容 9"]
    assert "立场" in memory.stance_line


def test_fold_is_deterministic():  # review:P6-T3-AC3
    world = World(world_id="w_test", created_at=_created_at(0))
    persons = [_person("p1", "acct_1"), _person("p2", "acct_2")]
    events = [
        _event("e2", tick=2, account_id="acct_2", payload={"content": "可能要分析"}),
        _event("e1", tick=1, account_id="acct_1", payload={"content": "证据呢"}),
    ]

    assert fold_world(world, persons, events) == fold_world(world, persons, events)


def test_fold_degenerate_equals_snapshot_actors():  # review:P6-T3-AC4
    snapshot = RunSnapshot(
        actors=[Actor(user_id=1), Actor(user_id=2)],
        platform=Platform.TWITTER,
    )
    persons = [_person("p1", "acct_1"), _person("p2", "acct_2")]
    events = [
        _event("seed", tick=1, account_id="acct_1", kind=WorldEventKind.SEED),
        _event("reply", tick=2, account_id="acct_2", kind=WorldEventKind.REPLY),
    ]

    views = fold_world(World(world_id="w_test", created_at=_created_at(0)), persons, events)

    actor_account_ids = {f"acct_{actor.user_id}" for actor in snapshot.actors}
    folded_account_ids = {
        account.account_id for view in views.values() for account in view.person.accounts
    }
    assert folded_account_ids == actor_account_ids


def test_influence_monotonic_on_followers():  # review:P6-T3-AC5
    world = World(world_id="w_test", created_at=_created_at(0))
    persons = [_person("p1", "acct_1")]
    before = fold_world(world, persons, [])["p1"].person.accounts[0]
    after = fold_world(
        world,
        persons,
        [
            _event(
                "follow",
                tick=1,
                account_id="acct_2",
                kind=WorldEventKind.FOLLOW,
                payload={"target_account_id": "acct_1"},
            )
        ],
    )["p1"].person.accounts[0]

    assert after.num_followers >= before.num_followers + 1
    assert after.influence_score >= before.influence_score
