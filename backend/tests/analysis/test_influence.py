from weiguan.analysis.social_metrics.influence import influence_metrics
from weiguan.canonical import (
    Actor,
    Follow,
    Post,
    Reaction,
    ReactionKind,
    Reply,
    RunSnapshot,
    TargetType,
)


def test_influence_star_center_ranks_first_and_is_deterministic():  # review:P8-T3
    snapshot = RunSnapshot(
        seed_post_id=1,
        actors=[Actor(user_id=user_id) for user_id in range(1, 7)],
        posts=[Post(post_id=1, author_id=1)],
        replies=[
            Reply(comment_id=1, post_id=1, author_id=2),
            Reply(comment_id=2, post_id=1, author_id=3),
            Reply(comment_id=3, post_id=1, author_id=4),
        ],
        reactions=[
            Reaction(
                kind=ReactionKind.LIKE,
                actor_id=5,
                target_type=TargetType.POST,
                target_id=1,
            ),
            Reaction(
                kind=ReactionKind.DISLIKE,
                actor_id=6,
                target_type=TargetType.POST,
                target_id=1,
            ),
        ],
        follows=[
            Follow(follower_id=2, followee_id=1),
            Follow(follower_id=3, followee_id=1),
            Follow(follower_id=4, followee_id=1),
        ],
    )

    first = influence_metrics(snapshot)
    second = influence_metrics(snapshot)

    assert first == second
    assert first.top_leaders[0] == 1
    assert first.iterations <= 50
    leader = first.ranking[0]
    assert leader["actor_id"] == 1
    assert leader["in_degree"] == 8
    assert leader["centrality"] == max(item["centrality"] for item in first.ranking)


def test_influence_kcore_identifies_dense_subgroup():  # review:P8-T3
    snapshot = RunSnapshot(
        actors=[Actor(user_id=user_id) for user_id in [1, 2, 3, 9]],
        follows=[
            Follow(follower_id=1, followee_id=2),
            Follow(follower_id=2, followee_id=1),
            Follow(follower_id=1, followee_id=3),
            Follow(follower_id=3, followee_id=1),
            Follow(follower_id=2, followee_id=3),
            Follow(follower_id=3, followee_id=2),
            Follow(follower_id=9, followee_id=1),
        ],
    )

    ranking = {item["actor_id"]: item for item in influence_metrics(snapshot).ranking}

    assert ranking[1]["kcore"] == 2
    assert ranking[2]["kcore"] == 2
    assert ranking[3]["kcore"] == 2
    assert ranking[9]["kcore"] == 1
