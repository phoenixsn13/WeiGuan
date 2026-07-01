#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${WEIGUAN_TEST_LLM_KEY:-}" ]]; then
  echo "Set WEIGUAN_TEST_LLM_KEY before running this script." >&2
  exit 2
fi

export WEIGUAN_TEST_LLM_MODEL="${WEIGUAN_TEST_LLM_MODEL:-deepseek-v4-pro}"
export WEIGUAN_TEST_LLM_BASE_URL="${WEIGUAN_TEST_LLM_BASE_URL:-https://api.deepseek.com}"
export WEIGUAN_TEST_LLM_REASONING_EFFORT="${WEIGUAN_TEST_LLM_REASONING_EFFORT:-high}"
export WEIGUAN_TEST_LLM_THINKING="${WEIGUAN_TEST_LLM_THINKING:-enabled}"

/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m llm -v
