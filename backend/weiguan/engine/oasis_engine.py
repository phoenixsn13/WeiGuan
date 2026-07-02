from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path
from typing import AsyncIterator

from weiguan.adapter.oasis_adapter import load_run_snapshot
from weiguan.analysis.attention_context import (
    AttentionContextConfig,
    build_attention_context,
)
from weiguan.canonical import Platform, RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.config import RunConfig
from weiguan.engine.crowds import crowd_instruction
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
        from oasis.social_platform.channel import Channel
        from oasis.social_platform.platform import Platform

        return {
            "ActionType": ActionType,
            "Channel": Channel,
            "LLMAction": LLMAction,
            "ManualAction": ManualAction,
            "ModelFactory": ModelFactory,
            "ModelPlatformType": ModelPlatformType,
            "ModelType": ModelType,
            "Platform": Platform,
            "generate_twitter_agent_graph": generate_twitter_agent_graph,
            "oasis": oasis,
        }

    def _model(self, config: RunConfig):
        deps = self._deps()
        os.environ["OPENAI_API_KEY"] = config.llm_key
        if config.llm_base_url:
            os.environ["OPENAI_BASE_URL"] = config.llm_base_url
        if config.llm_reasoning_effort:
            os.environ["OPENAI_REASONING_EFFORT"] = config.llm_reasoning_effort
        if config.llm_thinking_enabled:
            os.environ["OPENAI_THINKING"] = "enabled"
        model_platform = deps["ModelPlatformType"].OPENAI
        model_type = deps["ModelType"].GPT_4O_MINI
        if config.llm_base_url:
            model_platform = deps["ModelPlatformType"].OPENAI_COMPATIBLE_MODEL
            model_type = config.llm_model
        model_config: dict[str, object] = {}
        if config.llm_reasoning_effort:
            model_config["reasoning_effort"] = config.llm_reasoning_effort
        if config.llm_thinking_enabled:
            model_config["extra_body"] = {"thinking": {"type": "enabled"}}
        elif (getattr(config, "llm_thinking", None) or "").strip().lower() in {
            "disabled",
            "off",
            "false",
            "0",
        }:
            model_config["extra_body"] = {
                "chat_template_kwargs": {"enable_thinking": False}
            }
        model_config["max_tokens"] = config.llm_max_tokens
        try:
            return deps["ModelFactory"].create(
                model_platform=model_platform,
                model_type=model_type,
                model_config_dict=model_config or None,
                api_key=config.llm_key,
                url=config.llm_base_url,
                max_retries=config.llm_max_retries,
            )
        except TypeError:
            return deps["ModelFactory"].create(
                model_platform=model_platform,
                model_type=model_type,
                model_config_dict=model_config or None,
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
        # review:P2-T7  Avoid DefaultPlatformType.TWITTER's twhin-bert recsys.
        platform = deps["Platform"](
            db_path=db_path,
            channel=deps["Channel"](),
            recsys_type="random",
            max_rec_post_len=config.oasis_max_rec_post_len,
            refresh_rec_post_count=config.oasis_refresh_rec_post_count,
            following_post_count=config.oasis_following_post_count,
        )
        env = oasis.make(
            agent_graph=graph,
            platform=platform,
            database_path=db_path,
            semaphore=config.oasis_llm_semaphore,
        )
        return env, db_path

    def _assert_seed_visible(self, db_path: str, seed_post_id: int = 1) -> None:
        conn = sqlite3.connect(db_path)
        try:
            rows = conn.execute(
                "SELECT COUNT(*) FROM rec WHERE post_id=?",
                (seed_post_id,),
            ).fetchone()
        except sqlite3.Error as exc:
            raise RuntimeError("recommendation table unavailable") from exc
        finally:
            conn.close()
        if not rows or rows[0] <= 0:
            raise RuntimeError("seed post is not visible in recommendations")

    def _pin_seed_to_rec(
        self,
        db_path: str,
        seed_post_id: int = 1,
        seed_author_id: int = 0,
    ) -> None:
        conn = sqlite3.connect(db_path)
        try:
            user_ids = [
                row[0]
                for row in conn.execute(
                    "SELECT user_id FROM user WHERE user_id != ? ORDER BY user_id",
                    (seed_author_id,),
                ).fetchall()
            ]
            conn.executemany(
                "INSERT OR IGNORE INTO rec (user_id, post_id) VALUES (?, ?)",
                [(user_id, seed_post_id) for user_id in user_ids],
            )
            conn.commit()
        finally:
            conn.close()

    def _llm_agent_ids(self, env, config: RunConfig) -> list[int]:
        ids = [
            agent_id
            for agent_id, _agent in env.agent_graph.get_agents()
            if agent_id != 0
        ]
        return ids[: config.llm_max_agents]

    def _install_attention_context(self, env, config: RunConfig) -> None:
        if not hasattr(env.agent_graph, "get_agents"):
            return
        context_config = AttentionContextConfig(
            comment_budget=config.attention_comment_budget,
            audience_instruction=(
                crowd_instruction(config.audience.crowd_id)
                if config.audience.crowd_id
                else f"你属于用户自定义圈子，受众画像：{config.audience.custom}。"
            ),
        )

        for agent_id, agent in env.agent_graph.get_agents():
            if agent_id == 0:
                continue
            if not hasattr(agent, "env") or not hasattr(agent.env, "action"):
                continue
            action = agent.env.action

            async def to_text_prompt(
                include_posts: bool = True,
                include_followers: bool = True,
                include_follows: bool = True,
                *,
                _action=action,
                _agent_id=agent_id,
            ) -> str:
                posts_result = await _action.refresh() if include_posts else {}
                posts = (
                    posts_result.get("posts", [])
                    if isinstance(posts_result, dict) and posts_result.get("success")
                    else []
                )
                context = build_attention_context(
                    posts,
                    actor_id=_agent_id,
                    config=context_config,
                )
                return context.to_json()

            agent.env.to_text_prompt = to_text_prompt

    async def _safe_llm_step(self, env, deps, config: RunConfig) -> None:
        agents = env.agent_graph.get_agents(agent_ids=self._llm_agent_ids(env, config))
        actions = {agent: deps["LLMAction"]() for _, agent in agents}
        try:
            await env.step(actions)
        except Exception as exc:
            raise RuntimeError("LLM circuit breaker opened") from exc

    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        deps = self._deps()
        env, db_path = await self._make_env(config)
        try:
            await env.reset()
            self._install_attention_context(env, config)
            action_type = deps["ActionType"]
            await env.step(
                {
                    env.agent_graph.get_agent(0): deps["ManualAction"](
                        action_type=action_type.CREATE_POST,
                        action_args={"content": config.content},
                    )
                }
            )
            self._pin_seed_to_rec(db_path)
            self._assert_seed_visible(db_path)
            prev = RunSnapshot()
            safe_steps = config.effective_steps
            llm_errors = 0
            for step in range(1, safe_steps + 1):
                if step > 1:
                    try:
                        await self._safe_llm_step(env, deps, config)
                    except Exception:
                        llm_errors += 1
                        if llm_errors >= config.llm_error_threshold:
                            raise
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
        finally:
            await env.close()

    async def interview(
        self,
        config,
        snapshot,
        actor_id,
        question,
    ) -> str:
        # review:P5-T6  Ground interview in the completed run snapshot.
        from weiguan.analysis.llm_client import completion_options, make_openai_client

        seed = next(
            (post for post in snapshot.posts if post.post_id == snapshot.seed_post_id),
            None,
        )
        actor = next((item for item in snapshot.actors if item.user_id == actor_id), None)
        public_reaction = self._seed_reaction_context(snapshot, actor_id)
        persona = " / ".join(
            part
            for part in [
                actor.name if actor else None,
                f"@{actor.user_name}" if actor and actor.user_name else None,
                actor.bio if actor else None,
            ]
            if part
        ) or f"actor {actor_id}"
        prompt = (
            f"你是{persona}。\n"
            f"你在一个社交平台上看到这条内容：{seed.content if seed else config.content}\n"
            f"你对它的公开反应是：{public_reaction}\n"
            f"现在有人追问你：{question}\n"
            "请以第一人称、贴合上述人设与你已表达的立场作答，2-4句。只使用简体中文。"
        )
        client = make_openai_client(config)
        response = client.chat.completions.create(
            **completion_options(config),
            messages=[{"role": "user", "content": prompt}],
        )
        return (response.choices[0].message.content or "").strip()

    def _seed_reaction_context(self, snapshot: RunSnapshot, actor_id: int) -> str:
        seed = snapshot.seed_post_id
        parts = [
            f"评论：{reply.content}"
            for reply in snapshot.replies
            if reply.post_id == seed and reply.author_id == actor_id
        ]
        parts.extend(
            f"{reaction.kind.value} seed post"
            for reaction in snapshot.reactions
            if reaction.actor_id == actor_id
            and reaction.target_type.value == "post"
            and reaction.target_id == seed
        )
        parts.extend(
            f"{post.kind.value}: {post.quote_content or post.content}".strip()
            for post in snapshot.posts
            if post.author_id == actor_id and post.original_post_id == seed
        )
        parts.extend(
            f"report: {report.reason or 'no reason'}"
            for report in snapshot.reports
            if report.actor_id == actor_id and report.post_id == seed
        )
        return "；".join(parts) if parts else "没有可见反应"
