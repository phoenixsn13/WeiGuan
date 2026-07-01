from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.oasis_engine import OasisEngine


def test_oasis_engine_uses_openai_compatible_model_options(monkeypatch, tmp_path):  # review:P2-T6
    captured = {}

    class Platform:
        OPENAI = "openai"
        OPENAI_COMPATIBLE_MODEL = "openai-compatible-model"

    class ModelType:
        GPT_4O_MINI = "gpt-4o-mini"

    class Factory:
        @staticmethod
        def create(**kwargs):
            captured.update(kwargs)
            return object()

    engine = OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))
    monkeypatch.setattr(
        engine,
        "_deps",
        lambda: {
            "ModelFactory": Factory,
            "ModelPlatformType": Platform,
            "ModelType": ModelType,
        },
    )
    config = RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=6,
        llm_key="sk-x",
        llm_model="deepseek-v4-pro",
        llm_base_url="https://api.deepseek.com",
        llm_reasoning_effort="high",
        llm_thinking_enabled=True,
    )

    engine._model(config)

    assert captured["model_platform"] == "openai-compatible-model"
    assert captured["model_type"] == "deepseek-v4-pro"
    assert captured["api_key"] == "sk-x"
    assert captured["url"] == "https://api.deepseek.com"
    assert captured["model_config_dict"] == {
        "reasoning_effort": "high",
        "extra_body": {"thinking": {"type": "enabled"}},
    }


def _cfg() -> RunConfig:
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=6,
        llm_key="sk-x",
        llm_model="m",
    )


async def test_make_env_uses_random_platform_for_seed_visibility(monkeypatch, tmp_path):  # review:P2-T7
    captured = {}

    class ActionType:
        CREATE_POST = "create_post"
        CREATE_COMMENT = "create_comment"
        LIKE_POST = "like_post"
        DISLIKE_POST = "dislike_post"
        REPOST = "repost"
        FOLLOW = "follow"
        DO_NOTHING = "do_nothing"

    class FakeOasis:
        DefaultPlatformType = type("DefaultPlatformType", (), {"TWITTER": object()})

        @staticmethod
        def make(**kwargs):
            captured.update(kwargs)
            return object()

    class FakeChannel:
        pass

    class FakePlatform:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    async def fake_graph(**kwargs):
        return object()

    engine = OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))
    monkeypatch.setattr(engine, "_model", lambda config: object())
    monkeypatch.setattr(
        engine,
        "_deps",
        lambda: {
            "ActionType": ActionType,
            "Channel": FakeChannel,
            "generate_twitter_agent_graph": fake_graph,
            "oasis": FakeOasis,
            "Platform": FakePlatform,
        },
    )

    await engine._make_env(_cfg())

    platform = captured["platform"]
    assert platform is not FakeOasis.DefaultPlatformType.TWITTER
    assert platform.recsys_type == "random"
    assert platform.max_rec_post_len == 500
    assert platform.refresh_rec_post_count == 500
    assert platform.following_post_count == 5


async def test_run_raises_when_seed_visibility_check_fails(monkeypatch, tmp_path):  # review:P2-T7-AC1
    class ActionType:
        CREATE_POST = "create_post"

    class ManualAction:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class AgentGraph:
        def get_agent(self, actor_id):
            return f"agent-{actor_id}"

    class FakeEnv:
        agent_graph = AgentGraph()

        async def reset(self):
            return None

        async def step(self, actions):
            return None

        async def close(self):
            return None

    engine = OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))

    async def fake_make_env(config):
        return FakeEnv(), "missing.db"

    monkeypatch.setattr(engine, "_make_env", fake_make_env)
    monkeypatch.setattr(
        engine,
        "_deps",
        lambda: {
            "ActionType": ActionType,
            "ManualAction": ManualAction,
            "LLMAction": object,
        },
    )
    monkeypatch.setattr(
        engine,
        "_assert_seed_visible",
        lambda db_path: (_ for _ in ()).throw(RuntimeError("seed not visible")),
    )

    import pytest

    with pytest.raises(RuntimeError, match="seed not visible"):
        [delta async for delta in engine.run(_cfg())]
