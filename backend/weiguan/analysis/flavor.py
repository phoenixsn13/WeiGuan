from __future__ import annotations

from collections import Counter
from typing import Iterable

from pydantic import BaseModel, Field

from weiguan.analysis.attention_context import classify_stance
from weiguan.analysis.provider import default_analysis_provider
from weiguan.analysis.social_metrics.projection import AnalysisProjection
from weiguan.analysis.stance import stance_polarity
from weiguan.canonical import Post, RunSnapshot


class PhaseSample(BaseModel):
    phase: str
    tick_range: tuple[int, int]
    volume: int
    dominant_sentiment: str
    representative_utterances: list[str] = Field(default_factory=list)


class PlatformFlavor(BaseModel):
    platform: str
    persona_mix: dict[str, int]
    spread_shape: str
    phases: list[PhaseSample] = Field(default_factory=list)
    volume: int = 0


class FlavorDigest(BaseModel):
    world_id: str | None = None
    run_ids: list[str] = Field(default_factory=list)
    platforms: list[PlatformFlavor] = Field(default_factory=list)
    cross_platform_notes: list[str] = Field(default_factory=list)


def _tick(value: str | None) -> int:
    try:
        return int(value or 0)
    except ValueError:
        return 0


def _spread_shape(analysis: AnalysisProjection) -> str:
    diffusion = analysis.diffusion
    if diffusion.max_depth >= 3:
        return "链式转发"
    if diffusion.breadth >= 3:
        return "单源爆发"
    if diffusion.cascade_size >= 2:
        return "多点扩散"
    return "零散"


def _phase_for_tick(tick: int, peak_tick: int) -> str:
    if tick <= 0:
        return "seed"
    if peak_tick <= 0:
        return "tail"
    if tick < peak_tick:
        return "early"
    if tick == peak_tick:
        return "peak"
    return "tail"


def _sentiment(texts: Iterable[str]) -> str:
    score = sum(stance_polarity(classify_stance(text)) for text in texts)
    if score > 0:
        return "positive"
    if score < 0:
        return "negative"
    return "neutral"


def _post_text(post: Post) -> str:
    return post.content or post.quote_content or ""


def _utterance_rows(snapshot: RunSnapshot) -> list[tuple[int, int, int, str]]:
    rows: list[tuple[int, int, int, str]] = []
    seed = snapshot.seed_post_id
    for post in snapshot.posts:
        text = _post_text(post)
        if not text:
            continue
        engagement = post.num_likes + post.num_shares + post.num_reports - post.num_dislikes
        tick = 0 if post.post_id == seed else _tick(post.created_at)
        rows.append((tick, engagement, post.post_id, text))
    for reply in snapshot.replies:
        if not reply.content:
            continue
        engagement = reply.num_likes - reply.num_dislikes
        rows.append((_tick(reply.created_at), engagement, reply.comment_id, reply.content))
    return rows


def _representative(rows: list[tuple[int, int, int, str]], limit: int) -> list[str]:
    seen: set[str] = set()
    selected: list[str] = []
    for _, _, _, text in sorted(rows, key=lambda item: (-item[1], item[0], item[2])):
        if text in seen:
            continue
        seen.add(text)
        selected.append(text)
        if len(selected) >= limit:
            break
    return selected


def _persona_mix(snapshot: RunSnapshot) -> dict[str, int]:
    # review:P10-T2
    # RunSnapshot does not carry world Person rows; keep the deterministic
    # embedded fallback as ordinary while route-level world aggregation can
    # enrich this later from WorldStore identities.
    engaged_actor_ids = {post.author_id for post in snapshot.posts} | {
        reply.author_id for reply in snapshot.replies
    }
    return {"ordinary": len(engaged_actor_ids), "verified": 0, "kol": 0}


def _phase_samples(
    snapshot: RunSnapshot,
    analysis: AnalysisProjection,
    utterance_limit: int,
) -> list[PhaseSample]:
    rows = _utterance_rows(snapshot)
    if not rows:
        return []
    peak_tick = analysis.temporal.peak_tick
    grouped: dict[str, list[tuple[int, int, int, str]]] = {
        "seed": [],
        "early": [],
        "peak": [],
        "tail": [],
    }
    for row in rows:
        grouped[_phase_for_tick(row[0], peak_tick)].append(row)

    phases: list[PhaseSample] = []
    for name in ("seed", "early", "peak", "tail"):
        phase_rows = grouped[name]
        if not phase_rows:
            continue
        ticks = [row[0] for row in phase_rows]
        phases.append(
            PhaseSample(
                phase=name,
                tick_range=(min(ticks), max(ticks)),
                volume=len(phase_rows),
                dominant_sentiment=_sentiment(row[3] for row in phase_rows),
                representative_utterances=_representative(phase_rows, utterance_limit),
            )
        )
    return phases


def flavor_digest(
    snapshot: RunSnapshot,
    *,
    analysis: AnalysisProjection | None = None,
    utterance_limit: int = 5,
) -> FlavorDigest:
    """Build deterministic narrative raw material for subjective LLM review."""

    projection = analysis or default_analysis_provider().analyze(snapshot)
    phases = _phase_samples(snapshot, projection, max(1, utterance_limit))
    return FlavorDigest(
        platforms=[
            PlatformFlavor(
                platform=snapshot.platform.value,
                persona_mix=_persona_mix(snapshot),
                spread_shape=_spread_shape(projection),
                phases=phases,
                volume=sum(phase.volume for phase in phases),
            )
        ],
    )
