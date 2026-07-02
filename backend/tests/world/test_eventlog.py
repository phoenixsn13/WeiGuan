from __future__ import annotations

from datetime import datetime, timezone

from weiguan.canonical.models import Platform
from weiguan.world.eventlog import EventLog
from weiguan.world.models import WorldEvent, WorldEventKind


def _event(event_id: str, tick: int, run_id: str) -> WorldEvent:
    return WorldEvent(
        event_id=event_id,
        world_id="w_test",
        tick=tick,
        created_at=datetime(2026, 7, 2, 12, tick, tzinfo=timezone.utc).isoformat(),
        platform=Platform.TWITTER,
        actor_account_id="acct_1",
        kind=WorldEventKind.REPLY,
        payload={"content": f"reply {event_id}"},
        run_id=run_id,
    )


def test_append_read_roundtrip_sorted(tmp_path):  # review:P6-T2-AC1
    log = EventLog(str(tmp_path / "events.jsonl"))
    log.append(_event("e3", 3, "r1"))
    log.append(_event("e1", 1, "r1"))
    log.append(_event("e2", 2, "r1"))

    events = log.read()

    assert [event.event_id for event in events] == ["e1", "e2", "e3"]


def test_concurrent_append_no_clobber(tmp_path):  # review:P6-T2-AC2
    log = EventLog(str(tmp_path / "events.jsonl"))
    for index in range(6):
        log.append(_event(f"a{index}", index, "run_a"))
        log.append(_event(f"b{index}", index, "run_b"))

    all_events = log.read()
    run_a_events = log.read(run_id="run_a")

    assert len(all_events) == 12
    assert {event.event_id for event in all_events} == {
        *(f"a{index}" for index in range(6)),
        *(f"b{index}" for index in range(6)),
    }
    assert [event.run_id for event in run_a_events] == ["run_a"] * 6


def test_append_is_line_atomic(tmp_path):  # review:P6-T2-AC3
    path = tmp_path / "events.jsonl"
    log = EventLog(str(path))
    for index in range(5):
        log.append(_event(f"e{index}", index, "r1"))

    assert len(path.read_text(encoding="utf-8").splitlines()) == 5
