from weiguan.canonical.models import Platform
from weiguan.world.models import PersonaKind, persona_starting_standing
from weiguan.world.store import WorldStore


def test_create_person_seeds_persona_starting_standing(tmp_path):  # review:P7-T1-AC1
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)

    person = store.create_person(
        world.world_id,
        display_name="财经大号",
        persona_kind=PersonaKind.KOL,
        platform=Platform.TWITTER,
        handle="finance_kol",
    )

    expected_followers, expected_influence = persona_starting_standing(PersonaKind.KOL)
    account = person.accounts[0]
    assert person.display_name == "财经大号"
    assert person.persona_kind == PersonaKind.KOL
    assert account.num_followers == expected_followers
    assert account.influence_score == expected_influence
    assert account.handle == "finance_kol"


def test_list_persons_returns_person_views(tmp_path):  # review:P7-T1-AC2
    store = WorldStore(str(tmp_path))
    world = store.create_world(persistent=True)
    person = store.create_person(
        world.world_id,
        display_name="普通观察者",
        persona_kind=PersonaKind.ORDINARY,
        platform=Platform.TWITTER,
        handle="ordinary",
    )

    views = store.list_persons(world.world_id)

    assert [view.person.person_id for view in views] == [person.person_id]
    assert views[0].total_influence == person.accounts[0].influence_score


def test_list_persons_unknown_world_returns_empty(tmp_path):  # review:P7-T1-AC3
    store = WorldStore(str(tmp_path))

    assert store.list_persons("w_missing") == []
