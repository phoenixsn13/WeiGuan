from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, model_validator

from weiguan.canonical import Platform


class RoundPreset(int, Enum):
    FAST = 6
    STANDARD = 10
    DEEP = 15


_ALLOWED_STEPS = {p.value for p in RoundPreset}


# review:P2-T1
class Audience(BaseModel):
    crowd_id: str | None = None
    custom: str | None = None

    @model_validator(mode="after")
    def _exactly_one(self):
        if bool(self.crowd_id) == bool(self.custom):
            raise ValueError("audience must set exactly one of crowd_id/custom")
        return self


class RunConfig(BaseModel):
    audience: Audience
    content: str
    steps: int
    platform: Platform = Platform.TWITTER
    llm_key: str
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str | None = None
    llm_reasoning_effort: str | None = None
    llm_thinking_enabled: bool = False

    @model_validator(mode="after")
    def _steps_preset(self):
        if self.steps not in _ALLOWED_STEPS:
            raise ValueError("steps must be one of 6/10/15")
        return self
