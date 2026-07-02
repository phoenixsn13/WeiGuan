from weiguan.analysis.social_metrics.temporal import temporal_metrics
from weiguan.canonical import Post, Reaction, ReactionKind, Reply, RunSnapshot, TargetType


def test_temporal_peak_and_half_life_for_single_peak_curve():  # review:P8-T4
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=10),
            Post(post_id=2, author_id=20, content="应该可以", created_at="1"),
        ],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=21, content="应该是", created_at="2"),
            Reply(comment_id=2, post_id=1, author_id=22, content="可能合理", created_at="2"),
            Reply(comment_id=3, post_id=1, author_id=23, content="分析一下", created_at="2"),
            Reply(comment_id=4, post_id=1, author_id=24, content="还有证据吗", created_at="3"),
        ],
    )

    metrics = temporal_metrics(snapshot)

    assert [point["volume"] for point in metrics.fermentation_curve] == [1, 3, 1]
    assert metrics.peak_tick == 2
    assert metrics.half_life_ticks == 1


def test_temporal_sentiment_reversal_from_positive_to_negative():  # review:P8-T4
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=10)],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=20, content="应该是真的", created_at="1"),
            Reply(comment_id=2, post_id=1, author_id=21, content="可能靠谱", created_at="1"),
            Reply(comment_id=3, post_id=1, author_id=22, content="真的假的，有证据吗", created_at="2"),
            Reply(comment_id=4, post_id=1, author_id=23, content="fake 谣言", created_at="2"),
        ],
        reactions=[
            Reaction(
                kind=ReactionKind.DISLIKE,
                actor_id=24,
                target_type=TargetType.POST,
                target_id=1,
                created_at="2",
            )
        ],
    )

    metrics = temporal_metrics(snapshot)

    assert metrics.fermentation_curve[0]["sentiment"] == "positive"
    assert metrics.fermentation_curve[1]["sentiment"] == "negative"
    assert metrics.sentiment_reversals == [{"tick": "2", "from": "positive", "to": "negative"}]


def test_temporal_no_reversal_returns_empty_list():  # review:P8-T4
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=10)],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=20, content="应该是真的", created_at="1"),
            Reply(comment_id=2, post_id=1, author_id=21, content="可能靠谱", created_at="2"),
        ],
    )

    assert temporal_metrics(snapshot).sentiment_reversals == []
