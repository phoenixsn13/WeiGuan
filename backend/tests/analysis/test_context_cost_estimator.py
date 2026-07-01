import json
import sqlite3

from weiguan.analysis.context_cost_estimator import (
    DeepSeekUsage,
    EstimatorConfig,
    estimate_context_costs,
)


def _make_db(path):
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE trace (
            user_id INTEGER,
            created_at INTEGER,
            action TEXT,
            info TEXT
        );
        CREATE TABLE comment (
            comment_id INTEGER,
            post_id INTEGER,
            user_id INTEGER,
            content TEXT,
            created_at INTEGER,
            num_likes INTEGER,
            num_dislikes INTEGER
        );
        """
    )
    comments = [
        {
            "comment_id": idx,
            "post_id": 1,
            "user_id": idx,
            "content": f"source? repeated question {idx}",
            "created_at": 1,
            "num_likes": idx % 3,
            "num_dislikes": 0,
        }
        for idx in range(1, 21)
    ]
    conn.executemany(
        "INSERT INTO comment VALUES (:comment_id,:post_id,:user_id,:content,:created_at,:num_likes,:num_dislikes)",
        comments,
    )
    posts = [
        {
            "post_id": 1,
            "user_id": 0,
            "content": "seed",
            "created_at": 0,
            "num_likes": 0,
            "num_dislikes": 0,
            "num_shares": 0,
            "num_reports": 0,
            "comments": comments,
        }
    ]
    for step in (1, 2):
        for actor_id in (1, 2, 3):
            conn.execute(
                "INSERT INTO trace VALUES (?,?,?,?)",
                (actor_id, step, "refresh", json.dumps({"posts": posts})),
            )
    conn.commit()
    conn.close()


def test_attention_estimator_bounds_comment_context_and_compares_actual_usage(tmp_path):
    db_path = tmp_path / "run.db"
    _make_db(db_path)

    report = estimate_context_costs(
        db_path,
        config=EstimatorConfig(comment_budget=4, fixed_prompt_tokens=100),
        actual_usage=DeepSeekUsage(
            input_cache_hit_tokens=10,
            input_cache_miss_tokens=90,
            output_tokens=20,
        ),
    )

    assert report.total_requests == 6
    assert report.old.total_tokens > report.attention.total_tokens
    assert report.attention.max_visible_comments == 4
    assert report.actual_usage is not None
    assert report.old_vs_actual_error_pct is not None
