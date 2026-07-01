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


def test_steps_must_be_preset():  # review:P2-T1-AC2
    with pytest.raises(ValidationError):
        _cfg(steps=3)
    assert RoundPreset.STANDARD.value == 10


def test_audience_exactly_one():  # review:P2-T1-AC3
    with pytest.raises(ValidationError):
        _cfg(audience=Audience())
    with pytest.raises(ValidationError):
        _cfg(audience=Audience(crowd_id="a", custom="b"))
