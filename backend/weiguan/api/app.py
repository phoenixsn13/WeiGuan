from __future__ import annotations

from fastapi import FastAPI

from weiguan.api.routes import router
from weiguan.api.store import RunStore
from weiguan.engine.base import Engine


# review:P2-T4
def create_app(engine: Engine) -> FastAPI:
    app = FastAPI(title="围观 Weiguan")
    app.state.engine = engine
    app.state.store = RunStore()
    app.include_router(router)
    return app
