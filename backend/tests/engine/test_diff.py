from weiguan.canonical import (
    Actor,
    Platform,
    Post,
    Reaction,
    ReactionKind,
    Reply,
    RunSnapshot,
    TargetType,
)
from weiguan.engine.diff import diff_snapshots


def test_diff_returns_only_new_entities():  # review:P2-T2-AC1
    prev = RunSnapshot(actors=[Actor(user_id=1)], posts=[Post(post_id=1, author_id=1)])
    curr = RunSnapshot(
        platform=Platform.TWITTER,
        seed_post_id=1,
        actors=[Actor(user_id=1), Actor(user_id=2)],
        posts=[Post(post_id=1, author_id=1), Post(post_id=2, author_id=2)],
        replies=[Reply(comment_id=1, post_id=1, author_id=2)],
    )
    d = diff_snapshots(prev, curr)
    assert [a.user_id for a in d.actors] == [2]
    assert [p.post_id for p in d.posts] == [2]
    assert [r.comment_id for r in d.replies] == [1]
    assert d.seed_post_id == 1


def test_diff_reactions_by_full_tuple():  # review:P2-T2-AC2
    r = Reaction(
        kind=ReactionKind.LIKE,
        actor_id=2,
        target_type=TargetType.POST,
        target_id=1,
        created_at="2",
    )
    prev = RunSnapshot(reactions=[r])
    curr = RunSnapshot(
        reactions=[
            r,
            Reaction(
                kind=ReactionKind.LIKE,
                actor_id=3,
                target_type=TargetType.POST,
                target_id=1,
                created_at="2",
            ),
        ]
    )
    d = diff_snapshots(prev, curr)
    assert len(d.reactions) == 1 and d.reactions[0].actor_id == 3


def test_diff_empty_when_no_change():  # review:P2-T2-AC3
    s = RunSnapshot(posts=[Post(post_id=1, author_id=1)])
    d = diff_snapshots(s, s)
    assert d.posts == [] and d.actors == []
