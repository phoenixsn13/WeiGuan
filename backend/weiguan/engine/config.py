from __future__ import annotations

import math
from enum import Enum

from pydantic import BaseModel, model_validator

from weiguan.canonical import Platform


class RoundPreset(int, Enum):
    FAST = 6
    STANDARD = 10
    DEEP = 15


MIN_STEPS = 1
MAX_STEPS = 1000
_FIXED_PROMPT_TOKENS = 2_000
_TOKEN_CHAR_RATIO = 0.45
_USD_CNY = 7.25
_INPUT_CACHE_MISS_USD_PER_MILLION = 0.435
_OUTPUT_USD_PER_MILLION = 0.87


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
    llm_max_steps: int | None = None
    llm_error_threshold: int = 1
    llm_max_retries: int = 0
    llm_max_tokens: int = 512
    llm_cost_budget_rmb: float = 5.0
    oasis_max_rec_post_len: int = 10
    oasis_refresh_rec_post_count: int = 5
    oasis_following_post_count: int = 3
    oasis_llm_semaphore: int = 4
    attention_comment_budget: int = 12

    @property
    def effective_steps(self) -> int:
        if self.llm_max_steps is None:
            return self.steps
        return min(self.steps, self.llm_max_steps + 1)

    @property
    def llm_decision_steps(self) -> int:
        return max(0, self.effective_steps - 1)

    @property
    def estimated_tokens_per_llm_request(self) -> int:
        bounded_context_chars = 800 + 220 + self.attention_comment_budget * 160
        return _FIXED_PROMPT_TOKENS + math.ceil(
            bounded_context_chars * _TOKEN_CHAR_RATIO
        )

    def estimate_llm_cost_rmb(self, agent_count: int | None = None) -> float:
        agents = self.llm_max_agents if agent_count is None else agent_count
        requests = max(0, agents) * self.llm_decision_steps
        input_tokens = requests * self.estimated_tokens_per_llm_request
        output_tokens = requests * self.llm_max_tokens
        usd = (
            input_tokens / 1_000_000 * _INPUT_CACHE_MISS_USD_PER_MILLION
            + output_tokens / 1_000_000 * _OUTPUT_USD_PER_MILLION
        )
        return usd * _USD_CNY

    @property
    def budgeted_llm_max_agents(self) -> int:
        if self.llm_decision_steps == 0:
            return self.llm_max_agents
        per_agent_cost = self.estimate_llm_cost_rmb(agent_count=1)
        if per_agent_cost <= 0:
            return self.llm_max_agents
        budgeted = math.floor(self.llm_cost_budget_rmb / per_agent_cost)
        return max(1, min(self.llm_max_agents, budgeted))

    @model_validator(mode="after")
    def _steps_preset(self):
        if self.steps < MIN_STEPS or self.steps > MAX_STEPS:
            raise ValueError("steps must be between 1 and 1000")
        if self.llm_max_agents < 1:
            raise ValueError("llm_max_agents must be >= 1")
        if self.llm_max_steps is not None and self.llm_max_steps < 0:
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
