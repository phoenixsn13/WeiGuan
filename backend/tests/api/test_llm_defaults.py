from weiguan.api.llm_defaults import defaults_from_env, load_env_file


def test_load_env_file_reads_weiguan_llm_defaults(tmp_path, monkeypatch):  # review:PA-T5-AC3
    for name in [
        "WEIGUAN_LLM_KEY",
        "WEIGUAN_LLM_MODEL",
        "WEIGUAN_LLM_BASE_URL",
        "WEIGUAN_LLM_REASONING_EFFORT",
        "WEIGUAN_LLM_THINKING",
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
