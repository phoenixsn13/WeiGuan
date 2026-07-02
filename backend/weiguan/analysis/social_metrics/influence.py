from __future__ import annotations

from collections import defaultdict
from typing import Any

from pydantic import BaseModel

from weiguan.canonical import TargetType, RunSnapshot


class InfluenceMetrics(BaseModel):
    ranking: list[dict[str, Any]]
    top_leaders: list[int]
    iterations: int = 0


def _edges(snapshot: RunSnapshot) -> tuple[set[int], list[tuple[int, int]]]:
    nodes = {actor.user_id for actor in snapshot.actors}
    nodes.update(post.author_id for post in snapshot.posts)
    nodes.update(reply.author_id for reply in snapshot.replies)
    nodes.update(reaction.actor_id for reaction in snapshot.reactions)
    nodes.update(follow.follower_id for follow in snapshot.follows)
    nodes.update(follow.followee_id for follow in snapshot.follows)

    post_authors = {post.post_id: post.author_id for post in snapshot.posts}
    comment_authors = {reply.comment_id: reply.author_id for reply in snapshot.replies}
    edges: list[tuple[int, int]] = []
    for follow in snapshot.follows:
        edges.append((follow.follower_id, follow.followee_id))
    for reply in snapshot.replies:
        target = post_authors.get(reply.post_id)
        if target is not None:
            edges.append((reply.author_id, target))
    for reaction in snapshot.reactions:
        target = (
            post_authors.get(reaction.target_id)
            if reaction.target_type == TargetType.POST
            else comment_authors.get(reaction.target_id)
        )
        if target is not None:
            edges.append((reaction.actor_id, target))
    return nodes, edges


def _centrality(
    nodes: set[int], edges: list[tuple[int, int]], max_iterations: int = 50
) -> tuple[dict[int, float], int]:
    if not nodes:
        return ({}, 0)
    ordered = sorted(nodes)
    n = len(ordered)
    outgoing: dict[int, list[int]] = defaultdict(list)
    for source, target in edges:
        outgoing[source].append(target)

    damping = 0.85
    ranks = {node: 1.0 / n for node in ordered}
    iterations = 0
    for iterations in range(1, max_iterations + 1):
        next_ranks = {node: (1 - damping) / n for node in ordered}
        dangling = sum(ranks[node] for node in ordered if not outgoing.get(node))
        if dangling:
            share = damping * dangling / n
            for node in ordered:
                next_ranks[node] += share
        for source in ordered:
            targets = outgoing.get(source)
            if not targets:
                continue
            share = damping * ranks[source] / len(targets)
            for target in targets:
                next_ranks[target] += share
        delta = sum(abs(next_ranks[node] - ranks[node]) for node in ordered)
        ranks = next_ranks
        if delta < 1e-9:
            break
    return ranks, iterations


def _kcore(nodes: set[int], edges: list[tuple[int, int]]) -> dict[int, int]:
    neighbors: dict[int, set[int]] = {node: set() for node in nodes}
    for source, target in edges:
        if source == target:
            continue
        neighbors.setdefault(source, set()).add(target)
        neighbors.setdefault(target, set()).add(source)

    remaining = set(neighbors)
    core = {node: 0 for node in neighbors}
    k = 0
    while remaining:
        changed = True
        while changed:
            changed = False
            removable = [
                node
                for node in sorted(remaining)
                if len(neighbors[node] & remaining) <= k
            ]
            if removable:
                changed = True
            for node in removable:
                core[node] = k
                remaining.remove(node)
        k += 1
    return core


def influence_metrics(snapshot: RunSnapshot) -> InfluenceMetrics:  # review:P8-T3
    nodes, edges = _edges(snapshot)
    centrality, iterations = _centrality(nodes, edges)
    kcore = _kcore(nodes, edges)
    in_degree: dict[int, int] = {node: 0 for node in nodes}
    for _, target in edges:
        in_degree[target] = in_degree.get(target, 0) + 1

    ranking = [
        {
            "actor_id": actor_id,
            "in_degree": in_degree.get(actor_id, 0),
            "centrality": round(centrality.get(actor_id, 0.0), 8),
            "structural_influence": round(centrality.get(actor_id, 0.0), 8),
            "kcore": kcore.get(actor_id, 0),
        }
        for actor_id in sorted(nodes)
    ]
    ranking.sort(
        key=lambda item: (
            -item["centrality"],
            -item["in_degree"],
            -item["kcore"],
            item["actor_id"],
        )
    )
    return InfluenceMetrics(
        ranking=ranking,
        top_leaders=[item["actor_id"] for item in ranking[:5]],
        iterations=iterations,
    )
