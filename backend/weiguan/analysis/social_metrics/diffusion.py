from __future__ import annotations

from collections import defaultdict

from pydantic import BaseModel

from weiguan.canonical import PostKind, RunSnapshot


class CascadeNode(BaseModel):
    post_id: int
    author_id: int
    depth: int
    children: list[int]


class DiffusionMetrics(BaseModel):
    tree: list[CascadeNode]
    max_depth: int
    breadth: int
    cascade_size: int
    key_rebroadcasters: list[int]


def _seed_id(snapshot: RunSnapshot) -> int | None:
    if snapshot.seed_post_id is not None:
        return snapshot.seed_post_id
    return snapshot.posts[0].post_id if snapshot.posts else None


def diffusion_metrics(snapshot: RunSnapshot) -> DiffusionMetrics:  # review:P8-T1
    seed = _seed_id(snapshot)
    if seed is None:
        return DiffusionMetrics(
            tree=[], max_depth=0, breadth=0, cascade_size=0, key_rebroadcasters=[]
        )

    posts_by_id = {post.post_id: post for post in snapshot.posts}
    seed_post = posts_by_id.get(seed)
    if seed_post is None:
        return DiffusionMetrics(
            tree=[], max_depth=0, breadth=0, cascade_size=0, key_rebroadcasters=[]
        )

    children_by_parent: dict[int, list[int]] = defaultdict(list)
    for post in sorted(snapshot.posts, key=lambda item: item.post_id):
        if post.kind not in {PostKind.REPOST, PostKind.QUOTE}:
            continue
        if post.original_post_id in posts_by_id:
            children_by_parent[int(post.original_post_id)].append(post.post_id)

    nodes: list[CascadeNode] = []
    depth_by_post: dict[int, int] = {}

    def visit(post_id: int, depth: int) -> None:
        if post_id in depth_by_post:
            return
        post = posts_by_id[post_id]
        depth_by_post[post_id] = depth
        children = children_by_parent.get(post_id, [])
        nodes.append(
            CascadeNode(
                post_id=post_id,
                author_id=post.author_id,
                depth=depth,
                children=children,
            )
        )
        for child_id in children:
            visit(child_id, depth + 1)

    visit(seed, 0)

    def descendant_count(post_id: int) -> int:
        return sum(1 + descendant_count(child) for child in children_by_parent.get(post_id, []))

    rebroadcaster_scores = [
        (descendant_count(node.post_id), node.author_id)
        for node in nodes
        if node.post_id != seed and descendant_count(node.post_id) > 0
    ]
    rebroadcaster_scores.sort(key=lambda item: (-item[0], item[1]))

    return DiffusionMetrics(
        tree=nodes,
        max_depth=max((node.depth for node in nodes), default=0),
        breadth=len(children_by_parent.get(seed, [])),
        cascade_size=max(0, len(nodes) - 1),
        key_rebroadcasters=[author_id for _, author_id in rebroadcaster_scores],
    )
