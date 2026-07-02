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
    llm_thinking: str | None = None
    llm_thinking_enabled: bool = False
    llm_max_agents: int = 8
    llm_max_steps: int = 2
    llm_error_threshold: int = 1
    llm_max_retries: int = 0
    llm_max_tokens: int = 512
    llm_cost_budget_rmb: float = 5.0
    oasis_max_rec_post_len: int = 10
    oasis_refresh_rec_post_count: int = 5
    oasis_following_post_count: int = 3
    oasis_llm_semaphore: int = 4
    attention_comment_budget: int = 12

    @model_validator(mode="after")
    def _steps_preset(self):
        if self.steps not in _ALLOWED_STEPS:
            raise ValueError("steps must be one of 6/10/15")
        if self.llm_max_agents < 1:
            raise ValueError("llm_max_agents must be >= 1")
        if self.llm_max_steps < 0:
            raise ValueError("llm_max_steps must be >= 0")
        if self.llm_error_threshold < 1:
            raise ValueError("llm_error_threshold must be >= 1")
        if self.llm_max_retries < 0:
            raise ValueError("llm_max_retries must be >= 0")
        if self.llm_max_tokens < 1:
            raise ValueError("llm_max_tokens must be >= 1")
        if self.llm_cost_budget_rmb <= 0:
            raise ValueError("llm_cost_budget_rmb must be > 0")
        if self.oasis_max_rec_post_len < 1:
            raise ValueError("oasis_max_rec_post_len must be >= 1")
        if self.oasis_refresh_rec_post_count < 1:
            raise ValueError("oasis_refresh_rec_post_count must be >= 1")
        if self.oasis_following_post_count < 0:
            raise ValueError("oasis_following_post_count must be >= 0")
        if self.oasis_llm_semaphore < 1:
            raise ValueError("oasis_llm_semaphore must be >= 1")
        if self.attention_comment_budget < 1:
            raise ValueError("attention_comment_budget must be >= 1")
        return self
