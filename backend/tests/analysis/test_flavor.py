from weiguan.analysis.flavor import flavor_digest
from weiguan.canonical import Platform, Post, Reply, RunSnapshot


def _multi_phase_snapshot() -> RunSnapshot:
    return RunSnapshot(
        platform=Platform.TWITTER,
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=10, content="AI 发布新政策", created_at="0"),
            Post(
                post_id=2,
                author_id=20,
                kind="repost",
                original_post_id=1,
                content="应该是真的，看看分析",
                created_at="1",
                num_likes=3,
            ),
            Post(
                post_id=3,
                author_id=30,
                kind="repost",
                original_post_id=1,
                content="证据呢？真的假的",
                created_at="2",
                num_likes=8,
            ),
            Post(
                post_id=4,
                author_id=40,
                kind="quote",
                original_post_id=1,
                content="哈哈这也太像梗了",
                created_at="3",
                num_likes=1,
            ),
        ],
        replies=[
            Reply(
                comment_id=1,
                post_id=1,
                author_id=50,
                content="可能要看来源",
                created_at="2",
                num_likes=5,
            ),
            Reply(
                comment_id=2,
                post_id=1,
                author_id=60,
                content="没看到证据，像谣言",
                created_at="3",
                num_likes=2,
            ),
        ],
    )


def test_flavor_digest_phases_are_deterministic_and_limited():  # review:P10-T2
    first = flavor_digest(_multi_phase_snapshot(), utterance_limit=2)
    second = flavor_digest(_multi_phase_snapshot(), utterance_limit=2)

    assert first == second
    platform = first.platforms[0]
    assert platform.platform == "twitter"
    assert [phase.phase for phase in platform.phases] == ["seed", "early", "peak", "tail"]
    assert [phase.tick_range for phase in platform.phases] == [(0, 0), (1, 1), (2, 2), (3, 3)]
    assert all(len(phase.representative_utterances) <= 2 for phase in platform.phases)


def test_flavor_digest_spread_shape_maps_deep_chain_and_star():  # review:P10-T2
    deep_chain = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=1),
            Post(post_id=2, author_id=2, kind="repost", original_post_id=1),
            Post(post_id=3, author_id=3, kind="repost", original_post_id=2),
            Post(post_id=4, author_id=4, kind="repost", original_post_id=3),
        ],
    )
    star = RunSnapshot(
        seed_post_id=1,
        posts=[
            Post(post_id=1, author_id=1),
            Post(post_id=2, author_id=2, kind="repost", original_post_id=1),
            Post(post_id=3, author_id=3, kind="repost", original_post_id=1),
            Post(post_id=4, author_id=4, kind="repost", original_post_id=1),
        ],
    )

    assert flavor_digest(deep_chain).platforms[0].spread_shape == "链式转发"
    assert flavor_digest(star).platforms[0].spread_shape == "单源爆发"


def test_flavor_digest_empty_snapshot_is_complete_zero_value():  # review:P10-T2
    digest = flavor_digest(RunSnapshot())

    assert digest.world_id is None
    assert digest.run_ids == []
    assert digest.cross_platform_notes == []
    assert digest.platforms[0].volume == 0
    assert digest.platforms[0].persona_mix == {"ordinary": 0, "verified": 0, "kol": 0}
    assert digest.platforms[0].phases == []
