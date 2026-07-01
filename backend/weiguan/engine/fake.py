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
            elif step == 2:
                snap = RunSnapshot(
                    actors=[Actor(user_id=2, user_name="dev_marco", name="Marco")],
                    replies=[
                        Reply(
                            comment_id=1,
                            post_id=1,
                            author_id=2,
                            content="缓存没清吧",
                            num_likes=3,
                            created_at="2",
                        )
                    ],
                    reactions=[
                        Reaction(
                            kind=ReactionKind.LIKE,
                            actor_id=2,
                            target_type=TargetType.POST,
                            target_id=1,
                            created_at="2",
                        )
                    ],
                )
            else:
                snap = RunSnapshot()
            yield RunDelta(step=step, snapshot=snap)

    async def interview(self, config, snapshot, actor_id, question) -> str:
        return f"[fake] 用户 {actor_id} 对『{question}』的回答"
