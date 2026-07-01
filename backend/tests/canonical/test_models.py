from weiguan.canonical import (
    Actor,
    Follow,
    Platform,
    Post,
    PostKind,
    Reaction,
    ReactionKind,
    Reply,
    Report,
    RunSnapshot,
    TargetType,
    TraceEvent,
)


def test_post_defaults_are_original_and_empty():  # review:P1-T1-AC1
    p = Post(post_id=1, author_id=10)
    assert p.kind == PostKind.ORIGINAL
    assert p.content == ""
    assert p.num_likes == 0
    assert p.original_post_id is None


def test_reaction_requires_kind_and_target():  # review:P1-T1-AC2
    r = Reaction(
        kind=ReactionKind.LIKE,
        actor_id=3,
        target_type=TargetType.POST,
        target_id=1,
    )
    assert r.kind == ReactionKind.LIKE
    assert r.target_type == TargetType.POST


def test_run_snapshot_is_empty_by_default_and_serializable():  # review:P1-T1-AC3
    snap = RunSnapshot()
    assert snap.platform == Platform.TWITTER
    assert snap.actors == []
    dumped = snap.model_dump()
    assert dumped["posts"] == []
    assert dumped["platform"] == "twitter"


def test_models_export_contract_symbols():  # review:P1-T1
    assert Actor and Reply and Follow and Report and TraceEvent
