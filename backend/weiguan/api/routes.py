from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

from weiguan.api.llm_defaults import LlmDefaults
from weiguan.analysis.insights import generate_insights
from weiguan.analysis.retro import compute_metrics, seed_engaged_actor_ids
from weiguan.canonical import Platform
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.crowds import list_crowds

router = APIRouter(prefix="/api")


@router.get("/crowds")
async def crowds():  # review:P4-T1
    return list_crowds()


class _CreateBody(BaseModel):
    audience: Audience
    content: str
    steps: int
    platform: Platform = Platform.TWITTER


class _InterviewBody(BaseModel):
    actor_id: int
    question: str


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _thinking_enabled(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "enabled", "on"}


def _nonblank(value: str | None) -> str | None:
    stripped = (value or "").strip()
    return stripped or None


def _llm_defaults(request: Request) -> LlmDefaults:
    return getattr(request.app.state, "llm_defaults", LlmDefaults())


def _llm_update(
    key: str | None,
    model: str | None,
    base_url: str | None,
    reasoning_effort: str | None,
    thinking: str | None,
    max_agents: int | None = None,
    max_steps: int | None = None,
    error_threshold: int | None = None,
    max_retries: int | None = None,
    max_tokens: int | None = None,
) -> dict:
    update = {
        "llm_key": key,
        "llm_model": model,
        "llm_base_url": base_url,
        "llm_reasoning_effort": reasoning_effort,
        "llm_thinking_enabled": _thinking_enabled(thinking),
    }
    if max_agents is not None:
        update["llm_max_agents"] = max_agents
    if max_steps is not None:
        update["llm_max_steps"] = max_steps
    if error_threshold is not None:
        update["llm_error_threshold"] = error_threshold
    if max_retries is not None:
        update["llm_max_retries"] = max_retries
    if max_tokens is not None:
        update["llm_max_tokens"] = max_tokens
    return update


def _resolve_llm_update(
    request: Request,
    key: str | None,
    model: str | None,
    base_url: str | None,
    reasoning_effort: str | None,
    thinking: str | None,
) -> dict:
    defaults = _llm_defaults(request)
    resolved_key = _nonblank(key) or defaults.key
    if not resolved_key:
        raise HTTPException(status_code=401, detail="missing X-LLM-Key")
    return _llm_update(
        resolved_key,
        _nonblank(model) or defaults.model or "gpt-4o-mini",
        _nonblank(base_url) or defaults.base_url,
        _nonblank(reasoning_effort) or defaults.reasoning_effort,
        _nonblank(thinking) or defaults.thinking,
        defaults.max_agents,
        defaults.max_steps,
        defaults.error_threshold,
        defaults.max_retries,
        defaults.max_tokens,
    )


# review:P2-T4
@router.post("/runs")
async def create_run(
    body: _CreateBody,
    request: Request,
    x_llm_key: str | None = Header(default=None),
    x_llm_model: str | None = Header(default=None),
    x_llm_base_url: str | None = Header(default=None),
    x_llm_reasoning_effort: str | None = Header(default=None),
    x_llm_thinking: str | None = Header(default=None),
):
    try:
        cfg = RunConfig(
            audience=body.audience,
            content=body.content,
            steps=body.steps,
            platform=body.platform,
            **_resolve_llm_update(
                request,
                x_llm_key,
                x_llm_model,
                x_llm_base_url,
                x_llm_reasoning_effort,
                x_llm_thinking,
            ),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    run_id = request.app.state.store.create(cfg)
    return {"run_id": run_id}


@router.get("/runs/{run_id}/events")
async def stream_events(run_id: str, request: Request):
    store = request.app.state.store
    engine = request.app.state.engine
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")

    async def gen():
        yield _sse(
            "run_started",
            {
                "run_id": run_id,
                "steps": record.config.steps,
                "platform": record.config.platform.value,
                "seed_post_id": record.snapshot.seed_post_id,
            },
        )
        try:
            async for delta in engine.run(record.config):
                yield _sse(
                    "step_started",
                    {"step": delta.step, "total": record.config.steps},
                )
                record.accumulate(delta.snapshot)
                yield _sse(
                    "delta",
                    {
                        "step": delta.step,
                        "snapshot": delta.snapshot.model_dump(mode="json"),
                    },
                )
                yield _sse("step_done", {"step": delta.step})
            yield _sse("run_done", {"run_id": run_id})
        except Exception as exc:  # noqa: BLE001
            yield _sse("error", {"message": str(exc)})

    return StreamingResponse(gen(), media_type="text/event-stream")


# review:P2-T5
@router.post("/runs/{run_id}/interview")
async def interview(run_id: str, body: _InterviewBody, request: Request):
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    if body.actor_id not in seed_engaged_actor_ids(record.snapshot):
        raise HTTPException(status_code=404, detail="run or actor not found")
    answer = await request.app.state.engine.interview(
        record.config,
        record.snapshot,
        body.actor_id,
        body.question,
    )
    return {"actor_id": body.actor_id, "question": body.question, "answer": answer}


@router.get("/runs/{run_id}/snapshot")
async def snapshot(run_id: str, request: Request):
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return record.snapshot.model_dump(mode="json")


@router.get("/runs/{run_id}/retro")
async def retro(run_id: str, request: Request):  # review:P5-T1
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return compute_metrics(record.snapshot).model_dump()


@router.post("/runs/{run_id}/insights")
async def insights(
    run_id: str,
    request: Request,
    x_llm_key: str | None = Header(default=None),
    x_llm_model: str | None = Header(default=None),
    x_llm_base_url: str | None = Header(default=None),
    x_llm_reasoning_effort: str | None = Header(default=None),
    x_llm_thinking: str | None = Header(default=None),
):  # review:P5-T2
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    config = record.config.model_copy(
        update=_resolve_llm_update(
            request,
            x_llm_key,
            x_llm_model,
            x_llm_base_url,
            x_llm_reasoning_effort,
            x_llm_thinking,
        )
    )
    return generate_insights(record.snapshot, config).model_dump()
