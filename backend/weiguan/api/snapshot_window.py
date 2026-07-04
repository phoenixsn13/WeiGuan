from __future__ import annotations

from weiguan.canonical import Actor, Post, Reply, RunSnapshot


_COUNTED_FIELDS = ("posts", "replies", "reactions", "follows", "reports", "traces")


def _totals(snapshot: RunSnapshot) -> dict[str, int]:
    return {field: len(getattr(snapshot, field)) for field in _COUNTED_FIELDS}


def _seed_posts(snapshot: RunSnapshot) -> list[Post]:
    if snapshot.seed_post_id is None:
        return []
    return [post for post in snapshot.posts if post.post_id == snapshot.seed_post_id]


def _unique_posts(posts: list[Post]) -> list[Post]:
    seen: set[int] = set()
    result: list[Post] = []
    for post in posts:
        if post.post_id in seen:
            continue
        seen.add(post.post_id)
        result.append(post)
    return result


def _actor_ids(snapshot: RunSnapshot) -> set[int]:
    ids = {post.author_id for post in snapshot.posts}
    ids.update(reply.author_id for reply in snapshot.replies)
    ids.update(reaction.actor_id for reaction in snapshot.reactions)
    ids.update(follow.follower_id for follow in snapshot.follows)
    ids.update(follow.followee_id for follow in snapshot.follows)
    ids.update(report.actor_id for report in snapshot.reports)
    ids.update(trace.actor_id for trace in snapshot.traces)
    return ids


def _actors_for(source: RunSnapshot, window: RunSnapshot) -> list[Actor]:
    ids = _actor_ids(window)
    return [actor for actor in source.actors if actor.user_id in ids]


def window_snapshot(snapshot: RunSnapshot, *, tail: int) -> dict:  # review:P12-T7
    tail_posts = snapshot.posts[-tail:] if tail else []
    window = snapshot.model_copy(
        update={
            "posts": _unique_posts([*_seed_posts(snapshot), *tail_posts]),
            "replies": snapshot.replies[-tail:] if tail else [],
            "reactions": snapshot.reactions[-tail:] if tail else [],
            "follows": snapshot.follows[-tail:] if tail else [],
            "reports": snapshot.reports[-tail:] if tail else [],
            "traces": snapshot.traces[-tail:] if tail else [],
        }
    )
    window = window.model_copy(update={"actors": _actors_for(snapshot, window)})
    data = window.model_dump(mode="json")
    data["window"] = {"tail": tail, "totals": _totals(snapshot)}
    return data


def page_replies_snapshot(  # review:P12-T7
    snapshot: RunSnapshot, *, replies_offset: int, replies_limit: int
) -> dict:
    end = max(len(snapshot.replies) - replies_offset, 0)
    start = max(end - replies_limit, 0)
    replies: list[Reply] = snapshot.replies[start:end]
    window = snapshot.model_copy(
        update={
            "posts": _seed_posts(snapshot),
            "replies": replies,
            "reactions": [],
            "follows": [],
            "reports": [],
            "traces": [],
        }
    )
    window = window.model_copy(update={"actors": _actors_for(snapshot, window)})
    data = window.model_dump(mode="json")
    data["window"] = {
        "replies_offset": replies_offset,
        "replies_limit": replies_limit,
        "totals": _totals(snapshot),
    }
    return data
