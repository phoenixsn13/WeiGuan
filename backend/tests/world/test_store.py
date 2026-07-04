from __future__ import annotations

from datetime import datetime, timezone

import weiguan.world.store as store_module
from weiguan.canonical.models import Platform
from weiguan.world.models import (
    Account,
    Person,
    PersonaKind,
    WorldEvent,
    WorldEventKind,
)
from weiguan.world.store import WorldStore


def _event(
    event_id: str,
    world_id: str,
    *,
    tick: int,
    account_id: str,
    kind: WorldEventKind = WorldEventKind.REPLY,
    payload: dict | None = None,
    run_id: str = "run_1",
) -> WorldEvent:
    return WorldEvent(
        event_id=event_id,
        world_id=world_id,
        tick=tick,
        created_at=datetime(2026, 7, 2, 12, tick, tzinfo=timezone.utc).isoformat(),
        platform=Platform.TWITTER,
        actor_account_id=account_id,
        kind=kind,
        payload=payload or {"content": "有证据吗"},
        run_id=run_id,
    )


def _person(person_id: str, account_id: str) -> Person:
    return Person(
        person_id=person_id,
        display_name="围观者",
        persona_kind=PersonaKind.ORDINARY,
        accounts=[
            Account(
                account_id=account_id,
                person_id=person_id,
                platform=Platform.TWITTER,
                handle="watcher",
                num_followers=20,
                influence_score=1.0,
            )
        ],
    )


def test_create_world_roundtrip(tmp_path):  # review:P6-T4-AC1
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)

    loaded = store.get_world(world.world_id)

    assert loaded == world
    assert loaded is not None
    assert loaded.persistent is True


def test_person_view_reflects_folded_events(tmp_path):  # review:P6-T4-AC2
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=False)
    person = _person("p1", "acct_1")
    store.upsert_person(world.world_id, person)
    store.append_event(
        _event(
            "follow",
            world.world_id,
            tick=1,
            account_id="acct_2",
            kind=WorldEventKind.FOLLOW,
            payload={"target_account_id": "acct_1"},
        )
    )
    store.append_event(_event("reply", world.world_id, tick=2, account_id="acct_1"))

    view = store.get_person_view(world.world_id, "p1")

    assert view is not None
    assert view.person.accounts[0].num_followers == 21
    assert view.stance.dominant == "question"


def test_read_frames_returns_run_events_sorted(tmp_path):  # review:P6-T4-AC3
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    store.append_event(_event("other", world.world_id, tick=1, account_id="acct_1", run_id="other"))
    store.append_event(_event("late", world.world_id, tick=3, account_id="acct_1", run_id="run_1"))
    store.append_event(_event("early", world.world_id, tick=2, account_id="acct_1", run_id="run_1"))

    frames = store.read_frames("run_1")

    assert [event.event_id for event in frames] == ["early", "late"]


def test_store_persists_across_instances(tmp_path):  # review:P6-T4-AC4
    first = WorldStore(str(tmp_path))
    world = first.create_world(persistent=True)
    first.upsert_person(world.world_id, _person("p1", "acct_1"))
    first.append_event(_event("reply", world.world_id, tick=1, account_id="acct_1"))

    second = WorldStore(str(tmp_path))

    assert second.get_world(world.world_id) == world
    assert second.get_person_view(world.world_id, "p1") is not None
    assert [event.event_id for event in second.read_frames("run_1")] == ["reply"]


def test_list_persons_reuses_projection_until_events_change(tmp_path, monkeypatch):  # review:P12-T2-AC1
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    store.upsert_person(world.world_id, _person("p1", "acct_1"))
    store.append_event(_event("reply", world.world_id, tick=1, account_id="acct_1"))
    calls = 0
    original_fold = store_module.fold_world

    def counting_fold(*args, **kwargs):
        nonlocal calls
        calls += 1
        return original_fold(*args, **kwargs)

    monkeypatch.setattr(store_module, "fold_world", counting_fold)

    first = store.list_persons(world.world_id)
    second = store.list_persons(world.world_id)
    store.append_event(_event("reply_2", world.world_id, tick=2, account_id="acct_1"))
    third = store.list_persons(world.world_id)

    assert calls == 2
    assert [view.model_dump(mode="json") for view in first] == [
        view.model_dump(mode="json") for view in second
    ]
    assert [view.run_ids for view in third] == [["run_1"]]


def test_list_identities_reuses_cached_projection_per_world(tmp_path, monkeypatch):  # review:P12-T2-AC2
    store = WorldStore(str(tmp_path))
    first_world = store.create_world(persistent=True)
    second_world = store.create_world(persistent=True)
    store.upsert_person(first_world.world_id, _person("p1", "acct_1"))
    store.upsert_person(second_world.world_id, _person("p2", "acct_2"))
    calls = 0
    original_fold = store_module.fold_world

    def counting_fold(*args, **kwargs):
        nonlocal calls
        calls += 1
        return original_fold(*args, **kwargs)

    monkeypatch.setattr(store_module, "fold_world", counting_fold)

    first = store.list_identities()
    second = store.list_identities()

    assert calls == 2
    assert [identity.model_dump(mode="json") for identity in first] == [
        identity.model_dump(mode="json") for identity in second
    ]
