import sqlite3

from weiguan.adapter.oasis_adapter import load_run_snapshot
from weiguan.canonical import Platform, PostKind


def test_fixture_builds_expected_rows(oasis_db_path):  # review:P1-T2-AC1
    conn = sqlite3.connect(oasis_db_path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM user").fetchone()[0] == 3
        assert conn.execute("SELECT COUNT(*) FROM post").fetchone()[0] == 3
        assert (
            conn.execute("SELECT content FROM post WHERE post_id=1").fetchone()[0]
            == "构建砍到3秒"
        )
    finally:
        conn.close()


def test_load_actors(oasis_db_path):  # review:P1-T3-AC1
    snap = load_run_snapshot(oasis_db_path, seed_post_id=1)
    assert snap.platform == Platform.TWITTER
    assert snap.seed_post_id == 1
    assert len(snap.actors) == 3
    marco = next(a for a in snap.actors if a.user_id == 2)
    assert marco.user_name == "dev_marco"
    assert marco.num_followers == 5
    assert marco.num_followings == 3


def test_load_posts_kinds(oasis_db_path):  # review:P1-T3-AC2
    snap = load_run_snapshot(oasis_db_path)
    by_id = {p.post_id: p for p in snap.posts}
    assert by_id[1].kind == PostKind.ORIGINAL
    assert by_id[1].content == "构建砍到3秒"
    assert by_id[1].created_at == "1"
    assert by_id[1].num_likes == 2
    assert by_id[2].kind == PostKind.REPOST
    assert by_id[2].original_post_id == 1
    assert by_id[3].kind == PostKind.QUOTE
    assert by_id[3].quote_content == "今年最强DX"


def test_load_replies(oasis_db_path):  # review:P1-T3-AC3
    snap = load_run_snapshot(oasis_db_path)
    assert len(snap.replies) == 1
    r = snap.replies[0]
    assert r.comment_id == 1 and r.post_id == 1 and r.author_id == 2
    assert r.content == "缓存没清吧" and r.num_likes == 3


def test_load_reactions(oasis_db_path):  # review:P1-T4-AC1
    snap = load_run_snapshot(oasis_db_path)
    kinds = sorted(
        (r.kind.value, r.target_type.value, r.actor_id, r.target_id)
        for r in snap.reactions
    )
    assert kinds == [
        ("comment_like", "comment", 1, 1),
        ("dislike", "post", 3, 1),
        ("like", "post", 2, 1),
        ("like", "post", 3, 1),
    ]


def test_load_follows_and_reports(oasis_db_path):  # review:P1-T4-AC2
    snap = load_run_snapshot(oasis_db_path)
    assert len(snap.follows) == 1
    assert snap.follows[0].follower_id == 2 and snap.follows[0].followee_id == 1
    assert len(snap.reports) == 1
    assert snap.reports[0].actor_id == 3 and snap.reports[0].post_id == 1
    assert snap.reports[0].reason == "夸大"


def test_load_traces_sorted(oasis_db_path):  # review:P1-T4-AC3
    snap = load_run_snapshot(oasis_db_path)
    assert len(snap.traces) == 4
    assert snap.traces[0].action == "create_post"
    assert snap.traces[0].actor_id == 1
    actions_at_step2 = {t.action for t in snap.traces if t.created_at == "2"}
    assert actions_at_step2 == {"create_comment", "repost", "like_post"}
