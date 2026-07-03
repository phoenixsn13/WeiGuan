from __future__ import annotations

from collections import Counter
from collections.abc import Sequence

from weiguan.analysis.attention_context import classify_stance
from weiguan.analysis.stance import stance_polarity

from .models import (
    BoundedMemory,
    Account,
    Person,
    PersonView,
    StandingPoint,
    StanceState,
    World,
    WorldEvent,
    WorldEventKind,
)


def _event_sort_key(event: WorldEvent) -> tuple[int, str, str]:
    return (event.tick, event.created_at, event.event_id)


def _event_text(event: WorldEvent) -> str:
    for key in ("content", "text", "quote_content", "comment", "reason"):
        value = event.payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _account_id_set(account_ids: str | Sequence[str]) -> set[str]:
    if isinstance(account_ids, str):
        return {account_ids}
    return set(account_ids)


def project_stance(  # review:P6-T3  # review:P9-T7
    events: list[WorldEvent], account_ids: str | Sequence[str]
) -> StanceState:
    account_id_set = _account_id_set(account_ids)
    counts: Counter[str] = Counter()
    for event in sorted(events, key=_event_sort_key):
        if event.actor_account_id not in account_id_set:
            continue
        text = _event_text(event)
        if text:
            counts[classify_stance(text)] += 1

    if not counts:
        return StanceState()
    dominant = sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
    return StanceState(stance_counts=dict(counts), dominant=dominant)


def project_bounded_memory(
    events: list[WorldEvent], account_ids: str | Sequence[str], budget: int
) -> BoundedMemory:
    if budget < 1:
        raise ValueError("budget must be >= 1")

    account_id_set = _account_id_set(account_ids)
    utterances = [
        text
        for event in sorted(events, key=_event_sort_key)
        if event.actor_account_id in account_id_set
        for text in [_event_text(event)]
        if text
    ]
    stance = project_stance(events, account_ids)
    return BoundedMemory(
        stance_line=f"立场:{stance.dominant}",
        recent_utterances=utterances[-budget:],
    )


def _target_account_id(event: WorldEvent) -> str | None:
    value = event.payload.get("target_account_id") or event.payload.get("followee_account_id")
    return str(value) if value is not None else None


def _stance_score(events: list[WorldEvent], account_ids: list[str]) -> tuple[str, int]:
    account_id_set = set(account_ids)
    positive = 0
    negative = 0
    for event in sorted(events, key=_event_sort_key):
        if event.actor_account_id not in account_id_set:
            continue
        text = _event_text(event)
        if not text:
            continue
        stance = classify_stance(text)
        polarity = stance_polarity(stance)
        if polarity < 0:
            negative += 1
        elif polarity > 0:
            positive += 1

    score = positive - negative
    if score > 0:
        return ("positive", score)
    if score < 0:
        return ("negative", score)
    if positive or negative:
        return ("neutral", score)
    return ("other", 0)


def _fold_people(
    persons: list[Person], events: list[WorldEvent]
) -> tuple[dict[str, Person], dict[str, list[str]]]:
    ordered_events = sorted(events, key=_event_sort_key)
    account_to_person = {
        account.account_id: person.person_id
        for person in persons
        for account in person.accounts
    }
    working_people = {
        person.person_id: person.model_copy(deep=True)
        for person in sorted(persons, key=lambda item: item.person_id)
    }
    account_lookup: dict[str, Account] = {
        account.account_id: account
        for person in working_people.values()
        for account in person.accounts
    }
    run_ids_by_person: dict[str, list[str]] = {person.person_id: [] for person in persons}

    def remember_run(account_id: str | None, run_id: str | None) -> None:
        if not account_id or not run_id:
            return
        person_id = account_to_person.get(account_id)
        if not person_id:
            return
        if run_id not in run_ids_by_person[person_id]:
            run_ids_by_person[person_id].append(run_id)

    for event in ordered_events:
        remember_run(event.actor_account_id, event.run_id)
        actor_account = account_lookup.get(event.actor_account_id or "")
        if actor_account and event.kind in {
            WorldEventKind.SEED,
            WorldEventKind.POST,
            WorldEventKind.REPLY,
            WorldEventKind.REACTION,
        }:
            actor_account.influence_score += {
                WorldEventKind.SEED: 2.0,
                WorldEventKind.POST: 1.5,
                WorldEventKind.REPLY: 1.0,
                WorldEventKind.REACTION: 0.25,
            }[event.kind]

        if event.kind == WorldEventKind.FOLLOW:
            target_id = _target_account_id(event)
            target_account = account_lookup.get(target_id or "")
            if target_account:
                target_account.num_followers += 1
                target_account.influence_score += 0.5
                remember_run(target_id, event.run_id)

    return working_people, run_ids_by_person


def project_standing_timeline(  # review:P7-T9
    person: Person, events: list[WorldEvent], run_order: list[str]
) -> list[StandingPoint]:
    timeline: list[StandingPoint] = []
    if not person.accounts:
        return timeline

    account_ids = [account.account_id for account in person.accounts]
    for index, run_id in enumerate(run_order):
        prefix_run_ids = set(run_order[: index + 1])
        prefix_events = [event for event in events if event.run_id in prefix_run_ids]
        folded_people, _ = _fold_people([person], prefix_events)
        folded_person = folded_people.get(person.person_id, person)
        influence = sum(account.influence_score for account in folded_person.accounts)
        followers = sum(account.num_followers for account in folded_person.accounts)
        stance_dominant, stance_score = _stance_score(prefix_events, account_ids)
        timeline.append(
            StandingPoint(
                run_id=run_id,
                influence=influence,
                followers=followers,
                stance_dominant=stance_dominant,
                stance_score=stance_score,
            )
        )

    return timeline


def fold_world(
    world: World, persons: list[Person], events: list[WorldEvent]
) -> dict[str, PersonView]:
    del world
    ordered_events = sorted(events, key=_event_sort_key)
    working_people, run_ids_by_person = _fold_people(persons, ordered_events)
    source_people = {person.person_id: person for person in persons}

    return {
        person_id: PersonView(
            person=person,
            stance=project_stance(
                ordered_events, [account.account_id for account in person.accounts]
            )
            if person.accounts
            else StanceState(),
            total_influence=sum(account.influence_score for account in person.accounts),
            run_ids=run_ids_by_person.get(person_id, []),
            standing_timeline=project_standing_timeline(
                source_people.get(person_id, person),
                ordered_events,
                run_ids_by_person.get(person_id, []),
            ),
        )
        for person_id, person in working_people.items()
    }
