from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import AsyncIterator

from weiguan.adapter.oasis_adapter import load_run_snapshot
from weiguan.canonical import Platform, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.config import RunConfig
from weiguan.engine.diff import diff_snapshots


# review:P2-T6  真实 OASIS+LLM 引擎
class OasisEngine:
    def __init__(self, profile_path: str, db_dir: str) -> None:
        self.profile_path = profile_path
        self.db_dir = db_dir
        self.last_snapshot = RunSnapshot()
        self._db_path: str | None = None
        self._env = None

    def _repo_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    def _ensure_oasis_import_path(self) -> None:
        root = str(self._repo_root())
        if root not in sys.path:
            sys.path.insert(0, root)

    def _deps(self):
        self._ensure_oasis_import_path()
        from camel.models import ModelFactory
        from camel.types import ModelPlatformType, ModelType
        import oasis
        from oasis import (
            ActionType,
            LLMAction,
            ManualAction,
            generate_twitter_agent_graph,
        )

        return {
            "ActionType": ActionType,
            "LLMAction": LLMAction,
            "ManualAction": ManualAction,
            "ModelFactory": ModelFactory,
            "ModelPlatformType": ModelPlatformType,
            "ModelType": ModelType,
            "generate_twitter_agent_graph": generate_twitter_agent_graph,
            "oasis": oasis,
        }

    def _model(self, config: RunConfig):
        deps = self._deps()
        os.environ["OPENAI_API_KEY"] = config.llm_key
        try:
            return deps["ModelFactory"].create(
                model_platform=deps["ModelPlatformType"].OPENAI,
                model_type=deps["ModelType"].GPT_4O_MINI,
                api_key=config.llm_key,
            )
        except TypeError:
            return deps["ModelFactory"].create(
                model_platform=deps["ModelPlatformType"].OPENAI,
                model_type=deps["ModelType"].GPT_4O_MINI,
            )

    async def _make_env(self, config: RunConfig):
        deps = self._deps()
        model = self._model(config)
        action_type = deps["ActionType"]
        graph = await deps["generate_twitter_agent_graph"](
            profile_path=self.profile_path,
            model=model,
            available_actions=[
                action_type.CREATE_POST,
                action_type.CREATE_COMMENT,
                action_type.LIKE_POST,
                action_type.DISLIKE_POST,
                action_type.REPOST,
                action_type.FOLLOW,
                action_type.DO_NOTHING,
            ],
        )
        db_path = os.path.join(self.db_dir, "run.db")
        if os.path.exists(db_path):
            os.remove(db_path)
        os.environ["OASIS_DB_PATH"] = os.path.abspath(db_path)
        oasis = deps["oasis"]
        env = oasis.make(
            agent_graph=graph,
            platform=oasis.DefaultPlatformType.TWITTER,
            database_path=db_path,
        )
        return env, db_path

    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        deps = self._deps()
        env, db_path = await self._make_env(config)
        await env.reset()
        action_type = deps["ActionType"]
        await env.step(
            {
                env.agent_graph.get_agent(0): deps["ManualAction"](
                    action_type=action_type.CREATE_POST,
                    action_args={"content": config.content},
                )
            }
        )
        prev = RunSnapshot()
        for step in range(1, config.steps + 1):
            if step > 1:
                await env.step(
                    {agent: deps["LLMAction"]() for _, agent in env.agent_graph.get_agents()}
                )
            curr = load_run_snapshot(
                db_path,
                platform=Platform.TWITTER,
                seed_post_id=1,
            )
            yield RunDelta(step=step, snapshot=diff_snapshots(prev, curr))
            prev = curr
        self.last_snapshot = prev
        self._db_path = db_path
        self._env = env
        await env.close()

    async def interview(
        self,
        config,
        snapshot,
        actor_id,
        question,
    ) -> str:
        deps = self._deps()
        env, db_path = await self._make_env(config)
        await env.reset()
        action_type = deps["ActionType"]
        await env.step(
            {
                env.agent_graph.get_agent(actor_id - 1): deps["ManualAction"](
                    action_type=action_type.INTERVIEW,
                    action_args={"prompt": question},
                )
            }
        )
        await env.close()
        conn = sqlite3.connect(db_path)
        try:
            rows = conn.execute(
                "SELECT info FROM trace WHERE action=? ORDER BY created_at DESC",
                (action_type.INTERVIEW.value,),
            ).fetchall()
        finally:
            conn.close()
        if not rows:
            return ""
        return json.loads(rows[0][0]).get("response", "")
