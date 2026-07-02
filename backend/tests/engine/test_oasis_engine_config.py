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
        "max_tokens": 512,
    }
    assert captured["max_retries"] == 0


def test_oasis_engine_disables_vllm_template_thinking_when_requested(monkeypatch, tmp_path):  # review:UI-P6-AC2
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
        llm_key="default",
        llm_model="zbnsec-default",
        llm_base_url="http://10.70.70.75:65400/v1",
        llm_thinking="disabled",
        llm_thinking_enabled=False,
        llm_max_tokens=128,
    )

    engine._model(config)

    assert captured["model_config_dict"] == {
        "extra_body": {"chat_template_kwargs": {"enable_thinking": False}},
        "max_tokens": 128,
    }


def _cfg() -> RunConfig:
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=6,
        llm_key="sk-x",
        llm_model="m",
    )


async def test_make_env_uses_budgeted_random_platform_for_seed_visibility(monkeypatch, tmp_path):  # review:PA-T7-AC1
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
    assert platform.max_rec_post_len == 10
    assert platform.refresh_rec_post_count == 5
    assert platform.following_post_count == 3
    assert captured["semaphore"] == 4


async def test_attention_context_replaces_full_oasis_prompt(monkeypatch, tmp_path):  # review:PA-T7-AC3
    class FakeAction:
        async def refresh(self):
            return {
                "success": True,
                "posts": [
                    {
                        "post_id": 1,
                        "user_id": 0,
                        "content": "seed",
                        "comments": [
                            {
                                "comment_id": idx,
                                "post_id": 1,
                                "user_id": idx,
                                "content": f"source? comment {idx}",
                                "created_at": idx,
                                "num_likes": idx,
                                "num_dislikes": 0,
                            }
                            for idx in range(1, 40)
                        ],
                    }
                ],
            }

    class FakeEnvForAgent:
        action = FakeAction()

    class FakeAgent:
        def __init__(self, actor_id):
            self.social_agent_id = actor_id
            self.env = FakeEnvForAgent()

    agent = FakeAgent(7)

    class FakeGraph:
        def get_agents(self):
            return [(0, FakeAgent(0)), (7, agent)]

    class FakeEnv:
        agent_graph = FakeGraph()

    engine = OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))
    cfg = _cfg()
    cfg.attention_comment_budget = 5

    engine._install_attention_context(FakeEnv(), cfg)

    prompt = await agent.env.to_text_prompt()

    assert "discussion_panel" in prompt
    assert prompt.count("comment_id") == 5
    assert "comment 39" in prompt
    assert "科技程序员群" in prompt
    assert "简体中文" in prompt


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
    db_path = tmp_path / "missing.db"

    async def fake_make_env(config):
        return FakeEnv(), str(db_path)

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
    monkeypatch.setattr(engine, "_pin_seed_to_rec", lambda db_path: None)

    import pytest

    with pytest.raises(RuntimeError, match="seed not visible"):
        [delta async for delta in engine.run(_cfg())]


async def test_run_limits_llm_agent_batch_and_steps(monkeypatch, tmp_path):  # review:PA-T6-AC1
    class ActionType:
        CREATE_POST = "create_post"

    class ManualAction:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class LLMAction:
        pass

    class AgentGraph:
        def __init__(self):
            self.requested_agent_ids = []

        def get_agent(self, actor_id):
            return f"agent-{actor_id}"

        def get_agents(self, agent_ids=None):
            self.requested_agent_ids.append(list(agent_ids) if agent_ids else None)
            ids = agent_ids or list(range(6))
            return [(agent_id, f"agent-{agent_id}") for agent_id in ids]

    class FakeEnv:
        def __init__(self):
            self.agent_graph = AgentGraph()
            self.steps = []

        async def reset(self):
            return None

        async def step(self, actions):
            self.steps.append(actions)

        async def close(self):
            return None

    env = FakeEnv()
    engine = OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))
    config = RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=15,
        llm_key="sk-x",
        llm_model="m",
        llm_max_agents=2,
        llm_max_steps=2,
    )

    async def fake_make_env(config):
        return env, str(tmp_path / "run.db")

    monkeypatch.setattr(engine, "_make_env", fake_make_env)
    monkeypatch.setattr(
        engine,
        "_deps",
        lambda: {
            "ActionType": ActionType,
            "ManualAction": ManualAction,
            "LLMAction": LLMAction,
        },
    )
    monkeypatch.setattr(engine, "_pin_seed_to_rec", lambda db_path: None)
    monkeypatch.setattr(engine, "_assert_seed_visible", lambda db_path: None)
    monkeypatch.setattr(
        "weiguan.engine.oasis_engine.load_run_snapshot",
        lambda *args, **kwargs: __import__("weiguan.canonical").canonical.RunSnapshot(),
    )

    deltas = [delta async for delta in engine.run(config)]

    assert [delta.step for delta in deltas] == [1, 2, 3]
    limited_requests = [
        item for item in env.agent_graph.requested_agent_ids if item is not None
    ]
    assert limited_requests == [[1, 2], [1, 2]]
    assert len(env.steps) == 3
    assert all(len(actions) == 2 for actions in env.steps[1:])


def test_llm_agent_ids_respect_budgeted_agent_cap(tmp_path):  # review:PA-T8-AC6
    class AgentGraph:
        def get_agents(self):
            return [(agent_id, f"agent-{agent_id}") for agent_id in range(9)]

    class Env:
        agent_graph = AgentGraph()

    config = RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=15,
        llm_key="sk-x",
        llm_model="m",
        llm_max_agents=8,
        llm_cost_budget_rmb=0.05,
    )

    ids = OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))._llm_agent_ids(
        Env(),
        config,
    )

    assert len(ids) == config.budgeted_llm_max_agents
    assert len(ids) < config.llm_max_agents
    assert config.effective_steps == 15


def test_actor_labels_load_from_profile_row_names(tmp_path):  # review:UI-P10-AC3
    profile = tmp_path / "profile.csv"
    profile.write_text(
        "\n".join(
            [
                ",user_id,name,username,following_agentid_list,previous_tweets,user_char,description",
                "0,100,韭菜观察员,cai00,[],[],嘴碎,财经用户",
                "1,101,龙虎榜阿飞,cai01,[],[],较真,财经用户",
            ]
        ),
        encoding="utf-8",
    )

    engine = OasisEngine(profile_path=str(profile), db_dir=str(tmp_path))

    assert engine._actor_labels() == {0: "韭菜观察员", 1: "龙虎榜阿飞"}


async def test_run_breaks_circuit_when_llm_step_fails(monkeypatch, tmp_path):  # review:PA-T6-AC2
    class ActionType:
        CREATE_POST = "create_post"

    class ManualAction:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class LLMAction:
        pass

    class AgentGraph:
        def get_agent(self, actor_id):
            return f"agent-{actor_id}"

        def get_agents(self, agent_ids=None):
            return [(agent_id, f"agent-{agent_id}") for agent_id in (agent_ids or [1])]

    class FakeEnv:
        agent_graph = AgentGraph()

        async def reset(self):
            return None

        async def step(self, actions):
            if any(isinstance(action, LLMAction) for action in actions.values()):
                raise RuntimeError("provider overloaded")

        async def close(self):
            return None

    engine = OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))

    async def fake_make_env(config):
        return FakeEnv(), str(tmp_path / "run.db")

    monkeypatch.setattr(engine, "_make_env", fake_make_env)
    monkeypatch.setattr(
        engine,
        "_deps",
        lambda: {
            "ActionType": ActionType,
            "ManualAction": ManualAction,
            "LLMAction": LLMAction,
        },
    )
    monkeypatch.setattr(engine, "_pin_seed_to_rec", lambda db_path: None)
    monkeypatch.setattr(engine, "_assert_seed_visible", lambda db_path: None)
    monkeypatch.setattr(
        "weiguan.engine.oasis_engine.load_run_snapshot",
        lambda *args, **kwargs: __import__("weiguan.canonical").canonical.RunSnapshot(),
    )

    import pytest

    config = RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=6,
        llm_key="sk-x",
        llm_model="m",
        llm_max_agents=1,
        llm_max_steps=3,
        llm_error_threshold=1,
    )
    with pytest.raises(RuntimeError, match="LLM circuit breaker opened"):
        [delta async for delta in engine.run(config)]


def test_pin_seed_to_rec_writes_seed_for_all_non_seed_users(tmp_path):  # review:P2-T7
    import sqlite3

    db_path = tmp_path / "run.db"
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(
            """
            CREATE TABLE user (user_id INTEGER PRIMARY KEY);
            CREATE TABLE rec (user_id INTEGER, post_id INTEGER, PRIMARY KEY(user_id, post_id));
            INSERT INTO user (user_id) VALUES (0), (1), (2);
            """
        )
        conn.commit()
    finally:
        conn.close()

    OasisEngine(profile_path="profile.csv", db_dir=str(tmp_path))._pin_seed_to_rec(
        str(db_path),
        seed_post_id=1,
        seed_author_id=0,
    )

    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute("SELECT user_id, post_id FROM rec ORDER BY user_id").fetchall()
    finally:
        conn.close()
    assert rows == [(1, 1), (2, 1)]


def test_tiny_profile_is_seed_engagement_oriented():  # review:P2-T8
    import csv
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "fixtures" / "tiny_twitter_profile.csv"
    with open(path, encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    assert rows[0]["following_agentid_list"] == "[]"
    assert all(row["following_agentid_list"] == "[0]" for row in rows[1:])
    assert all(
        any(term in row["description"].lower() for term in ["build", "ci", "developer"])
        for row in rows
    )


def test_llm_profile_fixtures_are_pandas_readable():  # review:P2-T8
    import pandas as pd
    from pathlib import Path

    fixture_dir = Path(__file__).resolve().parents[1] / "fixtures"
    for name, expected_rows in [
        ("tiny_twitter_profile.csv", 3),
        ("small_twitter_profile.csv", 20),
    ]:
        frame = pd.read_csv(fixture_dir / name)
        assert len(frame) == expected_rows
        assert list(frame.columns) == [
            "Unnamed: 0",
            "user_id",
            "name",
            "username",
            "following_agentid_list",
            "previous_tweets",
            "user_char",
            "description",
        ]
