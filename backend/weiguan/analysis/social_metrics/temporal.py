from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from pydantic import BaseModel

from weiguan.analysis.attention_context import classify_stance
from weiguan.analysis.stance import stance_polarity
from weiguan.canonical import ReactionKind, RunSnapshot


class TemporalMetrics(BaseModel):
    fermentation_curve: list[dict[str, Any]]
    peak_tick: int
    half_life_ticks: float
    sentiment_reversals: list[dict[str, str]]


def _tick(value: str | None) -> str:
    return str(value if value is not None else "0")


def _tick_key(value: str) -> tuple[int, str]:
    try:
        return (0, f"{int(value):012d}")
    except ValueError:
        return (1, value)


def _tick_number(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return 0.0


def _sentiment_from_score(score: int) -> str:
    if score > 0:
        return "positive"
    if score < 0:
        return "negative"
    return "neutral"


def _text_score(text: str | None) -> int:
    if not (text or "").strip():
        return 0
    return stance_polarity(classify_stance(text))


def _reaction_score(kind: ReactionKind) -> int:
    if kind in {ReactionKind.LIKE, ReactionKind.COMMENT_LIKE}:
        return 1
    if kind in {ReactionKind.DISLIKE, ReactionKind.COMMENT_DISLIKE}:
        return -1
    return 0


def _half_life(curve: list[dict[str, Any]], peak_index: int) -> float:
    if not curve:
        return 0.0
    peak_volume = curve[peak_index]["volume"]
    threshold = peak_volume / 2
    peak_tick = _tick_number(str(curve[peak_index]["tick"]))
    for point in curve[peak_index + 1 :]:
        if point["volume"] <= threshold:
            return _tick_number(str(point["tick"])) - peak_tick
    return 0.0


def temporal_metrics(snapshot: RunSnapshot) -> TemporalMetrics:  # review:P8-T4
    volumes: Counter[str] = Counter()
    sentiment_scores: dict[str, int] = defaultdict(int)

    for post in snapshot.posts:
        if post.post_id == snapshot.seed_post_id:
            continue
        tick = _tick(post.created_at)
        volumes[tick] += 1
        sentiment_scores[tick] += _text_score(post.content or post.quote_content)
    for reply in snapshot.replies:
        tick = _tick(reply.created_at)
        volumes[tick] += 1
        sentiment_scores[tick] += _text_score(reply.content)
    for reaction in snapshot.reactions:
        tick = _tick(reaction.created_at)
        volumes[tick] += 1
        sentiment_scores[tick] += _reaction_score(reaction.kind)

    curve = [
        {
            "tick": tick,
            "volume": volumes[tick],
            "sentiment": _sentiment_from_score(sentiment_scores[tick]),
        }
        for tick in sorted(volumes, key=_tick_key)
    ]
    if not curve:
        return TemporalMetrics(
            fermentation_curve=[],
            peak_tick=0,
            half_life_ticks=0.0,
            sentiment_reversals=[],
        )

    peak_index = max(
        range(len(curve)),
        key=lambda index: (curve[index]["volume"], -index),
    )
    reversals: list[dict[str, str]] = []
    previous = curve[0]["sentiment"]
    for point in curve[1:]:
        current = point["sentiment"]
        if current != previous and current != "neutral" and previous != "neutral":
            reversals.append({"tick": str(point["tick"]), "from": previous, "to": current})
        if current != "neutral":
            previous = current

    return TemporalMetrics(
        fermentation_curve=curve,
        peak_tick=int(_tick_number(str(curve[peak_index]["tick"]))),
        half_life_ticks=_half_life(curve, peak_index),
        sentiment_reversals=reversals,
    )
