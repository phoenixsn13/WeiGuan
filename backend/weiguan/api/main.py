from __future__ import annotations

import os
import tempfile
import uuid

from weiguan.api.app import create_app
from weiguan.engine.custom_profile import generate_custom_profile
from weiguan.engine.oasis_engine import OasisEngine
from weiguan.engine.routing import RoutingEngine, make_resolver

WORKDIR = os.environ.get("WEIGUAN_WORKDIR", tempfile.mkdtemp(prefix="weiguan-"))


def _build_engine(profile_path: str) -> OasisEngine:
    per_run_dir = os.path.join(WORKDIR, "runs", uuid.uuid4().hex)
    os.makedirs(per_run_dir, exist_ok=True)
    return OasisEngine(profile_path, per_run_dir)


# review:PA-T1
app = create_app(
    RoutingEngine(
        make_resolver(WORKDIR, generate_custom_profile),
        _build_engine,
    )
)
