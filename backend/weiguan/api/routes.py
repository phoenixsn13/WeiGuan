from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

from weiguan.api.llm_defaults import LlmDefaults
from weiguan.analysis.insights import generate_insights
from weiguan.analysis.retro import compute_metrics, seed_engaged_actor_ids
from weiguan.analysis.social_metrics.projection import analyze
from weiguan.canonical import Platform
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.crowds import list_crowds
from weiguan.world.models import PersonaKind
from weiguan.world.orchestrator import PlatformRunSpec, WorldOrchestrator

router = APIRouter(prefix="/api")


@router.get("/crowds")
async def crowds():  # review:P4-T1
    return list_crowds()


class _CreateBody(BaseModel):
    audience: Audience
    content: str
    steps: int
    platform: Platform = Platform.TWITTER
    world_id: str | None = None
    poster_persona: PersonaKind = PersonaKind.ORDINARY
    poster_person_id: str | None = None
    person_memory_budget: int = 4


class _CreateWorldBody(BaseModel):
    persistent: bool = False


class _OrchestrateBody(BaseModel):
    specs: list[PlatformRunSpec]


class _CreatePersonBody(BaseModel):
    world_id: str | None = None
    display_name: str
    persona_kind: PersonaKind
    platform: Platform = Platform.TWITTER
    handle: str


class _InterviewBody(BaseModel):
    actor_id: int
    question: str


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


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
    cost_budget_rmb: float | None = None,
    oasis_max_rec_post_len: int | None = None,
    oasis_refresh_rec_post_count: int | None = None,
    oasis_following_post_count: int | None = None,
    oasis_llm_semaphore: int | None = None,
    attention_comment_budget: int | None = None,
) -> dict:
    update = {
        "llm_key": key,
        "llm_model": model,
        "llm_base_url": base_url,
        "llm_reasoning_effort": reasoning_effort,
        "llm_thinking": _nonblank(thinking),
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
    if cost_budget_rmb is not None:
        update["llm_cost_budget_rmb"] = cost_budget_rmb
    if oasis_max_rec_post_len is not None:
        update["oasis_max_rec_post_len"] = oasis_max_rec_post_len
    if oasis_refresh_rec_post_count is not None:
        update["oasis_refresh_rec_post_count"] = oasis_refresh_rec_post_count
    if oasis_following_post_count is not None:
        update["oasis_following_post_count"] = oasis_following_post_count
    if oasis_llm_semaphore is not None:
        update["oasis_llm_semaphore"] = oasis_llm_semaphore
    if attention_comment_budget is not None:
        update["attention_comment_budget"] = attention_comment_budget
    return update


def _resolve_llm_update(
    request: Request,
    key: str | None,
    model: str | None,
    base_url: str | None,
    reasoning_effort: str | None,
    thinking: str | None,
    max_steps: int | None = None,
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
        max_steps if max_steps is not None else defaults.max_steps,
        defaults.error_threshold,
        defaults.max_retries,
        defaults.max_tokens,
        defaults.cost_budget_rmb,
        defaults.oasis_max_rec_post_len,
        defaults.oasis_refresh_rec_post_count,
        defaults.oasis_following_post_count,
        defaults.oasis_llm_semaphore,
        defaults.attention_comment_budget,
    )


def _run_summary(record) -> dict:
    metrics = compute_metrics(record.snapshot)
    return {
        "run_id": record.run_id,
        "world_id": record.config.world_id,
        "poster_person_id": record.config.poster_person_id,
        "poster_persona": record.config.poster_persona.value,
        "content": record.config.content,
        "steps": record.config.steps,
        "platform": record.config.platform.value,
        "status": record.status,
        "current_step": record.current_step,
        "created_at": record.created_at,
        "totals": metrics.totals,
    }


@router.post("/worlds")
async def create_world(body: _CreateWorldBody, request: Request):  # review:P6-T8
    return request.app.state.world_store.create_world(
        persistent=body.persistent
    ).model_dump(mode="json")


@router.get("/worlds/{world_id}")
async def get_world(world_id: str, request: Request):
    world = request.app.state.world_store.get_world(world_id)
    if world is None:
        raise HTTPException(status_code=404, detail="world not found")
    return world.model_dump(mode="json")


@router.post("/worlds/{world_id}/orchestrate")
async def orchestrate_world(  # review:P9-T3
    world_id: str, body: _OrchestrateBody, request: Request
):
    if request.app.state.world_store.get_world(world_id) is None:
        raise HTTPException(status_code=404, detail="world not found")
    engine_builder = getattr(
        request.app.state,
        "orchestrator_engine_builder",
        lambda spec: request.app.state.engine,
    )
    orchestrator = WorldOrchestrator(request.app.state.world_store, engine_builder)
    events = [event async for event in orchestrator.orchestrate(world_id, body.specs)]
    frames = request.app.state.world_store.read_world_events(world_id)
    return {
        "events": events,
        "frames": [event.model_dump(mode="json") for event in frames],
    }


@router.get("/worlds/{world_id}/persons")
async def list_world_persons(world_id: str, request: Request):  # review:P7-T2
    if request.app.state.world_store.get_world(world_id) is None:
        raise HTTPException(status_code=404, detail="world not found")
    return {
        "persons": [
            view.model_dump(mode="json")
            for view in request.app.state.world_store.list_persons(world_id)
        ]
    }


@router.get("/identities")
async def list_identities(request: Request):  # review:P7-T11
    return {
        "identities": [
            identity.model_dump(mode="json")
            for identity in request.app.state.world_store.list_identities()
        ]
    }


@router.post("/persons")
async def create_person(body: _CreatePersonBody, request: Request):
    world_id = body.world_id
    if world_id is None:
        world_id = request.app.state.world_store.create_world(persistent=True).world_id
    elif request.app.state.world_store.get_world(world_id) is None:
        raise HTTPException(status_code=404, detail="world not found")
    person = request.app.state.world_store.create_person(
        world_id,
        display_name=body.display_name,
        persona_kind=body.persona_kind,
        platform=body.platform,
        handle=body.handle,
    )
    return {"world_id": world_id, "person": person.model_dump(mode="json")}


@router.get("/persons/{person_id}")
async def get_person(person_id: str, world_id: str, request: Request):
    view = request.app.state.world_store.get_person_view(world_id, person_id)
    if view is None:
        raise HTTPException(status_code=404, detail="person not found")
    return view.model_dump(mode="json")


@router.get("/runs/preview-cost")
async def preview_cost(
    steps: int,
    llm_max_agents: int = 8,
    attention_comment_budget: int = 12,
    person_memory_budget: int = 4,
):
    try:
        config = RunConfig(
            audience=Audience(crowd_id="preview"),
            content="preview",
            steps=steps,
            llm_key="preview",
            llm_model="preview",
            llm_max_agents=llm_max_agents,
            attention_comment_budget=attention_comment_budget,
            person_memory_budget=person_memory_budget,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "estimated_rmb": config.estimate_llm_cost_rmb(),
        "budgeted_agents": config.budgeted_llm_max_agents,
        "decision_steps": config.llm_decision_steps,
    }


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
    x_llm_max_steps: int | None = Header(default=None),
):
    try:
        cfg = RunConfig(
            audience=body.audience,
            content=body.content,
            steps=body.steps,
            platform=body.platform,
            world_id=body.world_id,
            poster_persona=body.poster_persona,
            poster_person_id=body.poster_person_id,
            person_memory_budget=body.person_memory_budget,
            **_resolve_llm_update(
                request,
                x_llm_key,
                x_llm_model,
                x_llm_base_url,
                x_llm_reasoning_effort,
                x_llm_thinking,
                x_llm_max_steps,
            ),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    run_id = request.app.state.store.create(cfg)
    request.app.state.runner.start(run_id)
    return {"run_id": run_id}


@router.get("/runs/{run_id}/frames")
async def run_frames(run_id: str, request: Request):
    if request.app.state.store.get(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    frames = request.app.state.world_store.read_frames(run_id)
    return {"frames": [event.model_dump(mode="json") for event in frames]}


@router.get("/runs")
async def list_runs(request: Request):  # review:UI-P1
    return [_run_summary(record) for record in request.app.state.store.list()]


@router.get("/runs/{run_id}")
async def get_run(run_id: str, request: Request):  # review:UI-P12
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return _run_summary(record)


@router.get("/runs/{run_id}/events")
async def stream_events(run_id: str, request: Request):
    store = request.app.state.store
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")

    async def gen():
        queue = request.app.state.runner.subscribe(run_id)
        yield _sse(
            "run_started",
            {
                "run_id": run_id,
                "steps": record.config.effective_steps,
                "platform": record.config.platform.value,
                "seed_post_id": record.snapshot.seed_post_id,
            },
        )
        try:
            current = store.get(run_id)
            if current is None:
                yield _sse("error", {"message": "run not found"})
                return
            if current.snapshot.seed_post_id is not None or current.current_step > 0:
                yield _sse(
                    "snapshot",
                    {
                        "step": current.current_step,
                        "snapshot": current.snapshot.model_dump(mode="json"),
                    },
                )
            if current.status == "done":
                yield _sse("run_done", {"run_id": run_id})
                return
            if current.status == "error":
                yield _sse("error", {"message": current.error or "run failed"})
                return
            if not request.app.state.runner.is_active(run_id):
                return

            while True:
                event = await queue.get()
                if event.kind == "snapshot" and event.snapshot is not None:
                    yield _sse(
                        "snapshot",
                        {
                            "step": event.step,
                            "snapshot": event.snapshot.model_dump(mode="json"),
                        },
                    )
                elif event.kind == "done":
                    yield _sse("run_done", {"run_id": run_id})
                    return
                elif event.kind == "error":
                    yield _sse("error", {"message": event.message or "run failed"})
                    return
        finally:
            request.app.state.runner.unsubscribe(run_id, queue)

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


@router.get("/runs/{run_id}/analysis")
async def analysis(run_id: str, request: Request):  # review:P8-T5
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return analyze(record.snapshot).model_dump(mode="json")


@router.get("/runs/{run_id}/insights")
async def saved_insights(run_id: str, request: Request):  # review:UI-P16
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    if record.insights is None:
        raise HTTPException(status_code=404, detail="insights not found")
    return record.insights


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
    generated = generate_insights(record.snapshot, config).model_dump()
    record.insights = generated
    request.app.state.store.save()
    return generated
