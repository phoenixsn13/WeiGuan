from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from weiguan.api.llm_defaults import LlmDefaults
from weiguan.api.routes import router
from weiguan.api.runner import RunRunner
from weiguan.api.store import RunStore
from weiguan.engine.base import Engine
from weiguan.world.store import WorldStore


# review:P2-T4
def create_app(
    engine: Engine,
    llm_defaults: LlmDefaults | None = None,
    store_path: str | Path | None = None,
    world_store: WorldStore | None = None,
) -> FastAPI:
    app = FastAPI(title="围观 Weiguan")
    path = Path(store_path) if store_path is not None else None
    workdir = path.parent if path is not None else Path(".weiguan")
    app.state.engine = engine
    app.state.store = RunStore(path)
    app.state.world_store = world_store or WorldStore(str(workdir))
    app.state.runner = RunRunner(app.state.store, engine, world_store=app.state.world_store)
    app.state.llm_defaults = llm_defaults or LlmDefaults()
    app.include_router(router)
    return app
