from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

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


# review:P2-T4
@router.post("/runs")
async def create_run(
    body: _CreateBody,
    request: Request,
    x_llm_key: str | None = Header(default=None),
    x_llm_model: str = Header(default="gpt-4o-mini"),
):
    if not x_llm_key:
        raise HTTPException(status_code=401, detail="missing X-LLM-Key")
    try:
        cfg = RunConfig(
            audience=body.audience,
            content=body.content,
            steps=body.steps,
            platform=body.platform,
            llm_key=x_llm_key,
            llm_model=x_llm_model,
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
