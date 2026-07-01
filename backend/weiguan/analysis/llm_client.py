from __future__ import annotations

from typing import Any

from openai import OpenAI

from weiguan.engine.config import RunConfig


def make_openai_client(config: RunConfig) -> OpenAI:
    kwargs: dict[str, Any] = {"api_key": config.llm_key}
    if config.llm_base_url:
        kwargs["base_url"] = config.llm_base_url
    return OpenAI(**kwargs)


def completion_options(config: RunConfig) -> dict[str, Any]:
    options: dict[str, Any] = {"model": config.llm_model}
    if config.llm_reasoning_effort:
        options["reasoning_effort"] = config.llm_reasoning_effort
    if config.llm_thinking_enabled:
        options["extra_body"] = {"thinking": {"type": "enabled"}}
    return options
