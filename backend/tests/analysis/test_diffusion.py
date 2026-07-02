from weiguan.analysis.social_metrics.diffusion import diffusion_metrics
from weiguan.canonical import Post, RunSnapshot


def test_diffusion_cascade_depth_breadth_and_key_rebroadcaster():  # review:P8-T1
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=10),
            Post(post_id=2, author_id=20, kind="repost", original_post_id=1),
            Post(post_id=3, author_id=30, kind="quote", original_post_id=1),
            Post(post_id=4, author_id=40, kind="repost", original_post_id=2),
        ],
    )

    metrics = diffusion_metrics(snapshot)

    by_post = {node.post_id: node for node in metrics.tree}
    assert by_post[1].depth == 0
    assert by_post[2].depth == 1
    assert by_post[3].depth == 1
    assert by_post[4].depth == 2
    assert sorted(by_post[1].children) == [2, 3]
    assert by_post[2].children == [4]
    assert metrics.max_depth == 2
    assert metrics.breadth == 2
    assert metrics.cascade_size == 3
    assert metrics.key_rebroadcasters[0] == 20


def test_diffusion_cascade_degrades_to_seed_when_no_rebroadcasts():  # review:P8-T1
    snapshot = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=10),
            Post(post_id=2, author_id=20),
        ],
    )

    metrics = diffusion_metrics(snapshot)

    assert [node.post_id for node in metrics.tree] == [1]
    assert metrics.max_depth == 0
    assert metrics.breadth == 0
    assert metrics.cascade_size == 0
    assert metrics.key_rebroadcasters == []
