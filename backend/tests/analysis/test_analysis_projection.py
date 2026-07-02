from weiguan.analysis.social_metrics.projection import analyze
from weiguan.canonical import Post, Reply, RunSnapshot


def test_analyze_combines_all_metric_families_and_is_deterministic():  # review:P8-T5
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=10),
            Post(post_id=2, author_id=20, kind="repost", original_post_id=1),
        ],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=30, content="应该是真的", created_at="1")
        ],
    )

    first = analyze(snapshot)
    second = analyze(snapshot)

    assert first == second
    assert first.diffusion.cascade_size == 1
    assert first.opinion.stance_by_tick
    assert first.influence.ranking
    assert first.temporal.fermentation_curve


def test_analyze_empty_snapshot_returns_complete_zero_projection():  # review:P8-T5
    projection = analyze(RunSnapshot())

    assert projection.diffusion.tree == []
    assert projection.opinion.echo_chamber_risk == "low"
    assert projection.influence.ranking == []
    assert projection.temporal.fermentation_curve == []
