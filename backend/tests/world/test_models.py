from weiguan.canonical import Platform
from weiguan.world import (
    Account,
    Person,
    PersonaKind,
    WorldEvent,
    WorldEventKind,
    persona_starting_standing,
)


def test_persona_starting_standing_orders():  # review:P6-T1-AC1
    ordinary = persona_starting_standing(PersonaKind.ORDINARY)
    verified = persona_starting_standing(PersonaKind.VERIFIED)
    kol = persona_starting_standing(PersonaKind.KOL)

    assert kol[0] > verified[0] > ordinary[0] >= 0
    assert kol[1] > verified[1] > ordinary[1]


def test_world_event_defaults():  # review:P6-T1-AC2
    event = WorldEvent(
        event_id="evt_1",
        world_id="w_1",
        tick=1,
        created_at="2026-07-02T00:00:00Z",
        platform=Platform.TWITTER,
        kind=WorldEventKind.SEED,
    )

    assert event.payload == {}
    assert event.run_id is None


def test_person_account_nesting():  # review:P6-T1-AC3
    person = Person(
        person_id="p_1",
        display_name="围观用户",
        persona_kind=PersonaKind.VERIFIED,
        accounts=[
            Account(
                account_id="a_1",
                person_id="p_1",
                platform=Platform.TWITTER,
                handle="watcher",
                avatar_seed="seed",
                num_followers=2000,
                influence_score=10.0,
            )
        ],
    )

    assert Person.model_validate(person.model_dump()) == person
