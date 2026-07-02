from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from pydantic import BaseModel

from weiguan.analysis.attention_context import classify_stance
from weiguan.analysis.stance import stance_polarity
from weiguan.canonical import RunSnapshot


class OpinionMetrics(BaseModel):
    stance_by_tick: list[dict[str, Any]]
    convergence_trend: str
    polarization_index: float
    homophily: float
    cross_stance_ratio: float
    echo_chamber_risk: str


def _tick(value: str | None) -> str:
    return str(value if value is not None else "0")


def _tick_key(value: str) -> tuple[int, str]:
    try:
        return (0, f"{int(value):012d}")
    except ValueError:
        return (1, value)


def _stance_for_text(text: str | None) -> str:
    if not (text or "").strip():
        return "neutral"
    return classify_stance(text)


def _polarity_for_text(text: str | None) -> int:
    return stance_polarity(_stance_for_text(text))


def _purity(counts: Counter[str]) -> float:
    total = sum(counts.values())
    if total <= 0:
        return 0.0
    positive = sum(count for label, count in counts.items() if stance_polarity(label) > 0)
    negative = sum(count for label, count in counts.items() if stance_polarity(label) < 0)
    if positive + negative == 0:
        return 0.0
    return abs(positive - negative) / (positive + negative)


def _convergence_trend(buckets: list[dict[str, Any]]) -> str:
    if len(buckets) < 2:
        return "stable"
    first = _purity(Counter(buckets[0]["stance_counts"]))
    last = _purity(Counter(buckets[-1]["stance_counts"]))
    if last > first + 0.2:
        return "converging"
    if first > last + 0.2:
        return "diverging"
    return "stable"


def _polarization_index(counts: Counter[str]) -> float:
    positive = sum(count for label, count in counts.items() if stance_polarity(label) > 0)
    negative = sum(count for label, count in counts.items() if stance_polarity(label) < 0)
    engaged = positive + negative
    total = sum(counts.values())
    if engaged == 0 or total == 0:
        return 0.0
    balance = 2 * min(positive, negative) / engaged
    return round(balance * (engaged / total), 4)


def _actor_polarities(snapshot: RunSnapshot) -> dict[int, int]:
    polarities: dict[int, list[int]] = defaultdict(list)
    seed = snapshot.seed_post_id
    for post in snapshot.posts:
        if post.post_id == seed:
            continue
        polarity = _polarity_for_text(post.content or post.quote_content)
        if polarity:
            polarities[post.author_id].append(polarity)
    for reply in snapshot.replies:
        polarity = _polarity_for_text(reply.content)
        if polarity:
            polarities[reply.author_id].append(polarity)

    actor_scores: dict[int, int] = {}
    for actor_id, values in polarities.items():
        score = sum(values)
        actor_scores[actor_id] = 1 if score > 0 else -1 if score < 0 else 0
    return actor_scores


def _interaction_ratios(snapshot: RunSnapshot) -> tuple[float, float]:
    actor_polarities = _actor_polarities(snapshot)
    post_authors = {post.post_id: post.author_id for post in snapshot.posts}
    same = 0
    cross = 0
    for reply in snapshot.replies:
        source = actor_polarities.get(reply.author_id)
        target = actor_polarities.get(post_authors.get(reply.post_id, -1))
        if not source or not target:
            continue
        if source == target:
            same += 1
        else:
            cross += 1
    total = same + cross
    if total == 0:
        return (0.0, 0.0)
    return (round(same / total, 4), round(cross / total, 4))


def opinion_metrics(snapshot: RunSnapshot) -> OpinionMetrics:  # review:P8-T2
    by_tick: dict[str, Counter[str]] = defaultdict(Counter)
    total_counts: Counter[str] = Counter()

    for post in snapshot.posts:
        if post.post_id == snapshot.seed_post_id:
            continue
        stance = _stance_for_text(post.content or post.quote_content)
        by_tick[_tick(post.created_at)][stance] += 1
        total_counts[stance] += 1
    for reply in snapshot.replies:
        stance = _stance_for_text(reply.content)
        by_tick[_tick(reply.created_at)][stance] += 1
        total_counts[stance] += 1

    stance_by_tick = [
        {"tick": tick, "stance_counts": dict(by_tick[tick])}
        for tick in sorted(by_tick, key=_tick_key)
    ]
    polarization = _polarization_index(total_counts)
    homophily, cross_stance = _interaction_ratios(snapshot)
    if polarization >= 0.7 and cross_stance <= 0.25:
        risk = "high"
    elif polarization >= 0.4:
        risk = "medium"
    else:
        risk = "low"

    return OpinionMetrics(
        stance_by_tick=stance_by_tick,
        convergence_trend=_convergence_trend(stance_by_tick),
        polarization_index=polarization,
        homophily=homophily,
        cross_stance_ratio=cross_stance,
        echo_chamber_risk=risk,
    )
