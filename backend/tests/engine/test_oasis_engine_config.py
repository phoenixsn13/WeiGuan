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
