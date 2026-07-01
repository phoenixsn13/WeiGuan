import pytest
from pydantic import ValidationError

from weiguan.canonical import Platform
from weiguan.engine.config import Audience, RoundPreset, RunConfig


def _cfg(**kw):
    base = dict(
        audience=Audience(crowd_id="tech_devs"),
        content="hi",
        steps=10,
        llm_key="sk-x",
        llm_model="gpt-4o-mini",
    )
    base.update(kw)
    return RunConfig(**base)


def test_valid_config_defaults_platform_twitter():  # review:P2-T1-AC1
    c = _cfg()
    assert c.steps == 10 and c.platform == Platform.TWITTER
    assert c.llm_base_url is None
    assert c.llm_reasoning_effort is None
    assert c.llm_thinking_enabled is False


def test_steps_must_be_preset():  # review:P2-T1-AC2
    with pytest.raises(ValidationError):
        _cfg(steps=3)
    assert RoundPreset.STANDARD.value == 10


def test_audience_exactly_one():  # review:P2-T1-AC3
    with pytest.raises(ValidationError):
        _cfg(audience=Audience())
    with pytest.raises(ValidationError):
        _cfg(audience=Audience(crowd_id="a", custom="b"))


def test_openai_compatible_llm_options():  # review:P2-T6
    c = _cfg(
        llm_model="deepseek-v4-pro",
        llm_base_url="https://api.deepseek.com",
        llm_reasoning_effort="high",
        llm_thinking_enabled=True,
    )
    assert c.llm_base_url == "https://api.deepseek.com"
    assert c.llm_reasoning_effort == "high"
    assert c.llm_thinking_enabled is True
