from __future__ import annotations

from datetime import datetime, timezone
from typing import AsyncIterator

from weiguan.api.runner import RunRunner
from weiguan.api.store import RunStore
from weiguan.canonical import Actor, Platform, Post, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.config import Audience, RunConfig
from weiguan.world.models import (
    Account,
    Person,
    PersonaKind,
    World,
    WorldEvent,
    WorldEventKind,
)
from weiguan.world.projector import fold_world, project_standing_timeline, project_stance
from weiguan.world.run_bridge import ensure_world_for_run, poster_account_id
from weiguan.world.store import WorldStore


def _created_at(tick: int) -> str:
    return datetime(2026, 7, 3, 9, tick, tzinfo=timezone.utc).isoformat()


def _event(
    event_id: str,
    *,
    account_id: str,
    platform: Platform,
    tick: int,
    content: str,
    run_id: str,
    kind: WorldEventKind = WorldEventKind.REPLY,
) -> WorldEvent:
    return WorldEvent(
        event_id=event_id,
        world_id="w_multi",
        tick=tick,
        created_at=_created_at(tick),
        platform=platform,
        actor_account_id=account_id,
        kind=kind,
        payload={"content": content},
        run_id=run_id,
    )


def _multi_person() -> Person:
    return Person(
        person_id="p_author",
        display_name="作者",
        persona_kind=PersonaKind.VERIFIED,
        accounts=[
            Account(
                account_id="acct_weibo",
                person_id="p_author",
                platform=Platform.TWITTER,
                handle="author_weibo",
                num_followers=10,
                influence_score=1.0,
            ),
            Account(
                account_id="acct_reddit",
                person_id="p_author",
                platform=Platform.REDDIT,
                handle="author_reddit",
                num_followers=20,
                influence_score=2.0,
            ),
        ],
    )


def test_multi_account_stance_aggregates_all_accounts():  # review:P9-T7
    events = [
        _event(
            "weibo-question",
            account_id="acct_weibo",
            platform=Platform.TWITTER,
            tick=1,
            content="这个说法有证据吗",
            run_id="run_weibo",
        ),
        _event(
            "reddit-analysis",
            account_id="acct_reddit",
            platform=Platform.REDDIT,
            tick=2,
            content="可能要结合行业数据分析",
            run_id="run_reddit",
        ),
    ]

    stance = project_stance(events, ["acct_weibo", "acct_reddit"])
    view = fold_world(World(world_id="w_multi", created_at=_created_at(0)), [_multi_person()], events)[
        "p_author"
    ]

    assert stance.stance_counts == {"question": 1, "analysis": 1}
    assert view.stance == stance


def test_multi_account_standing_timeline_sums_platform_accounts():  # review:P9-T7
    person = _multi_person()
    events = [
        _event(
            "weibo-seed",
            account_id="acct_weibo",
            platform=Platform.TWITTER,
            tick=1,
            content="这个产品应该有用",
            run_id="run_weibo",
            kind=WorldEventKind.SEED,
        ),
        _event(
            "reddit-reply",
            account_id="acct_reddit",
            platform=Platform.REDDIT,
            tick=2,
            content="这个说法有证据吗",
            run_id="run_reddit",
        ),
    ]

    timeline = project_standing_timeline(person, events, ["run_weibo", "run_reddit"])
    single_account = project_standing_timeline(
        Person(
            person_id=person.person_id,
            display_name=person.display_name,
            persona_kind=person.persona_kind,
            accounts=[person.accounts[0]],
        ),
        events,
        ["run_weibo", "run_reddit"],
    )

    assert timeline[0].influence == 5.0
    assert timeline[1].influence == 6.0
    assert timeline[1].stance_dominant == "neutral"
    assert timeline[1].stance_score == 0
    assert single_account[1].model_dump() != timeline[1].model_dump()


def test_single_account_projection_degenerates_to_existing_result():  # review:P9-T7
    events = [
        _event(
            "reply",
            account_id="acct_weibo",
            platform=Platform.TWITTER,
            tick=1,
            content="这个说法有证据吗",
            run_id="run_weibo",
        )
    ]

    assert project_stance(events, "acct_weibo").model_dump() == project_stance(
        events, ["acct_weibo"]
    ).model_dump()


def _cfg(**kw) -> RunConfig:
    base = dict(
        audience=Audience(crowd_id="tech_devs"),
        content="跨平台内容",
        steps=2,
        llm_key="sk",
        llm_model="m",
    )
    base.update(kw)
    return RunConfig(**base)


class SeedAuthorSevenEngine:
    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        yield RunDelta(
            step=1,
            snapshot=RunSnapshot(
                seed_post_id=70,
                platform=config.platform,
                actors=[Actor(user_id=7, name="真实作者")],
                posts=[Post(post_id=70, author_id=7, content=config.content)],
            ),
        )

    async def interview(
        self,
        config: RunConfig,
        snapshot: RunSnapshot,
        actor_id: int,
        question: str,
    ) -> str:
        return "ok"


async def test_runner_maps_seed_author_to_platform_poster_account(tmp_path):  # review:P9-T7
    world_store = WorldStore(str(tmp_path))
    world = world_store.create_world(persistent=True)
    run_store = RunStore()
    config = _cfg(world_id=world.world_id, poster_person_id="p_author")
    run_id = run_store.create(config)

    await RunRunner(run_store, SeedAuthorSevenEngine(), world_store=world_store)._run(run_id)

    frames = world_store.read_frames(run_id)
    seed = next(event for event in frames if event.kind == WorldEventKind.SEED)
    assert seed.actor_account_id == poster_account_id(world.world_id, Platform.TWITTER, "p_author")


def test_ensure_world_for_run_keeps_one_poster_account_per_platform(tmp_path):  # review:P9-T7
    store = WorldStore(str(tmp_path))
    world, first = ensure_world_for_run(
        store,
        _cfg(poster_person_id="p_author", platform=Platform.TWITTER),
    )

    _, second = ensure_world_for_run(
        store,
        _cfg(
            world_id=world.world_id,
            poster_person_id="p_author",
            platform=Platform.REDDIT,
        ),
    )

    assert {account.platform for account in first.accounts} == {Platform.TWITTER}
    assert {account.platform for account in second.accounts} == {
        Platform.TWITTER,
        Platform.REDDIT,
    }
