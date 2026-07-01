import os

import pytest

from weiguan.analysis.retro import (
    compute_metrics,
    seed_engaged_actor_ids,
    seed_interaction_count,
)
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.oasis_engine import OasisEngine
from tests.llm_config import llm_kwargs

PROFILE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "fixtures",
    "tiny_twitter_profile.csv",
)
SMALL_PROFILE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "fixtures",
    "small_twitter_profile.csv",
)


def _cfg():
    return RunConfig(
        audience=Audience(custom="tech crowd"),
        content="We cut build time to 3 seconds.",
        steps=6,
        **llm_kwargs(),
    )


@pytest.mark.llm
async def test_real_run_produces_llm_content(tmp_path):  # review:P2-T6-AC1
    eng = OasisEngine(profile_path=PROFILE, db_dir=str(tmp_path))
    deltas = [d async for d in eng.run(_cfg())]
    assert deltas[0].snapshot.posts[0].content.startswith("We cut build")
    snap = eng.last_snapshot
    assert compute_metrics(snap).totals["replies"] >= 1
    assert seed_interaction_count(snap) >= 2
    assert any(seed_interaction_count(delta.snapshot) > 0 for delta in deltas[1:])


@pytest.mark.llm
async def test_real_interview_returns_nonempty(tmp_path):  # review:P2-T6-AC2
    eng = OasisEngine(profile_path=PROFILE, db_dir=str(tmp_path))
    cfg = _cfg()
    [d async for d in eng.run(cfg)]
    ans = await eng.interview(
        cfg,
        eng.last_snapshot,
        actor_id=1,
        question="Why do you doubt it?",
    )
    assert isinstance(ans, str) and ans.strip()


@pytest.mark.llm_effect
async def test_real_run_effect(tmp_path):  # review:P2-T8-AC1
    eng = OasisEngine(profile_path=SMALL_PROFILE, db_dir=str(tmp_path))
    deltas = [d async for d in eng.run(_cfg())]
    snap = eng.last_snapshot
    metrics = compute_metrics(snap)
    engaged = seed_engaged_actor_ids(snap)
    crowd_size = max(1, len([actor for actor in snap.actors if actor.user_id != 0]))
    engagement_rate = len(engaged) / crowd_size
    seed = snap.seed_post_id
    independent_only = {
        post.author_id
        for post in snap.posts
        if post.author_id != 0 and post.original_post_id != seed
    } - engaged
    assert engagement_rate >= 0.4
    assert metrics.totals["replies"] >= 3
    assert len(independent_only) / crowd_size <= 0.5
    assert any(seed_interaction_count(delta.snapshot) > 0 for delta in deltas[1:])
