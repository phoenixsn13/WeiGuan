import sqlite3


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
