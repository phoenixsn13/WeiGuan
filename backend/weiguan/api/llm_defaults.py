from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LlmDefaults:
    key: str | None = None
    model: str | None = None
    base_url: str | None = None
    reasoning_effort: str | None = None
    thinking: str | None = None
    max_agents: int | None = None
    max_steps: int | None = None
    error_threshold: int | None = None
    max_retries: int | None = None
    max_tokens: int | None = None


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip().strip('"').strip("'")
    return stripped or None


def _int_env(name: str) -> int | None:
    value = _clean(os.environ.get(name))
    return int(value) if value is not None else None


def load_env_file(path: str | Path) -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        name = key.strip()
        if name and name not in os.environ:
            os.environ[name] = _clean(value) or ""


# review:PA-T5
def defaults_from_env() -> LlmDefaults:
    return LlmDefaults(
        key=_clean(os.environ.get("WEIGUAN_LLM_KEY")),
        model=_clean(os.environ.get("WEIGUAN_LLM_MODEL")),
        base_url=_clean(os.environ.get("WEIGUAN_LLM_BASE_URL")),
        reasoning_effort=_clean(os.environ.get("WEIGUAN_LLM_REASONING_EFFORT")),
        thinking=_clean(os.environ.get("WEIGUAN_LLM_THINKING")),
        max_agents=_int_env("WEIGUAN_LLM_MAX_AGENTS"),
        max_steps=_int_env("WEIGUAN_LLM_MAX_STEPS"),
        error_threshold=_int_env("WEIGUAN_LLM_ERROR_THRESHOLD"),
        max_retries=_int_env("WEIGUAN_LLM_MAX_RETRIES"),
        max_tokens=_int_env("WEIGUAN_LLM_MAX_TOKENS"),
    )
