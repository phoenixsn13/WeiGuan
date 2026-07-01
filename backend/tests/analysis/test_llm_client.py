from weiguan.analysis.llm_client import completion_options, make_openai_client
from weiguan.engine.config import Audience, RunConfig


def _cfg(**kw):
    base = dict(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=6,
        llm_key="sk-x",
        llm_model="deepseek-v4-pro",
        llm_base_url="https://api.deepseek.com",
        llm_reasoning_effort="high",
        llm_thinking_enabled=True,
    )
    base.update(kw)
    return RunConfig(**base)


def test_make_openai_client_accepts_base_url(monkeypatch):  # review:P5-T2
    captured = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr("weiguan.analysis.llm_client.OpenAI", FakeOpenAI)
    make_openai_client(_cfg())
    assert captured == {
        "api_key": "sk-x",
        "base_url": "https://api.deepseek.com",
    }


def test_completion_options_include_deepseek_thinking_params():  # review:P5-T2
    opts = completion_options(_cfg())
    assert opts["model"] == "deepseek-v4-pro"
    assert opts["reasoning_effort"] == "high"
    assert opts["extra_body"] == {"thinking": {"type": "enabled"}}


def test_completion_options_omit_deepseek_params_by_default():  # review:P5-T2
    opts = completion_options(
        _cfg(
            llm_base_url=None,
            llm_reasoning_effort=None,
            llm_thinking_enabled=False,
            llm_model="gpt-4o-mini",
        )
    )
    assert opts == {"model": "gpt-4o-mini"}
