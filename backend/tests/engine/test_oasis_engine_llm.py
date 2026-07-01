import os

import pytest

from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.oasis_engine import OasisEngine

pytestmark = pytest.mark.llm
PROFILE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "fixtures",
    "tiny_twitter_profile.csv",
)


def _cfg():
    key = os.environ.get("WEIGUAN_TEST_LLM_KEY")
    if not key:
        pytest.skip("set WEIGUAN_TEST_LLM_KEY to run the real-LLM smoke test")
    return RunConfig(
        audience=Audience(custom="tech crowd"),
        content="We cut build time to 3 seconds.",
        steps=6,
        llm_key=key,
        llm_model=os.environ.get("WEIGUAN_TEST_LLM_MODEL", "gpt-4o-mini"),
    )


async def test_real_run_produces_llm_content(tmp_path):  # review:P2-T6-AC1
    eng = OasisEngine(profile_path=PROFILE, db_dir=str(tmp_path))
    deltas = [d async for d in eng.run(_cfg())]
    assert deltas[0].snapshot.posts[0].content.startswith("We cut build")
    later = sum(len(d.snapshot.replies) + len(d.snapshot.posts) for d in deltas[1:])
    assert later >= 1


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
