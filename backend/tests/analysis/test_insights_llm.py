import os

import pytest

from weiguan.analysis.insights import generate_insights
from weiguan.canonical import Post, Reply, RunSnapshot
from weiguan.engine.config import Audience, RunConfig

pytestmark = pytest.mark.llm


def _cfg():
    key = os.environ.get("WEIGUAN_TEST_LLM_KEY")
    if not key:
        pytest.skip("set WEIGUAN_TEST_LLM_KEY to run")
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="构建砍到3秒",
        steps=6,
        llm_key=key,
        llm_model=os.environ.get("WEIGUAN_TEST_LLM_MODEL", "gpt-4o-mini"),
    )


def test_insights_returns_verdict_and_suggestions():  # review:P5-T2-AC1
    snap = RunSnapshot(
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=1, content="构建砍到3秒")],
        replies=[Reply(comment_id=1, post_id=1, author_id=2, content="缓存没清吧")],
    )
    insights = generate_insights(snap, _cfg())
    assert insights.verdict.strip()
    assert 1 <= len(insights.suggestions) <= 2
    assert all(s.strip() for s in insights.suggestions)
