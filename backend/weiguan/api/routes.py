from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ValidationError
from sse_starlette.sse import EventSourceResponse

from weiguan.canonical import Platform
from weiguan.engine.config import Audience, RunConfig

router = APIRouter(prefix="/api")


class _CreateBody(BaseModel):
    audience: Audience
    content: str
    steps: int
    platform: Platform = Platform.TWITTER


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
        yield {
            "event": "run_started",
            "data": json.dumps(
                {
                    "run_id": run_id,
                    "steps": record.config.steps,
                    "platform": record.config.platform.value,
                    "seed_post_id": record.snapshot.seed_post_id,
                }
            ),
        }
        try:
            async for delta in engine.run(record.config):
                yield {
                    "event": "step_started",
                    "data": json.dumps(
                        {"step": delta.step, "total": record.config.steps}
                    ),
                }
                record.accumulate(delta.snapshot)
                yield {
                    "event": "delta",
                    "data": json.dumps(
                        {
                            "step": delta.step,
                            "snapshot": delta.snapshot.model_dump(mode="json"),
                        }
                    ),
                }
                yield {
                    "event": "step_done",
                    "data": json.dumps({"step": delta.step}),
                }
            yield {"event": "run_done", "data": json.dumps({"run_id": run_id})}
        except Exception as exc:  # noqa: BLE001
            yield {"event": "error", "data": json.dumps({"message": str(exc)})}

    return EventSourceResponse(gen())
