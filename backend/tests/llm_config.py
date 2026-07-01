import os

import pytest


def llm_kwargs() -> dict:
    key = os.environ.get("WEIGUAN_TEST_LLM_KEY")
    if not key:
        pytest.skip("set WEIGUAN_TEST_LLM_KEY to run the real-LLM smoke test")
    return {
        "llm_key": key,
        "llm_model": os.environ.get("WEIGUAN_TEST_LLM_MODEL", "gpt-4o-mini"),
        "llm_base_url": os.environ.get("WEIGUAN_TEST_LLM_BASE_URL"),
        "llm_reasoning_effort": os.environ.get("WEIGUAN_TEST_LLM_REASONING_EFFORT"),
        "llm_thinking_enabled": os.environ.get(
            "WEIGUAN_TEST_LLM_THINKING",
            "",
        ).lower()
        in {"1", "true", "yes", "enabled", "on"},
    }
