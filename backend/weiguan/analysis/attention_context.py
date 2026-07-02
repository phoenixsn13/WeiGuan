from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class AttentionContextConfig:
    comment_budget: int = 12
    direct_k: int = 3
    recent_k: int = 4
    salient_k: int = 3
    per_stance_k: int = 1
    comment_chars: int = 160
    seed_chars: int = 220
    audience_instruction: str = "你是中文社交平台上的普通用户。"


@dataclass(frozen=True)
class AttentionContext:
    self_memory: str
    seed_post: dict[str, Any]
    discussion_panel: dict[str, Any]
    visible_comments: list[dict[str, Any]]

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_payload(), ensure_ascii=False, separators=(",", ":"))


def shorten(text: str | None, max_chars: int) -> str:
    clean = (text or "").replace("\n", " ").strip()
    if len(clean) <= max_chars:
        return clean
    return f"{clean[:max_chars]}..."


def classify_stance(text: str | None) -> str:
    lower = (text or "").lower()
    if any(
        marker in lower
        for marker in ("source", "link", "来源", "链接", "真的假的", "真的吗", "证据")
    ):
        return "question"
    if any(marker in lower for marker in ("fake", "rumor", "谣", "假", "没看到")):
        return "skeptic"
    if any(marker in lower for marker in ("lol", "lmao", "梗", "elon", "哈哈", "笑")):
        return "meme"
    if any(marker in lower for marker in ("可能", "maybe", "looks like", "应该", "分析")):
        return "analysis"
    return "other"


def _comment_score(comment: dict[str, Any], actor_id: int) -> float:
    return (
        1_000 * int(comment.get("user_id") == actor_id)
        + 50 * math.log1p(comment.get("num_likes") or 0)
        + 2 * (comment.get("created_at") or 0)
    )


def _post_comments(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        comment
        for post in posts
        for comment in post.get("comments", [])
        if isinstance(comment, dict)
    ]


def select_attention_comments(
    posts: list[dict[str, Any]],
    actor_id: int,
    config: AttentionContextConfig = AttentionContextConfig(),
) -> list[dict[str, Any]]:
    comments = _post_comments(posts)
    selected: list[dict[str, Any]] = []
    used: set[int] = set()

    def add_many(items: list[dict[str, Any]], limit: int) -> None:
        for item in items[:limit]:
            comment_id = item.get("comment_id")
            if comment_id in used:
                continue
            selected.append(item)
            used.add(comment_id)

    actor_comments = [comment for comment in comments if comment.get("user_id") == actor_id]
    add_many(
        sorted(actor_comments, key=lambda c: _comment_score(c, actor_id), reverse=True),
        config.direct_k,
    )
    add_many(
        sorted(comments, key=lambda c: c.get("created_at") or 0, reverse=True),
        config.recent_k,
    )
    add_many(
        sorted(comments, key=lambda c: _comment_score(c, actor_id), reverse=True),
        config.salient_k,
    )

    buckets: dict[str, list[dict[str, Any]]] = {}
    for comment in comments:
        buckets.setdefault(classify_stance(comment.get("content")), []).append(comment)
    for name in ("question", "skeptic", "analysis", "meme", "other"):
        add_many(
            sorted(
                buckets.get(name, []),
                key=lambda c: _comment_score(c, actor_id),
                reverse=True,
            ),
            config.per_stance_k,
        )

    return selected[: config.comment_budget]


def build_attention_context(
    posts: list[dict[str, Any]],
    actor_id: int,
    config: AttentionContextConfig = AttentionContextConfig(),
) -> AttentionContext:
    comments = _post_comments(posts)
    selected = select_attention_comments(posts, actor_id, config)
    stance_counts: dict[str, int] = {}
    for comment in comments:
        stance = classify_stance(comment.get("content"))
        stance_counts[stance] = stance_counts.get(stance, 0) + 1

    seed = posts[0] if posts else {}
    return AttentionContext(
        self_memory=(
            f"你是用户 {actor_id}。{config.audience_instruction}"
            "你只能看到平台推荐给你的少量公开内容和自己参与过的讨论。"
            "请像真实社交媒体用户一样自然发言；所有发帖、评论、转发理由和访谈回答都必须使用简体中文。"
        ),
        seed_post={
            "post_id": seed.get("post_id"),
            "author_id": seed.get("user_id"),
            "content": shorten(seed.get("content"), config.seed_chars),
        },
        discussion_panel={
            "total_visible_comments": len(comments),
            "stance_counts": stance_counts,
            "omitted_comments": max(0, len(comments) - len(selected)),
        },
        visible_comments=[
            {
                "comment_id": comment.get("comment_id"),
                "user_id": comment.get("user_id"),
                "stance": classify_stance(comment.get("content")),
                "content": shorten(comment.get("content"), config.comment_chars),
            }
            for comment in selected
        ],
    )
