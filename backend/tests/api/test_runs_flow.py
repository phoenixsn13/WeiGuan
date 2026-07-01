import httpx

from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine

HDR = {"X-LLM-Key": "sk-x", "X-LLM-Model": "gpt-4o-mini"}


def _body(steps=6):
    return {
        "audience": {"crowd_id": "tech_devs"},
        "content": "构建砍到3秒",
        "steps": steps,
        "platform": "twitter",
    }


def _client():
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_app(FakeEngine())),
        base_url="http://test",
    )


async def test_create_run_returns_id():  # review:P2-T4-AC1
    async with _client() as client:
        r = await client.post("/api/runs", json=_body(), headers=HDR)
    assert r.status_code == 200 and r.json()["run_id"].startswith("r_")


async def test_create_run_rejects_bad_steps():  # review:P2-T4-AC2
    async with _client() as client:
        r = await client.post("/api/runs", json=_body(steps=3), headers=HDR)
    assert r.status_code == 400


async def test_create_run_requires_key():  # review:P2-T4-AC3
    async with _client() as client:
        r = await client.post("/api/runs", json=_body(), headers={})
    assert r.status_code == 401


async def test_create_run_uses_env_defaults_when_headers_are_blank():  # review:PA-T5-AC1
    from weiguan.api.app import create_app
    from weiguan.api.llm_defaults import LlmDefaults

    app = create_app(
        FakeEngine(),
        llm_defaults=LlmDefaults(
            key="sk-env",
            model="deepseek-v4-pro",
            base_url="https://api.deepseek.com",
            reasoning_effort="high",
            thinking="enabled",
            max_agents=4,
            max_steps=1,
            error_threshold=1,
            max_retries=0,
            max_tokens=256,
        ),
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        r = await client.post(
            "/api/runs",
            json=_body(),
            headers={
                "X-LLM-Key": "",
                "X-LLM-Model": "",
                "X-LLM-Base-Url": "",
                "X-LLM-Reasoning-Effort": "",
                "X-LLM-Thinking": "",
            },
        )
        run_id = r.json()["run_id"]
        record = app.state.store.get(run_id)
    assert r.status_code == 200
    assert record.config.llm_key == "sk-env"
    assert record.config.llm_model == "deepseek-v4-pro"
    assert record.config.llm_base_url == "https://api.deepseek.com"
    assert record.config.llm_reasoning_effort == "high"
    assert record.config.llm_thinking_enabled is True
    assert record.config.llm_max_agents == 4
    assert record.config.llm_max_steps == 1
    assert record.config.llm_error_threshold == 1
    assert record.config.llm_max_retries == 0
    assert record.config.llm_max_tokens == 256


async def test_create_run_accepts_openai_compatible_headers():  # review:P2-T6
    headers = {
        "X-LLM-Key": "sk-x",
        "X-LLM-Model": "deepseek-v4-pro",
        "X-LLM-Base-URL": "https://api.deepseek.com",
        "X-LLM-Reasoning-Effort": "high",
        "X-LLM-Thinking": "enabled",
    }
    async with _client() as client:
        r = await client.post("/api/runs", json=_body(), headers=headers)
        run_id = r.json()["run_id"]
        record = client._transport.app.state.store.get(run_id)
    assert r.status_code == 200
    assert record.config.llm_model == "deepseek-v4-pro"
    assert record.config.llm_base_url == "https://api.deepseek.com"
    assert record.config.llm_reasoning_effort == "high"
    assert record.config.llm_thinking_enabled is True


async def test_sse_stream_order_and_accumulation():  # review:P2-T4-AC4
    async with _client() as client:
        run_id = (await client.post("/api/runs", json=_body(6), headers=HDR)).json()[
            "run_id"
        ]
        text = (await client.get(f"/api/runs/{run_id}/events")).text
    events = [
        ln[len("event: ") :] for ln in text.splitlines() if ln.startswith("event: ")
    ]
    assert events[0] == "run_started"
    assert events.count("step_started") == 6
    assert events[-1] == "run_done"
