from weiguan.canonical import RunSnapshot
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine
from weiguan.engine.routing import RoutingEngine


def _cfg(**kw):
    base = dict(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=6,
        llm_key="sk",
        llm_model="m",
    )
    base.update(kw)
    return RunConfig(**base)


async def test_routing_resolves_and_delegates():  # review:P4-T2-AC1
    built = {}

    def build(path: str):
        built["path"] = path
        return FakeEngine()

    eng = RoutingEngine(
        resolve_profile=lambda c: f"/p/{c.audience.crowd_id}.csv",
        engine_builder=build,
    )
    deltas = [d async for d in eng.run(_cfg())]
    assert built["path"] == "/p/tech_devs.csv"
    assert deltas[0].snapshot.posts[0].content == "hi"


async def test_routing_interview_delegates():  # review:P4-T2-AC2
    eng = RoutingEngine(
        resolve_profile=lambda c: "/p/x.csv",
        engine_builder=lambda p: FakeEngine(),
    )
    ans = await eng.interview(_cfg(), RunSnapshot(), 2, "为什么?")
    assert "2" in ans
