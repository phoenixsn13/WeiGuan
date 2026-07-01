from weiguan.analysis.retro import compute_metrics
from weiguan.canonical import (
    Post,
    Reaction,
    ReactionKind,
    Reply,
    Report,
    RunSnapshot,
    TargetType,
    TraceEvent,
)


def _snap():
    return RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=1, num_likes=2, num_dislikes=1),
            Post(post_id=2, author_id=3, kind="repost", original_post_id=1),
            Post(
                post_id=3,
                author_id=4,
                kind="quote",
                original_post_id=1,
                quote_content="q",
            ),
        ],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=2, content="a"),
            Reply(comment_id=2, post_id=1, author_id=5, content="b"),
        ],
        reactions=[
            Reaction(
                kind=ReactionKind.LIKE,
                actor_id=2,
                target_type=TargetType.POST,
                target_id=1,
                created_at="2",
            ),
            Reaction(
                kind=ReactionKind.DISLIKE,
                actor_id=3,
                target_type=TargetType.POST,
                target_id=1,
                created_at="2",
            ),
        ],
        reports=[Report(actor_id=6, post_id=1, reason="夸大")],
        traces=[
            TraceEvent(actor_id=1, created_at="1", action="create_post"),
            TraceEvent(actor_id=2, created_at="2", action="create_comment"),
            TraceEvent(actor_id=3, created_at="2", action="repost"),
        ],
    )


def test_sentiment_buckets():  # review:P5-T1-AC1
    metrics = compute_metrics(_snap())
    assert metrics.sentiment.positive == 1 + 1
    assert metrics.sentiment.negative == 1 + 1
    assert metrics.sentiment.neutral == 2


def test_totals_and_spread():  # review:P5-T1-AC2
    metrics = compute_metrics(_snap())
    assert metrics.totals["reposts"] == 1 and metrics.totals["quotes"] == 1
    assert metrics.totals["replies"] == 2 and metrics.totals["reports"] == 1
    assert metrics.spread_by_step == [1, 2]
