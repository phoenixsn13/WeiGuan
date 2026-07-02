from weiguan.analysis.social_metrics.opinion import opinion_metrics
from weiguan.analysis.stance import stance_polarity
from weiguan.canonical import Post, Reply, RunSnapshot


def test_stance_polarity_matches_world_projector_contract():  # review:P8-T2
    assert stance_polarity("question") == -1
    assert stance_polarity("skeptic") == -1
    assert stance_polarity("analysis") == 1
    assert stance_polarity("meme") == 1
    assert stance_polarity("other") == 1
    assert stance_polarity("") == 0


def test_opinion_trend_converges_from_mixed_to_single_peak():  # review:P8-T2
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=10, content="主帖")],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=20, content="真的假的，有证据吗", created_at="1"),
            Reply(comment_id=2, post_id=1, author_id=21, content="应该是真的，分析得通", created_at="1"),
            Reply(comment_id=3, post_id=1, author_id=22, content="应该是这样，分析没问题", created_at="2"),
            Reply(comment_id=4, post_id=1, author_id=23, content="可能就是这个方向", created_at="2"),
        ],
    )

    metrics = opinion_metrics(snapshot)

    assert metrics.stance_by_tick[0]["tick"] == "1"
    assert metrics.stance_by_tick[0]["stance_counts"]["question"] == 1
    assert metrics.convergence_trend == "converging"
    assert metrics.polarization_index < 0.6


def test_opinion_detects_polarization_and_echo_chamber_risk():  # review:P8-T2
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=10, content="主帖"),
            Post(post_id=2, author_id=20, content="真的假的，有证据吗"),
            Post(post_id=3, author_id=21, content="fake 谣言"),
            Post(post_id=4, author_id=30, content="应该是真的，分析合理"),
            Post(post_id=5, author_id=31, content="哈哈 这个梗有意思"),
        ],
        replies=[
            Reply(comment_id=1, post_id=2, author_id=21, content="没看到来源，假", created_at="1"),
            Reply(comment_id=2, post_id=3, author_id=20, content="真的假的，证据呢", created_at="1"),
            Reply(comment_id=3, post_id=4, author_id=31, content="应该没问题", created_at="1"),
            Reply(comment_id=4, post_id=5, author_id=30, content="哈哈 是这个理", created_at="1"),
        ],
    )

    metrics = opinion_metrics(snapshot)

    assert metrics.polarization_index >= 0.7
    assert metrics.homophily >= 0.9
    assert metrics.cross_stance_ratio <= 0.1
    assert metrics.echo_chamber_risk == "high"


def test_opinion_all_neutral_low_polarization():  # review:P8-T2
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[Post(post_id=1, author_id=10, content="主帖")],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=20, content="", created_at="1"),
            Reply(comment_id=2, post_id=1, author_id=21, content="", created_at="2"),
        ],
    )

    metrics = opinion_metrics(snapshot)

    assert metrics.polarization_index == 0
    assert metrics.echo_chamber_risk == "low"
    assert metrics.convergence_trend == "stable"
