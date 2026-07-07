from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

from weiguan.api.runner import SAVE_EVERY_STEPS
from weiguan.api.llm_defaults import LlmDefaults
from weiguan.api.snapshot_window import page_replies_snapshot, window_snapshot
from weiguan.analysis.flavor import FlavorDigest, PlatformFlavor, flavor_digest
from weiguan.analysis.insights import generate_insights
from weiguan.analysis.provider import default_analysis_provider
from weiguan.analysis.retro import compute_metrics, seed_engaged_actor_ids
from weiguan.canonical import Platform
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.crowds import list_crowds
from weiguan.obs.collect import collect
from weiguan.world.naming import resolve_world_name
from weiguan.world.models import Launch, PersonaKind
from weiguan.world.orchestrator import PlatformRunSpec, WorldOrchestrator
from weiguan.world.run_bridge import ensure_world_for_run

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


class _RunStoreRecorder:  # review:P12-T6
    def __init__(self, store) -> None:
        self._store = store

    def on_delta(self, run_id: str, delta) -> None:
        record = self._store.get(run_id)
        if record is None:
            return
        record.accumulate(delta.snapshot)
        record.current_step = delta.step
        if delta.step == 1 or delta.step % SAVE_EVERY_STEPS == 0:
            self._store.save()

    def on_done(self, run_id: str) -> None:
        record = self._store.get(run_id)
        if record is None:
            return
        record.status = "done"
        record.current_step = record.config.effective_steps
        self._store.save()

    def on_error(self, run_id: str, message: str) -> None:
        record = self._store.get(run_id)
        if record is None:
            return
        record.status = "error"
        record.error = message
        self._store.save()


@router.get("/crowds")
def crowds():  # review:P4-T1
    return list_crowds()


class _CreateBody(BaseModel):
    audience: Audience
    content: str
    steps: int
    platform: Platform = Platform.TWITTER
    world_id: str | None = None
    world_name: str | None = None
    poster_persona: PersonaKind = PersonaKind.ORDINARY
    poster_person_id: str | None = None
    person_memory_budget: int = 4


class _CreateWorldBody(BaseModel):
    persistent: bool = False
    world_name: str | None = None


class _OrchestrateBody(BaseModel):
    specs: list[PlatformRunSpec]


class _MultiRunBody(BaseModel):
    content: str
    audience: Audience
    persona: PersonaKind = PersonaKind.ORDINARY
    platforms: list[Platform]
    steps: int
    world_id: str | None = None
    world_name: str | None = None
    poster_person_id: str | None = None
    person_memory_budget: int = 4


class _CreatePersonBody(BaseModel):
    world_id: str | None = None
    world_name: str | None = None
    display_name: str
    persona_kind: PersonaKind
    platform: Platform = Platform.TWITTER
    handle: str


class _InterviewBody(BaseModel):
    actor_id: int
    question: str


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _drain_world_orchestrator(
    orchestrator: WorldOrchestrator,
    world_store,
    world_id: str,
    specs: list[PlatformRunSpec],
    launch_id: str | None = None,
) -> None:
    try:
        async for _ in orchestrator.orchestrate(world_id, specs):
            pass
        if launch_id is not None:
            world = world_store.get_world(world_id)
            world_store.update_launch(
                world_id,
                launch_id,
                status="done",
                clock_tick=world.clock_tick if world else 0,
            )
    except Exception as exc:  # noqa: BLE001
        if launch_id is not None:
            world = world_store.get_world(world_id)
            world_store.update_launch(
                world_id,
                launch_id,
                status="error",
                error=str(exc),
                clock_tick=world.clock_tick if world else 0,
            )
        logger.exception("multi-platform world orchestration failed", extra={"world_id": world_id})


def _schedule_world_orchestration(
    request: Request,
    world_id: str,
    specs: list[PlatformRunSpec],
    engine_builder,
    launch_id: str | None = None,
    run_recorder=None,
) -> None:
    orchestrator = WorldOrchestrator(
        request.app.state.world_store,
        engine_builder,
        metric_sink=getattr(request.app.state, "metric_sink", None),
        run_recorder=run_recorder,
    )

    async def run_in_worker_thread() -> None:
        await asyncio.to_thread(
            lambda: asyncio.run(
                _drain_world_orchestrator(
                    orchestrator,
                    request.app.state.world_store,
                    world_id,
                    specs,
                    launch_id,
                )
            )
        )

    task_factory = getattr(request.app.state, "world_task_factory", asyncio.create_task)
    task_factory(run_in_worker_thread())


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


def _multi_launch_summary(launch: Launch) -> dict:  # review:P12-T5
    data = launch.model_dump(mode="json")
    data["kind"] = "multi" if len(launch.platforms) > 1 or len(launch.run_ids) > 1 else "single"  # review:P15-T2
    return data


def _latest_launch_item(launch: Launch) -> dict:
    return {
        "content": launch.content,
        "created_at": launch.created_at,
        "status": launch.status,
        "run_ids": launch.run_ids,
        "launch_id": launch.launch_id,
    }


def _world_summary(world, *, world_store, run_store) -> dict:  # review:P15-T2
    launches = world_store.list_launches(world.world_id)
    records = [
        record
        for record in run_store.list()
        if record.config.world_id == world.world_id
    ]
    latest_launch = launches[0] if launches else None
    latest = _latest_launch_item(latest_launch) if latest_launch is not None else None

    persons = world_store.list_persons(world.world_id)
    primary = max(
        persons,
        key=lambda view: (view.total_influence, view.person.display_name),
        default=None,
    )
    run_ids = {run_id for launch in launches for run_id in launch.run_ids}
    run_ids.update(record.run_id for record in records)
    platforms = {platform for launch in launches for platform in launch.platforms}
    platforms.update(record.config.platform for record in records)
    name = resolve_world_name(
        name=world.name,
        latest_content=latest["content"] if latest else None,
        primary_identity_name=primary.person.display_name if primary else None,
        created_at=world.created_at,
    )
    return {
        "world_id": world.world_id,
        "name": name,
        "primary_identity_person_id": primary.person.person_id if primary else None,
        "primary_identity_name": primary.person.display_name if primary else None,
        "identity_count": len(persons),
        "total_influence": sum(view.total_influence for view in persons),
        "platform_count": len(platforms),
        "run_count": len(run_ids),
        "latest": latest,
        "created_at": world.created_at,
    }


def _bridge_notes(request: Request, world_id: str | None) -> list[str]:
    if world_id is None or request.app.state.world_store.get_world(world_id) is None:
        return []
    notes: list[str] = []
    for event in request.app.state.world_store.read_world_events(world_id):
        if event.kind.value != "bridge_inject":
            continue
        source = event.payload.get("source_platform")
        content = str(event.payload.get("content") or "").strip()
        notes.append(
            f"第 {event.tick} 拍：{source or 'unknown'} 的讨论被转述到 {event.platform.value}"
            + (f"：{content}" if content else "")
        )
    return notes


def _flavor_for_records(records, *, world_id: str | None, request: Request) -> FlavorDigest:
    platforms: list[PlatformFlavor] = []
    run_ids: list[str] = []
    for record in records:
        run_ids.append(record.run_id)
        platforms.extend(flavor_digest(record.snapshot).platforms)
    return FlavorDigest(
        world_id=world_id,
        run_ids=run_ids,
        platforms=platforms,
        cross_platform_notes=_bridge_notes(request, world_id),
    )


@router.post("/worlds")
async def create_world(body: _CreateWorldBody, request: Request):  # review:P6-T8
    return request.app.state.world_store.create_world(
        persistent=body.persistent,
        name=_nonblank(body.world_name),
    ).model_dump(mode="json")


@router.get("/worlds")
def world_list(request: Request):  # review:P14-T2
    world_store = request.app.state.world_store
    run_store = request.app.state.store
    worlds = [
        _world_summary(world, world_store=world_store, run_store=run_store)
        for world in world_store.list_worlds(persistent=True)
    ]
    return {
        "worlds": sorted(
            worlds,
            key=lambda item: (item["latest"] or {}).get("created_at") or item["created_at"],
            reverse=True,
        )
    }


@router.get("/worlds/{world_id}")
def get_world(world_id: str, request: Request):
    world = request.app.state.world_store.get_world(world_id)
    if world is None:
        raise HTTPException(status_code=404, detail="world not found")
    return world.model_dump(mode="json")


@router.get("/worlds/{world_id}/events")
def world_events(world_id: str, request: Request, after: int = 0):  # review:P11-T1
    world = request.app.state.world_store.get_world(world_id)
    if world is None:
        raise HTTPException(status_code=404, detail="world not found")
    run_ids = set(request.query_params.getlist("run_id"))
    frames, next_after = request.app.state.world_store.read_world_events_page(
        world_id,
        after=after,
        run_ids=run_ids or None,
    )
    launch = request.app.state.world_store.find_launch_for_runs(world_id, run_ids)
    launch_status = (
        launch.status if launch is not None and set(launch.run_ids) == run_ids else None
    )
    return {  # review:P12-T1
        "frames": [event.model_dump(mode="json") for event in frames],
        "next_after": next_after,
        "clock_tick": world.clock_tick,
        "launch_status": launch_status,
    }


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
    orchestrator = WorldOrchestrator(
        request.app.state.world_store,
        engine_builder,
        metric_sink=getattr(request.app.state, "metric_sink", None),
    )
    events = [event async for event in orchestrator.orchestrate(world_id, body.specs)]
    frames = request.app.state.world_store.read_world_events(world_id)
    return {
        "events": events,
        "frames": [event.model_dump(mode="json") for event in frames],
    }


@router.post("/multi-runs")
async def create_multi_run(  # review:P11-T2
    body: _MultiRunBody,
    request: Request,
    x_llm_key: str | None = Header(default=None),
    x_llm_model: str | None = Header(default=None),
    x_llm_base_url: str | None = Header(default=None),
    x_llm_reasoning_effort: str | None = Header(default=None),
    x_llm_thinking: str | None = Header(default=None),
    x_llm_max_steps: int | None = Header(default=None),
):
    platforms = list(dict.fromkeys(body.platforms))
    if not platforms:
        raise HTTPException(status_code=400, detail="platforms must not be empty")

    world_store = request.app.state.world_store
    if body.world_id is not None:
        world = world_store.get_world(body.world_id)
        if world is None:
            raise HTTPException(status_code=404, detail="world not found")
        world = world_store.persist_world(world.world_id) or world
    else:
        world = world_store.create_world(
            persistent=True,
            name=_nonblank(body.world_name),
        )

    specs: list[PlatformRunSpec] = []
    run_ids: list[str] = []
    person_id = body.poster_person_id
    try:
        llm_update = _resolve_llm_update(
            request,
            x_llm_key,
            x_llm_model,
            x_llm_base_url,
            x_llm_reasoning_effort,
            x_llm_thinking,
            x_llm_max_steps,
        )
        for platform in platforms:
            run_id = f"{world.world_id}:{platform.value}:{uuid4().hex}"
            config = RunConfig(
                audience=body.audience,
                content=body.content,
                steps=body.steps,
                platform=platform,
                world_id=world.world_id,
                world_name=body.world_name,
                poster_persona=body.persona,
                poster_person_id=person_id,
                person_memory_budget=body.person_memory_budget,
                **llm_update,
            )
            world, person = ensure_world_for_run(world_store, config)
            person_id = person.person_id
            poster_account = next(
                (account for account in person.accounts if account.platform == platform),
                None,
            )
            if poster_account is None:
                raise HTTPException(
                    status_code=500,
                    detail=f"poster account missing for {platform.value}",
                )
            specs.append(
                PlatformRunSpec(
                    platform=platform,
                    config=config.model_copy(
                        update={
                            "world_id": world.world_id,
                            "poster_person_id": person.person_id,
                        }
                    ),
                    poster_account_id=poster_account.account_id,
                    run_id=run_id,
                )
            )
            run_ids.append(run_id)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    engine_builder = getattr(
        request.app.state,
        "orchestrator_engine_builder",
        lambda spec: request.app.state.engine,
    )
    launch_id = f"launch_{uuid4().hex}"
    run_store = request.app.state.store
    for spec in specs:
        run_store.create_with_id(spec.run_id, spec.config, status="running")

    world_store.create_launch(
        Launch(
            launch_id=launch_id,
            world_id=world.world_id,
            content=body.content,
            steps=body.steps,
            platforms=platforms,
            run_ids=run_ids,
            status="running",
            poster_person_id=person_id,
            poster_persona=body.persona,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    _schedule_world_orchestration(
        request,
        world.world_id,
        specs,
        engine_builder,
        launch_id=launch_id,
        run_recorder=_RunStoreRecorder(run_store),
    )  # review:P11-T7
    return {"world_id": world.world_id, "run_ids": run_ids, "launch_id": launch_id}


@router.get("/launches")
def list_launches(request: Request):  # review:P15-T2
    launches = [
        _multi_launch_summary(launch)
        for launch in request.app.state.world_store.list_all_launches()
    ]
    return {
        "launches": sorted(
            launches,
            key=lambda item: item["created_at"],
            reverse=True,
        )
    }


@router.get("/worlds/{world_id}/persons")
def list_world_persons(world_id: str, request: Request):  # review:P7-T2
    if request.app.state.world_store.get_world(world_id) is None:
        raise HTTPException(status_code=404, detail="world not found")
    return {
        "persons": [
            view.model_dump(mode="json")
            for view in request.app.state.world_store.list_persons(world_id)
        ]
    }


@router.get("/identities")
def list_identities(request: Request):  # review:P7-T11
    return {
        "identities": [
            identity.model_dump(mode="json")
            for identity in request.app.state.world_store.list_identities()
        ]
    }


@router.post("/persons")
def create_person(body: _CreatePersonBody, request: Request):
    world_id = body.world_id
    if world_id is None:
        world_id = request.app.state.world_store.create_world(
            persistent=True,
            name=_nonblank(body.world_name),
        ).world_id
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
def get_person(person_id: str, world_id: str, request: Request):
    view = request.app.state.world_store.get_person_view(world_id, person_id)
    if view is None:
        raise HTTPException(status_code=404, detail="person not found")
    return view.model_dump(mode="json")


@router.get("/runs/preview-cost")
def preview_cost(
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
            world_name=body.world_name,
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
    world_store = request.app.state.world_store
    world, person = ensure_world_for_run(world_store, cfg)  # review:P15-T1
    cfg = cfg.model_copy(update={"world_id": world.world_id, "poster_person_id": person.person_id})
    run_id = request.app.state.store.create(cfg)
    launch_id = f"launch_{uuid4().hex}"
    world_store.create_launch(
        Launch(
            launch_id=launch_id,
            world_id=world.world_id,
            content=cfg.content,
            steps=cfg.steps,
            platforms=[cfg.platform],
            run_ids=[run_id],
            status="running",
            poster_person_id=person.person_id,
            poster_persona=cfg.poster_persona,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    request.app.state.runner.start(run_id)
    return {"run_id": run_id, "launch_id": launch_id}


@router.get("/runs/{run_id}/frames")
def run_frames(run_id: str, request: Request):
    if request.app.state.store.get(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    frames = request.app.state.world_store.read_frames(run_id)
    return {"frames": [event.model_dump(mode="json") for event in frames]}


@router.get("/runs")
def list_runs(request: Request):  # review:UI-P1
    return [_run_summary(record) for record in request.app.state.store.list()]


@router.get("/runs/{run_id}")
def get_run(run_id: str, request: Request):  # review:UI-P12
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
def snapshot(
    run_id: str,
    request: Request,
    tail: int | None = None,
    replies_offset: int | None = None,
    replies_limit: int | None = None,
):
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    has_reply_page = replies_offset is not None or replies_limit is not None
    if tail is not None and has_reply_page:
        raise HTTPException(
            status_code=400,
            detail="tail and replies page are mutually exclusive",
        )
    if tail is not None:
        if tail < 0:
            raise HTTPException(status_code=400, detail="tail must be non-negative")
        return window_snapshot(record.snapshot, tail=tail)
    if has_reply_page:
        if replies_offset is None or replies_limit is None:
            raise HTTPException(
                status_code=400,
                detail="replies_offset and replies_limit are required",
            )
        if replies_offset < 0 or replies_limit < 1:
            raise HTTPException(status_code=400, detail="invalid replies page")
        return page_replies_snapshot(
            record.snapshot,
            replies_offset=replies_offset,
            replies_limit=replies_limit,
        )
    return record.snapshot.model_dump(mode="json")


@router.get("/runs/{run_id}/retro")
def retro(run_id: str, request: Request):  # review:P5-T1
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return compute_metrics(record.snapshot).model_dump()


@router.get("/runs/{run_id}/analysis")
def analysis(run_id: str, request: Request):  # review:P8-T5
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return default_analysis_provider().analyze(record.snapshot).model_dump(mode="json")  # review:P10-T1


@router.get("/runs/{run_id}/flavor")
def flavor(run_id: str, request: Request, world_id: str | None = None):  # review:P10-T3
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    if world_id:
        records = [
            item
            for item in request.app.state.store.list()
            if item.config.world_id == world_id
        ]
        return _flavor_for_records(records, world_id=world_id, request=request).model_dump(
            mode="json"
        )
    return _flavor_for_records([record], world_id=record.config.world_id, request=request).model_dump(
        mode="json"
    )


@router.get("/runs/{run_id}/perf")
def perf(run_id: str, request: Request):  # review:P10-T5
    sink = getattr(request.app.state, "metric_sink", None)
    metrics = [
        metric
        for metric in getattr(sink, "metrics", [])
        if metric.run_id == run_id
    ]
    return collect(metrics).model_dump(mode="json")


@router.get("/runs/{run_id}/insights")
def saved_insights(run_id: str, request: Request):  # review:UI-P16
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    if record.insights is None:
        raise HTTPException(status_code=404, detail="insights not found")
    return record.insights


@router.post("/runs/{run_id}/insights")
def insights(
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
