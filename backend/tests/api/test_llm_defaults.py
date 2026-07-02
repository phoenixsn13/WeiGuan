from weiguan.api.llm_defaults import defaults_from_env, load_env_file


def test_load_env_file_reads_weiguan_llm_defaults(tmp_path, monkeypatch):  # review:PA-T5-AC3
    for name in [
        "WEIGUAN_LLM_KEY",
        "WEIGUAN_LLM_MODEL",
        "WEIGUAN_LLM_BASE_URL",
        "WEIGUAN_LLM_REASONING_EFFORT",
        "WEIGUAN_LLM_THINKING",
        "WEIGUAN_LLM_MAX_AGENTS",
        "WEIGUAN_LLM_MAX_STEPS",
        "WEIGUAN_LLM_ERROR_THRESHOLD",
        "WEIGUAN_LLM_MAX_RETRIES",
        "WEIGUAN_LLM_MAX_TOKENS",
        "WEIGUAN_LLM_COST_BUDGET_RMB",
        "WEIGUAN_OASIS_MAX_REC_POST_LEN",
        "WEIGUAN_OASIS_REFRESH_REC_POST_COUNT",
        "WEIGUAN_OASIS_FOLLOWING_POST_COUNT",
        "WEIGUAN_OASIS_LLM_SEMAPHORE",
        "WEIGUAN_ATTENTION_COMMENT_BUDGET",
    ]:
        monkeypatch.delenv(name, raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "WEIGUAN_LLM_KEY='sk-env'",
                "WEIGUAN_LLM_MODEL=deepseek-v4-pro",
                "WEIGUAN_LLM_BASE_URL=https://api.deepseek.com",
                "WEIGUAN_LLM_REASONING_EFFORT=high",
                "WEIGUAN_LLM_THINKING=enabled",
                "WEIGUAN_LLM_MAX_AGENTS=4",
                "WEIGUAN_LLM_MAX_STEPS=1",
                "WEIGUAN_LLM_ERROR_THRESHOLD=1",
                "WEIGUAN_LLM_MAX_RETRIES=0",
                "WEIGUAN_LLM_MAX_TOKENS=256",
                "WEIGUAN_LLM_COST_BUDGET_RMB=5",
                "WEIGUAN_OASIS_MAX_REC_POST_LEN=10",
                "WEIGUAN_OASIS_REFRESH_REC_POST_COUNT=5",
                "WEIGUAN_OASIS_FOLLOWING_POST_COUNT=3",
                "WEIGUAN_OASIS_LLM_SEMAPHORE=4",
                "WEIGUAN_ATTENTION_COMMENT_BUDGET=12",
            ]
        ),
        encoding="utf-8",
    )

    load_env_file(env_file)
    defaults = defaults_from_env()

    assert defaults.key == "sk-env"
    assert defaults.model == "deepseek-v4-pro"
    assert defaults.base_url == "https://api.deepseek.com"
    assert defaults.reasoning_effort == "high"
    assert defaults.thinking == "enabled"
    assert defaults.max_agents == 4
    assert defaults.max_steps == 1
    assert defaults.error_threshold == 1
    assert defaults.max_retries == 0
    assert defaults.max_tokens == 256
    assert defaults.cost_budget_rmb == 5.0
    assert defaults.oasis_max_rec_post_len == 10
    assert defaults.oasis_refresh_rec_post_count == 5
    assert defaults.oasis_following_post_count == 3
    assert defaults.oasis_llm_semaphore == 4
    assert defaults.attention_comment_budget == 12


def test_blank_max_steps_disables_hard_step_cap(tmp_path, monkeypatch):  # review:PA-T8-AC5
    monkeypatch.delenv("WEIGUAN_LLM_MAX_STEPS", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("WEIGUAN_LLM_MAX_STEPS=\n", encoding="utf-8")

    load_env_file(env_file)
    defaults = defaults_from_env()

    assert defaults.max_steps is None
