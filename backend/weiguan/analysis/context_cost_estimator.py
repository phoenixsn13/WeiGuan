from __future__ import annotations

import json
import math
import sqlite3
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from weiguan.analysis.attention_context import (
    AttentionContextConfig,
    build_attention_context,
)


@dataclass(frozen=True)
class DeepSeekUsage:
    input_cache_hit_tokens: int
    input_cache_miss_tokens: int
    output_tokens: int

    @property
    def total_tokens(self) -> int:
        return (
            self.input_cache_hit_tokens
            + self.input_cache_miss_tokens
            + self.output_tokens
        )


@dataclass(frozen=True)
class EstimatorConfig:
    comment_budget: int = 12
    direct_k: int = 3
    recent_k: int = 4
    salient_k: int = 3
    per_stance_k: int = 1
    comment_chars: int = 160
    fixed_prompt_tokens: int = 2_000
    token_char_ratio: float = 0.45
    usd_cny: float = 7.25
    input_cache_hit_usd_per_million: float = 0.003625
    input_cache_miss_usd_per_million: float = 0.435
    output_usd_per_million: float = 0.87


@dataclass(frozen=True)
class StepEstimate:
    step: int
    requests: int
    old_tokens: int
    attention_tokens: int
    old_avg_tokens: int
    attention_avg_tokens: int
    max_visible_comments: int


@dataclass(frozen=True)
class AlgorithmEstimate:
    total_tokens: int
    input_tokens: int
    output_tokens: int
    estimated_rmb_all_miss: float
    max_visible_comments: int


@dataclass(frozen=True)
class ContextCostReport:
    db_path: str
    total_requests: int
    steps: list[StepEstimate]
    old: AlgorithmEstimate
    attention: AlgorithmEstimate
    actual_usage: DeepSeekUsage | None = None
    old_vs_actual_error_pct: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def estimate_tokens(text: str, ratio: float = 0.45) -> int:
    return math.ceil(len(text) * ratio)


def _attention_payload(
    posts: list[dict[str, Any]],
    actor_id: int,
    config: EstimatorConfig,
) -> tuple[str, int]:
    context = build_attention_context(
        posts,
        actor_id,
        AttentionContextConfig(
            comment_budget=config.comment_budget,
            direct_k=config.direct_k,
            recent_k=config.recent_k,
            salient_k=config.salient_k,
            per_stance_k=config.per_stance_k,
            comment_chars=config.comment_chars,
        ),
    )
    return context.to_json(), len(context.visible_comments)


def _rows(db_path: Path) -> list[sqlite3.Row]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        return conn.execute(
            """
            SELECT user_id, created_at, info
            FROM trace
            WHERE action='refresh'
            ORDER BY created_at, user_id
            """
        ).fetchall()
    finally:
        conn.close()


def _estimate_rmb(input_tokens: int, output_tokens: int, config: EstimatorConfig) -> float:
    usd = (
        input_tokens / 1_000_000 * config.input_cache_miss_usd_per_million
        + output_tokens / 1_000_000 * config.output_usd_per_million
    )
    return round(usd * config.usd_cny, 4)


def estimate_context_costs(
    db_path: str | Path,
    *,
    config: EstimatorConfig = EstimatorConfig(),
    actual_usage: DeepSeekUsage | None = None,
) -> ContextCostReport:
    path = Path(db_path)
    step_values: dict[int, dict[str, Any]] = {}
    max_visible_comments = 0

    for row in _rows(path):
        try:
            info = json.loads(row["info"] or "{}")
        except json.JSONDecodeError:
            info = {}
        posts = info.get("posts") if isinstance(info.get("posts"), list) else []
        old_payload = json.dumps(info, ensure_ascii=False, separators=(",", ":"))
        attention_payload, visible_count = _attention_payload(
            posts,
            int(row["user_id"]),
            config,
        )
        max_visible_comments = max(max_visible_comments, visible_count)
        step = int(row["created_at"])
        bucket = step_values.setdefault(
            step,
            {"requests": 0, "old": 0, "attention": 0, "max_visible_comments": 0},
        )
        bucket["requests"] += 1
        bucket["old"] += estimate_tokens(old_payload, config.token_char_ratio)
        bucket["attention"] += estimate_tokens(
            attention_payload,
            config.token_char_ratio,
        )
        bucket["max_visible_comments"] = max(
            bucket["max_visible_comments"],
            visible_count,
        )

    steps: list[StepEstimate] = []
    total_requests = 0
    old_context_tokens = 0
    attention_context_tokens = 0
    for step, values in sorted(step_values.items()):
        requests = int(values["requests"])
        old_tokens = int(values["old"]) + requests * config.fixed_prompt_tokens
        attention_tokens = int(values["attention"]) + requests * config.fixed_prompt_tokens
        total_requests += requests
        old_context_tokens += old_tokens
        attention_context_tokens += attention_tokens
        steps.append(
            StepEstimate(
                step=step,
                requests=requests,
                old_tokens=old_tokens,
                attention_tokens=attention_tokens,
                old_avg_tokens=round(old_tokens / requests) if requests else 0,
                attention_avg_tokens=round(attention_tokens / requests)
                if requests
                else 0,
                max_visible_comments=int(values["max_visible_comments"]),
            )
        )

    old = AlgorithmEstimate(
        total_tokens=old_context_tokens,
        input_tokens=old_context_tokens,
        output_tokens=0,
        estimated_rmb_all_miss=_estimate_rmb(old_context_tokens, 0, config),
        max_visible_comments=max(
            (step.max_visible_comments for step in steps),
            default=0,
        ),
    )
    attention = AlgorithmEstimate(
        total_tokens=attention_context_tokens,
        input_tokens=attention_context_tokens,
        output_tokens=0,
        estimated_rmb_all_miss=_estimate_rmb(attention_context_tokens, 0, config),
        max_visible_comments=max_visible_comments,
    )

    error_pct = None
    if actual_usage is not None and actual_usage.total_tokens:
        error_pct = round(
            (old.total_tokens - actual_usage.total_tokens)
            / actual_usage.total_tokens
            * 100,
            2,
        )

    return ContextCostReport(
        db_path=str(path),
        total_requests=total_requests,
        steps=steps,
        old=old,
        attention=attention,
        actual_usage=actual_usage,
        old_vs_actual_error_pct=error_pct,
    )


def write_json_report(report: ContextCostReport, path: str | Path) -> None:
    Path(path).write_text(
        json.dumps(report.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
