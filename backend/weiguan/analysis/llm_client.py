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
    options: dict[str, Any] = {
        "model": config.llm_model,
        "max_tokens": config.llm_max_tokens,
    }
    if config.llm_reasoning_effort:
        options["reasoning_effort"] = config.llm_reasoning_effort
    if config.llm_thinking_enabled:
        options["extra_body"] = {"thinking": {"type": "enabled"}}
    elif (getattr(config, "llm_thinking", None) or "").strip().lower() in {
        "disabled",
        "off",
        "false",
        "0",
    }:
        options["extra_body"] = {"chat_template_kwargs": {"enable_thinking": False}}
    return options
