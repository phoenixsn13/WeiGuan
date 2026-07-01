from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TypeVar

from weiguan.canonical import RunSnapshot

T = TypeVar("T")


def _new(items: Iterable[T], prev_items: Iterable[T], key: Callable[[T], object]) -> list[T]:
    seen = {key(i) for i in prev_items}
    return [i for i in items if key(i) not in seen]


# review:P2-T2
def diff_snapshots(prev: RunSnapshot, curr: RunSnapshot) -> RunSnapshot:
    return RunSnapshot(
        platform=curr.platform,
        seed_post_id=curr.seed_post_id,
        actors=_new(curr.actors, prev.actors, lambda a: a.user_id),
        posts=_new(curr.posts, prev.posts, lambda p: p.post_id),
        replies=_new(curr.replies, prev.replies, lambda r: r.comment_id),
        reactions=_new(
            curr.reactions,
            prev.reactions,
            lambda x: (x.kind, x.actor_id, x.target_type, x.target_id, x.created_at),
        ),
        follows=_new(
            curr.follows,
            prev.follows,
            lambda f: (f.follower_id, f.followee_id),
        ),
        reports=_new(
            curr.reports,
            prev.reports,
            lambda r: (r.actor_id, r.post_id, r.created_at),
        ),
        traces=_new(
            curr.traces,
            prev.traces,
            lambda t: (t.actor_id, t.created_at, t.action, t.info),
        ),
    )
