from __future__ import annotations

import os
from pathlib import Path

import pytest
from openai import APIConnectionError, APITimeoutError, NotFoundError, OpenAI
from openai.types.chat import ChatCompletion

from weiguan.api.llm_defaults import defaults_from_env, load_env_file
from weiguan.analysis.llm_client import completion_options
from weiguan.engine.config import Audience, RunConfig


pytestmark = pytest.mark.llm_connectivity


def _enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    if not os.environ.get("WEIGUAN_TEST_LLM_CONNECTIVITY"):
        pytest.skip("set WEIGUAN_TEST_LLM_CONNECTIVITY=1 to probe the configured LLM endpoint")
    for name in [
        "WEIGUAN_LLM_KEY",
        "WEIGUAN_LLM_MODEL",
        "WEIGUAN_LLM_BASE_URL",
        "WEIGUAN_LLM_REASONING_EFFORT",
        "WEIGUAN_LLM_THINKING",
    ]:
        monkeypatch.delenv(name, raising=False)


def _config_from_backend_env(monkeypatch: pytest.MonkeyPatch) -> RunConfig:
    _enabled(monkeypatch)
    load_env_file(Path(__file__).resolve().parents[2] / ".env")
    defaults = defaults_from_env()
    assert defaults.key, "WEIGUAN_LLM_KEY is empty after loading backend/.env"
    assert defaults.model, "WEIGUAN_LLM_MODEL is empty after loading backend/.env"
    assert defaults.base_url, "WEIGUAN_LLM_BASE_URL is empty after loading backend/.env"
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="connectivity smoke",
        steps=6,
        llm_key=defaults.key,
        llm_model=defaults.model,
        llm_base_url=defaults.base_url,
        llm_reasoning_effort=defaults.reasoning_effort,
        llm_thinking_enabled=(defaults.thinking or "").lower()
        in {"1", "true", "yes", "enabled", "on"},
        llm_max_tokens=16,
    )


def _base_url_hint(base_url: str | None) -> str:
    if not base_url:
        return ""
    if base_url.rstrip("/").endswith("/v1"):
        return " The configured URL already ends with /v1; check the model server route table."
    return f" For vLLM, try WEIGUAN_LLM_BASE_URL={base_url.rstrip('/')}/v1."


def _assert_nonempty_chat(response: ChatCompletion, label: str) -> None:
    choice = response.choices[0]
    text = choice.message.content or ""
    assert text.strip(), (
        f"{label} returned an empty message; "
        f"finish_reason={choice.finish_reason!r}; "
        f"message={choice.message.model_dump(mode='json')!r}; "
        f"usage={response.usage.model_dump(mode='json') if response.usage else None!r}"
    )


def test_env_llm_model_is_listed_by_openai_compatible_endpoint(monkeypatch):
    config = _config_from_backend_env(monkeypatch)
    client = OpenAI(
        api_key=config.llm_key,
        base_url=config.llm_base_url,
        timeout=5.0,
        max_retries=0,
    )
    try:
        models = client.models.list()
    except (APIConnectionError, APITimeoutError) as exc:
        raise AssertionError(
            f"cannot reach WEIGUAN_LLM_BASE_URL={config.llm_base_url!r}: {exc}"
        ) from exc
    except NotFoundError as exc:
        raise AssertionError(
            f"models endpoint returned 404 for WEIGUAN_LLM_BASE_URL={config.llm_base_url!r}."
            f"{_base_url_hint(config.llm_base_url)} Original error: {exc}"
        ) from exc

    ids = [model.id for model in models.data]
    assert config.llm_model in ids, (
        f"WEIGUAN_LLM_MODEL={config.llm_model!r} is not in endpoint model list: {ids}"
    )


def test_env_llm_plain_chat_returns_content(monkeypatch):
    config = _config_from_backend_env(monkeypatch)
    client = OpenAI(
        api_key=config.llm_key,
        base_url=config.llm_base_url,
        timeout=10.0,
        max_retries=0,
    )

    try:
        response = client.chat.completions.create(
            model=config.llm_model,
            messages=[{"role": "user", "content": "Reply with exactly: ok"}],
            max_tokens=64,
            temperature=0,
        )
    except NotFoundError as exc:
        raise AssertionError(
            f"chat endpoint returned 404 for model={config.llm_model!r} "
            f"at WEIGUAN_LLM_BASE_URL={config.llm_base_url!r}."
            f"{_base_url_hint(config.llm_base_url)} If /v1 is already correct, "
            "check WEIGUAN_LLM_MODEL or stale frontend BYOK headers."
        ) from exc
    except (APIConnectionError, APITimeoutError) as exc:
        raise AssertionError(
            f"cannot reach chat endpoint at {config.llm_base_url!r}: {exc}"
        ) from exc
    _assert_nonempty_chat(response, "plain chat")


def test_env_llm_accepts_project_chat_options(monkeypatch):
    config = _config_from_backend_env(monkeypatch)
    client = OpenAI(
        api_key=config.llm_key,
        base_url=config.llm_base_url,
        timeout=10.0,
        max_retries=0,
    )
    options = completion_options(config)
    options["messages"] = [{"role": "user", "content": "Reply with exactly: ok"}]
    options["max_tokens"] = 64
    options["temperature"] = 0

    try:
        response = client.chat.completions.create(**options)
    except NotFoundError as exc:
        raise AssertionError(
            f"chat endpoint returned 404 for model={config.llm_model!r} "
            f"at WEIGUAN_LLM_BASE_URL={config.llm_base_url!r}."
            f"{_base_url_hint(config.llm_base_url)} If /v1 is already correct, "
            "check WEIGUAN_LLM_MODEL or stale frontend BYOK headers."
        ) from exc
    except (APIConnectionError, APITimeoutError) as exc:
        raise AssertionError(
            f"cannot reach chat endpoint at {config.llm_base_url!r}: {exc}"
        ) from exc
    _assert_nonempty_chat(response, "project chat options")
