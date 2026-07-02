from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from weiguan.api.llm_defaults import LlmDefaults
from weiguan.api.routes import router
from weiguan.api.runner import RunRunner
from weiguan.api.store import RunStore
from weiguan.engine.base import Engine


# review:P2-T4
def create_app(
    engine: Engine,
    llm_defaults: LlmDefaults | None = None,
    store_path: str | Path | None = None,
) -> FastAPI:
    app = FastAPI(title="围观 Weiguan")
    app.state.engine = engine
    app.state.store = RunStore(store_path)
    app.state.runner = RunRunner(app.state.store, engine)
    app.state.llm_defaults = llm_defaults or LlmDefaults()
    app.include_router(router)
    return app
