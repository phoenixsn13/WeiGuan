from __future__ import annotations

from collections import Counter

from pydantic import BaseModel

from weiguan.canonical import ReactionKind, RunSnapshot, TargetType


class SentimentBuckets(BaseModel):
    positive: int
    negative: int
    neutral: int


class RetroMetrics(BaseModel):
    sentiment: SentimentBuckets
    spread_by_step: list[int]
    totals: dict[str, int]


# review:P5-T1
def compute_metrics(snapshot: RunSnapshot) -> RetroMetrics:
    seed = snapshot.seed_post_id
    likes = sum(
        1
        for reaction in snapshot.reactions
        if reaction.kind == ReactionKind.LIKE
        and reaction.target_type == TargetType.POST
        and reaction.target_id == seed
    )
    dislikes = sum(
        1
        for reaction in snapshot.reactions
        if reaction.kind == ReactionKind.DISLIKE
        and reaction.target_type == TargetType.POST
        and reaction.target_id == seed
    )
    reposts = sum(
        1
        for post in snapshot.posts
        if post.original_post_id == seed and post.kind == "repost"
    )
    quotes = sum(
        1
        for post in snapshot.posts
        if post.original_post_id == seed and post.kind == "quote"
    )
    replies = sum(1 for reply in snapshot.replies if reply.post_id == seed)
    reports = sum(1 for report in snapshot.reports if report.post_id == seed)

    per_step = Counter(trace.created_at for trace in snapshot.traces)
    spread = [per_step[key] for key in sorted(per_step, key=lambda value: (value is None, value))]

    return RetroMetrics(
        sentiment=SentimentBuckets(
            positive=likes + reposts,
            negative=dislikes + reports,
            neutral=replies,
        ),
        spread_by_step=spread,
        totals={
            "likes": likes,
            "dislikes": dislikes,
            "replies": replies,
            "reposts": reposts,
            "quotes": quotes,
            "reports": reports,
        },
    )
