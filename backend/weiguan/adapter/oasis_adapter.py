from __future__ import annotations

import sqlite3

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


def _rows(conn: sqlite3.Connection, sql: str) -> list[sqlite3.Row]:
    return conn.execute(sql).fetchall()


def _post_kind(original_post_id, quote_content) -> PostKind:
    if quote_content is not None:
        return PostKind.QUOTE
    if original_post_id is not None:
        return PostKind.REPOST
    return PostKind.ORIGINAL


def _text_or_none(value) -> str | None:
    if value is None:
        return None
    return str(value)


# review:P1-T3
def load_run_snapshot(
    db_path: str,
    platform: Platform = Platform.TWITTER,
    seed_post_id: int | None = None,
) -> RunSnapshot:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        actors = [
            Actor(
                user_id=r["user_id"],
                agent_id=r["agent_id"],
                user_name=r["user_name"],
                name=r["name"],
                bio=r["bio"],
                num_followers=r["num_followers"] or 0,
                num_followings=r["num_followings"] or 0,
            )
            for r in _rows(conn, "SELECT * FROM user ORDER BY user_id")
        ]
        posts = [
            Post(
                post_id=r["post_id"],
                author_id=r["user_id"],
                kind=_post_kind(r["original_post_id"], r["quote_content"]),
                content=r["content"] or "",
                quote_content=r["quote_content"],
                original_post_id=r["original_post_id"],
                created_at=_text_or_none(r["created_at"]),
                num_likes=r["num_likes"] or 0,
                num_dislikes=r["num_dislikes"] or 0,
                num_shares=r["num_shares"] or 0,
                num_reports=r["num_reports"] or 0,
            )
            for r in _rows(conn, "SELECT * FROM post ORDER BY post_id")
        ]
        replies = [
            Reply(
                comment_id=r["comment_id"],
                post_id=r["post_id"],
                author_id=r["user_id"],
                content=r["content"] or "",
                created_at=_text_or_none(r["created_at"]),
                num_likes=r["num_likes"] or 0,
                num_dislikes=r["num_dislikes"] or 0,
            )
            for r in _rows(conn, "SELECT * FROM comment ORDER BY comment_id")
        ]
        # review:P1-T4
        reactions: list[Reaction] = []
        for r in _rows(conn, 'SELECT * FROM "like" ORDER BY like_id'):
            reactions.append(
                Reaction(
                    kind=ReactionKind.LIKE,
                    actor_id=r["user_id"],
                    target_type=TargetType.POST,
                    target_id=r["post_id"],
                    created_at=_text_or_none(r["created_at"]),
                )
            )
        for r in _rows(conn, "SELECT * FROM dislike ORDER BY dislike_id"):
            reactions.append(
                Reaction(
                    kind=ReactionKind.DISLIKE,
                    actor_id=r["user_id"],
                    target_type=TargetType.POST,
                    target_id=r["post_id"],
                    created_at=_text_or_none(r["created_at"]),
                )
            )
        for r in _rows(conn, "SELECT * FROM comment_like ORDER BY comment_like_id"):
            reactions.append(
                Reaction(
                    kind=ReactionKind.COMMENT_LIKE,
                    actor_id=r["user_id"],
                    target_type=TargetType.COMMENT,
                    target_id=r["comment_id"],
                    created_at=_text_or_none(r["created_at"]),
                )
            )
        for r in _rows(
            conn, "SELECT * FROM comment_dislike ORDER BY comment_dislike_id"
        ):
            reactions.append(
                Reaction(
                    kind=ReactionKind.COMMENT_DISLIKE,
                    actor_id=r["user_id"],
                    target_type=TargetType.COMMENT,
                    target_id=r["comment_id"],
                    created_at=_text_or_none(r["created_at"]),
                )
            )

        follows = [
            Follow(
                follower_id=r["follower_id"],
                followee_id=r["followee_id"],
                created_at=_text_or_none(r["created_at"]),
            )
            for r in _rows(conn, "SELECT * FROM follow ORDER BY follow_id")
        ]
        reports = [
            Report(
                actor_id=r["user_id"],
                post_id=r["post_id"],
                reason=r["report_reason"],
                created_at=_text_or_none(r["created_at"]),
            )
            for r in _rows(conn, "SELECT * FROM report ORDER BY report_id")
        ]
        traces = [
            TraceEvent(
                actor_id=r["user_id"],
                created_at=_text_or_none(r["created_at"]),
                action=r["action"],
                info=r["info"],
            )
            for r in _rows(conn, "SELECT * FROM trace ORDER BY created_at, action")
        ]

        return RunSnapshot(
            platform=platform,
            seed_post_id=seed_post_id,
            actors=actors,
            posts=posts,
            replies=replies,
            reactions=reactions,
            follows=follows,
            reports=reports,
            traces=traces,
        )
    finally:
        conn.close()
