from __future__ import annotations

from weiguan.api.runner import RunRunner
from weiguan.api.store import RunStore
from weiguan.canonical import (
    Actor,
    Platform,
    Reaction,
    ReactionKind,
    Reply,
    RunSnapshot,
    TargetType,
)
from weiguan.engine.base import RunDelta
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine
from weiguan.world.models import PersonaKind, WorldEventKind
from weiguan.world.run_bridge import delta_to_events, ensure_world_for_run
from weiguan.world.store import WorldStore


def _cfg(**kw) -> RunConfig:
    base = dict(
        audience=Audience(crowd_id="tech_devs"),
        content="构建砍到3秒",
        steps=3,
        llm_key="sk",
        llm_model="m",
    )
    base.update(kw)
    return RunConfig(**base)


def test_delta_to_events_maps_actions():  # review:P6-T6-AC1
    delta = RunDelta(
        step=2,
        snapshot=RunSnapshot(
            replies=[Reply(comment_id=1, post_id=1, author_id=2, content="有证据吗")],
            reactions=[
                Reaction(
                    kind=ReactionKind.LIKE,
                    actor_id=2,
                    target_type=TargetType.POST,
                    target_id=1,
                )
            ],
        ),
    )

    events = delta_to_events(
        delta,
        world_id="w_1",
        run_id="r_1",
        platform=Platform.TWITTER,
        account_of={2: "acct_2"},
    )

    assert [event.kind for event in events] == [
        WorldEventKind.REPLY,
        WorldEventKind.REACTION,
    ]
    assert {event.run_id for event in events} == {"r_1"}
    assert {event.world_id for event in events} == {"w_1"}


def test_ephemeral_world_when_no_world_id(tmp_path):  # review:P6-T6-AC2
    store = WorldStore(str(tmp_path))

    world, person = ensure_world_for_run(store, _cfg())

    assert world.persistent is False
    assert person.persona_kind == PersonaKind.ORDINARY
    assert person.accounts[0].num_followers >= 20
    assert store.get_world(world.world_id) == world


def test_ensure_world_persistent_when_person_id(tmp_path):  # review:P7-T11-AC3
    store = WorldStore(str(tmp_path))

    world, person = ensure_world_for_run(store, _cfg(poster_person_id="p_author"))

    assert world.persistent is True
    assert person.person_id == "p_author"
    assert store.get_world(world.world_id).persistent is True


async def test_reuse_persistent_world_accumulates(tmp_path):  # review:P6-T6-AC3
    world_store = WorldStore(str(tmp_path))
    world = world_store.create_world(persistent=True)
    run_store = RunStore()

    config = _cfg(world_id=world.world_id, poster_person_id="p_author")
    run_id_1 = run_store.create(config)
    run_id_2 = run_store.create(config)
    runner = RunRunner(run_store, FakeEngine(), world_store=world_store)

    await runner._run(run_id_1)
    first = world_store.get_person_view(world.world_id, "p_author")
    await runner._run(run_id_2)
    second = world_store.get_person_view(world.world_id, "p_author")

    assert first is not None and second is not None
    assert set(second.run_ids) == {run_id_1, run_id_2}
    assert second.total_influence >= first.total_influence


async def test_run_appends_frames(tmp_path):  # review:P6-T6-AC4
    world_store = WorldStore(str(tmp_path))
    run_store = RunStore()
    run_id = run_store.create(_cfg())
    runner = RunRunner(run_store, FakeEngine(), world_store=world_store)

    await runner._run(run_id)

    frames = world_store.read_frames(run_id)
    assert frames
    assert frames[0].kind == WorldEventKind.SEED


async def test_degenerate_run_unchanged(tmp_path):  # review:P6-T6-AC5
    config = _cfg(steps=4)
    expected = RunSnapshot()
    async for delta in FakeEngine().run(config):
        expected.accumulate(delta.snapshot) if hasattr(expected, "accumulate") else None
        if delta.snapshot.seed_post_id is not None and expected.seed_post_id is None:
            expected.seed_post_id = delta.snapshot.seed_post_id
        expected.platform = delta.snapshot.platform
        expected.actors.extend(delta.snapshot.actors)
        expected.posts.extend(delta.snapshot.posts)
        expected.replies.extend(delta.snapshot.replies)
        expected.reactions.extend(delta.snapshot.reactions)
        expected.follows.extend(delta.snapshot.follows)
        expected.reports.extend(delta.snapshot.reports)
        expected.traces.extend(delta.snapshot.traces)

    run_store = RunStore()
    run_id = run_store.create(config)
    await RunRunner(run_store, FakeEngine(), world_store=WorldStore(str(tmp_path)))._run(
        run_id
    )

    assert run_store.get(run_id).snapshot == expected
