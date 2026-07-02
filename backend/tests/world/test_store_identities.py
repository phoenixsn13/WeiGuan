from __future__ import annotations

from weiguan.canonical.models import Platform
from weiguan.world.store import WorldStore
from weiguan.world.models import PersonaKind


def _person(store: WorldStore, world_id: str, name: str, kind: PersonaKind):
    return store.create_person(
        world_id,
        display_name=name,
        persona_kind=kind,
        platform=Platform.TWITTER,
        handle=name,
    )


def test_list_identities_only_persistent(tmp_path):  # review:P7-T11-AC1
    store = WorldStore(str(tmp_path))
    persistent_a = store.create_world(persistent=True)
    persistent_b = store.create_world(persistent=True)
    ephemeral = store.create_world(persistent=False)
    person_a = _person(store, persistent_a.world_id, "财经大号", PersonaKind.KOL)
    person_b = _person(store, persistent_b.world_id, "普通观察者", PersonaKind.ORDINARY)
    _person(store, ephemeral.world_id, "临时路人", PersonaKind.VERIFIED)

    identities = store.list_identities()

    assert {(item.world_id, item.person_id) for item in identities} == {
        (persistent_a.world_id, person_a.person_id),
        (persistent_b.world_id, person_b.person_id),
    }
    assert {item.display_name for item in identities} == {"财经大号", "普通观察者"}


def test_list_identities_deterministic_order(tmp_path):  # review:P7-T11-AC2
    store = WorldStore(str(tmp_path))
    world_a = store.create_world(persistent=True)
    world_b = store.create_world(persistent=True)
    ordinary = _person(store, world_a.world_id, "普通观察者", PersonaKind.ORDINARY)
    kol = _person(store, world_b.world_id, "财经大号", PersonaKind.KOL)

    first = store.list_identities()
    second = store.list_identities()

    assert [item.person_id for item in first] == [item.person_id for item in second]
    assert [item.person_id for item in first] == [kol.person_id, ordinary.person_id]
    assert first[0].total_influence > first[1].total_influence
