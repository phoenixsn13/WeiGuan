from weiguan.analysis.provider import EmbeddedAnalysisProvider, default_analysis_provider
from weiguan.analysis.social_metrics.projection import analyze
from weiguan.canonical import Post, Reply, RunSnapshot


def test_embedded_provider_matches_direct_analysis():  # review:P10-T1
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=10, content="主帖"),
            Post(post_id=2, author_id=20, kind="repost", original_post_id=1),
        ],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=30, content="应该是真的", created_at="1")
        ],
    )

    assert EmbeddedAnalysisProvider().analyze(snapshot) == analyze(snapshot)


def test_default_analysis_provider_is_embedded():  # review:P10-T1
    assert isinstance(default_analysis_provider(), EmbeddedAnalysisProvider)
