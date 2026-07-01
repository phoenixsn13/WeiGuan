from weiguan.canonical import RunSnapshot
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine


def _cfg(steps=10):
    return RunConfig(
        audience=Audience(crowd_id="t"),
        content="构建砍到3秒",
        steps=steps,
        llm_key="sk",
        llm_model="m",
    )


async def test_fake_run_yields_steps_deltas():  # review:P2-T3-AC1
    deltas = [d async for d in FakeEngine().run(_cfg(steps=6))]
    assert [d.step for d in deltas] == [1, 2, 3, 4, 5, 6]
    assert deltas[0].snapshot.posts[0].content == "构建砍到3秒"
    assert deltas[1].snapshot.replies[0].post_id == 1
    assert deltas[1].snapshot.reactions[0].actor_id == 2


async def test_fake_interview_is_deterministic():  # review:P2-T3-AC2
    ans = await FakeEngine().interview(_cfg(), RunSnapshot(), 2, "为什么?")
    assert "2" in ans and "为什么" in ans
