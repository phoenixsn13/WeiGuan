import sqlite3

import pytest

_SCHEMA = """
CREATE TABLE user (user_id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id INTEGER,
  user_name TEXT, name TEXT, bio TEXT, created_at DATETIME,
  num_followings INTEGER DEFAULT 0, num_followers INTEGER DEFAULT 0);
CREATE TABLE post (post_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  original_post_id INTEGER, content TEXT DEFAULT '', quote_content TEXT,
  created_at DATETIME, num_likes INTEGER DEFAULT 0, num_dislikes INTEGER DEFAULT 0,
  num_shares INTEGER DEFAULT 0, num_reports INTEGER DEFAULT 0);
CREATE TABLE comment (comment_id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER,
  user_id INTEGER, content TEXT, created_at DATETIME,
  num_likes INTEGER DEFAULT 0, num_dislikes INTEGER DEFAULT 0);
CREATE TABLE "like" (like_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  post_id INTEGER, created_at DATETIME);
CREATE TABLE dislike (dislike_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  post_id INTEGER, created_at DATETIME);
CREATE TABLE comment_like (comment_like_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, comment_id INTEGER, created_at DATETIME);
CREATE TABLE comment_dislike (comment_dislike_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, comment_id INTEGER, created_at DATETIME);
CREATE TABLE follow (follow_id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id INTEGER,
  followee_id INTEGER, created_at DATETIME);
CREATE TABLE report (report_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
  post_id INTEGER, report_reason TEXT, created_at DATETIME);
CREATE TABLE trace (user_id INTEGER, created_at DATETIME, action TEXT, info TEXT,
  PRIMARY KEY(user_id, created_at, action, info));
"""


# review:P1-T2
def _seed(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    conn.executemany(
        "INSERT INTO user (user_id, agent_id, user_name, name, bio, created_at,"
        " num_followings, num_followers) VALUES (?,?,?,?,?,?,?,?)",
        [
            (1, 0, "you", "你", "产品负责人", "1", 0, 0),
            (2, 1, "dev_marco", "Marco", "后端老兵", "1", 3, 5),
            (3, 2, "sre_lin", "Lin", "SRE", "1", 4, 2),
        ],
    )
    conn.executemany(
        "INSERT INTO post (post_id, user_id, original_post_id, content,"
        " quote_content, created_at, num_likes, num_dislikes, num_shares,"
        " num_reports) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            (1, 1, None, "构建砍到3秒", None, "1", 2, 1, 1, 1),
            (2, 2, 1, "", None, "2", 0, 0, 0, 0),
            (3, 3, 1, "", "今年最强DX", "2", 0, 0, 0, 0),
        ],
    )
    conn.execute(
        "INSERT INTO comment (comment_id, post_id, user_id, content, created_at,"
        " num_likes, num_dislikes) VALUES (1,1,2,'缓存没清吧','2',3,0)"
    )
    conn.executemany(
        'INSERT INTO "like" (like_id, user_id, post_id, created_at) VALUES (?,?,?,?)',
        [(1, 2, 1, "2"), (2, 3, 1, "2")],
    )
    conn.execute(
        "INSERT INTO dislike (dislike_id, user_id, post_id, created_at)"
        " VALUES (1,3,1,'2')"
    )
    conn.execute(
        "INSERT INTO comment_like (comment_like_id, user_id, comment_id, created_at)"
        " VALUES (1,1,1,'2')"
    )
    conn.execute(
        "INSERT INTO follow (follow_id, follower_id, followee_id, created_at)"
        " VALUES (1,2,1,'2')"
    )
    conn.execute(
        "INSERT INTO report (report_id, user_id, post_id, report_reason, created_at)"
        " VALUES (1,3,1,'夸大','2')"
    )
    conn.executemany(
        "INSERT INTO trace (user_id, created_at, action, info) VALUES (?,?,?,?)",
        [
            (1, "1", "create_post", '{"post_id":1}'),
            (2, "2", "create_comment", '{"comment_id":1}'),
            (2, "2", "repost", '{"post_id":2}'),
            (3, "2", "like_post", '{"post_id":1}'),
        ],
    )
    conn.commit()


@pytest.fixture
def oasis_db_path(tmp_path) -> str:
    path = str(tmp_path / "sim.db")
    conn = sqlite3.connect(path)
    try:
        _seed(conn)
    finally:
        conn.close()
    return path
