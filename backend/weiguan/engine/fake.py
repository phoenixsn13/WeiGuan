from __future__ import annotations

from typing import AsyncIterator

from weiguan.canonical import (
    Actor,
    Post,
    Reaction,
    ReactionKind,
    Reply,
    RunSnapshot,
    TargetType,
)
from weiguan.engine.base import RunDelta
from weiguan.engine.config import RunConfig


# review:P2-T3
class FakeEngine:
    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        for step in range(1, config.steps + 1):
            if step == 1:
                snap = RunSnapshot(
                    seed_post_id=1,
                    actors=[Actor(user_id=1, user_name="you", name="你")],
                    posts=[
                        Post(
                            post_id=1,
                            author_id=1,
                            content=config.content,
                            created_at="1",
                        )
                    ],
                )
            elif step >= 2:
                actors = [
                    (2, "dev_marco", "Marco", "缓存没清吧"),
                    (4, "frontend_xuan", "玄", "如果是冷启动 3 秒，那就很能打"),
                    (5, "sre_lin", "Lin", "先看 CI 环境，别只看本机热缓存"),
                    (6, "pm_yu", "余", "这句可以，但最好补一张对比图"),
                    (7, "perf_dong", "董", "关键是依赖图规模，demo 项目不算数"),
                ]
                user_id, user_name, name, content = actors[(step - 2) % len(actors)]
                snap = RunSnapshot(
                    actors=[Actor(user_id=user_id, user_name=user_name, name=name)],
                    replies=[
                        Reply(
                            comment_id=step - 1,
                            post_id=1,
                            author_id=user_id,
                            content=content,
                            num_likes=step + 1,
                            created_at=str(step),
                        )
                    ],
                    reactions=[
                        Reaction(
                            kind=ReactionKind.LIKE,
                            actor_id=user_id,
                            target_type=TargetType.POST,
                            target_id=1,
                            created_at=str(step),
                        )
                    ],
                )
            yield RunDelta(step=step, snapshot=snap)

    async def interview(self, config, snapshot, actor_id, question) -> str:
        return f"[fake] 用户 {actor_id} 对『{question}』的回答"
