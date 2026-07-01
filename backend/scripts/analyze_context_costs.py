from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from weiguan.analysis.context_cost_estimator import (
    DeepSeekUsage,
    EstimatorConfig,
    estimate_context_costs,
)


DEFAULT_USAGE = DeepSeekUsage(
    input_cache_hit_tokens=14_159_232,
    input_cache_miss_tokens=31_824_521,
    output_tokens=313_562,
)


def _actual_rmb(usage: DeepSeekUsage, config: EstimatorConfig) -> float:
    usd = (
        usage.input_cache_hit_tokens
        / 1_000_000
        * config.input_cache_hit_usd_per_million
        + usage.input_cache_miss_tokens
        / 1_000_000
        * config.input_cache_miss_usd_per_million
        + usage.output_tokens / 1_000_000 * config.output_usd_per_million
    )
    return round(usd * config.usd_cny, 2)


def _discover_dbs(root: Path) -> list[Path]:
    return sorted(root.glob("*/run.db"))


def _aggregate(reports):
    old = sum(report.old.total_tokens for report in reports)
    attention = sum(report.attention.total_tokens for report in reports)
    requests = sum(report.total_requests for report in reports)
    return old, attention, requests


def _svg(points_old, points_new, path: Path) -> None:
    width = 1000
    height = 480
    pad_l = 80
    pad_r = 30
    pad_t = 40
    pad_b = 70
    plot_w = width - pad_l - pad_r
    plot_h = height - pad_t - pad_b
    values = [v for _, v in points_old + points_new]
    max_v = max(values) if values else 1
    max_v = max(max_v, 1)
    n = max(len(points_old), len(points_new), 1)

    def xy(idx, value):
        x = pad_l + (plot_w * idx / max(n - 1, 1))
        y = pad_t + plot_h - (plot_h * value / max_v)
        return round(x, 2), round(y, 2)

    def poly(points):
        return " ".join(f"{x},{y}" for x, y in (xy(i, value) for i, (_, value) in enumerate(points)))

    y_ticks = []
    for i in range(6):
        value = max_v * i / 5
        _x, y = xy(0, value)
        y_ticks.append((value, y))

    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
        '<text x="80" y="26" font-family="Arial" font-size="20" fill="#111">OASIS Context Cost: old full-history vs attention-budgeted</text>',
        f'<line x1="{pad_l}" y1="{pad_t}" x2="{pad_l}" y2="{pad_t + plot_h}" stroke="#94a3b8"/>',
        f'<line x1="{pad_l}" y1="{pad_t + plot_h}" x2="{pad_l + plot_w}" y2="{pad_t + plot_h}" stroke="#94a3b8"/>',
    ]
    for value, y in y_ticks:
        body.append(f'<line x1="{pad_l}" y1="{y}" x2="{pad_l + plot_w}" y2="{y}" stroke="#e2e8f0"/>')
        body.append(f'<text x="8" y="{y + 4}" font-family="Arial" font-size="12" fill="#475569">{int(value):,}</text>')
    if points_old:
        body.append(f'<polyline points="{poly(points_old)}" fill="none" stroke="#ef4444" stroke-width="3"/>')
    if points_new:
        body.append(f'<polyline points="{poly(points_new)}" fill="none" stroke="#2563eb" stroke-width="3"/>')
    body.extend(
        [
            '<rect x="720" y="54" width="240" height="72" fill="white" stroke="#cbd5e1"/>',
            '<line x1="740" y1="78" x2="790" y2="78" stroke="#ef4444" stroke-width="3"/>',
            '<text x="800" y="82" font-family="Arial" font-size="14" fill="#111">old full context</text>',
            '<line x1="740" y1="108" x2="790" y2="108" stroke="#2563eb" stroke-width="3"/>',
            '<text x="800" y="112" font-family="Arial" font-size="14" fill="#111">attention budget</text>',
            f'<text x="{width / 2 - 40}" y="{height - 18}" font-family="Arial" font-size="14" fill="#475569">refresh step index</text>',
            '</svg>',
        ]
    )
    path.write_text("\n".join(body), encoding="utf-8")


def _markdown(reports, config: EstimatorConfig, usage: DeepSeekUsage, svg_name: str) -> str:
    old_total, attention_total, requests = _aggregate(reports)
    actual_total = usage.total_tokens
    actual_rmb = _actual_rmb(usage, config)
    old_error = round((old_total - actual_total) / actual_total * 100, 2)
    attention_error = round((attention_total - actual_total) / actual_total * 100, 2)
    reduction = round((1 - attention_total / old_total) * 100, 2) if old_total else 0

    lines = [
        "# OASIS Context Cost Dry Run",
        "",
        "This report is generated offline from historical SQLite `run.db` files and does not call any LLM.",
        "",
        "## DeepSeek Actual Usage",
        "",
        f"- API requests: 719",
        f"- Total tokens: {actual_total:,}",
        f"- Input cache hit: {usage.input_cache_hit_tokens:,}",
        f"- Input cache miss: {usage.input_cache_miss_tokens:,}",
        f"- Output: {usage.output_tokens:,}",
        f"- Estimated actual cost: {actual_rmb} RMB",
        "",
        "## Aggregate Estimate",
        "",
        f"- Historical refresh requests in DBs: {requests:,}",
        f"- Old full-context estimate: {old_total:,} tokens",
        f"- Attention-budget estimate: {attention_total:,} tokens",
        f"- Estimated reduction: {reduction}%",
        f"- Old estimate vs DeepSeek actual: {old_error}% error",
        f"- Attention estimate vs DeepSeek actual: {attention_error}% delta",
        "",
        f"![cost comparison]({svg_name})",
        "",
        "## Per Run",
        "",
        "| run.db | requests | old tokens | attention tokens | old RMB all miss | attention RMB all miss |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for report in reports:
        lines.append(
            "| "
            f"{Path(report.db_path).parent.name} | "
            f"{report.total_requests:,} | "
            f"{report.old.total_tokens:,} | "
            f"{report.attention.total_tokens:,} | "
            f"{report.old.estimated_rmb_all_miss:.2f} | "
            f"{report.attention.estimated_rmb_all_miss:.2f} |"
        )
    lines.extend(
        [
            "",
            "## Model",
            "",
            "Old full-context cost grows with accumulated comments visible in each refresh trace.",
            "",
            "```text",
            "Old:       Total ~= sum_t A_t * (B + visible_posts_t + all_visible_comments_t)",
            "Attention: Total <= sum_t A_t * (B + seed_panel + bounded_comment_budget)",
            "```",
            "",
            "After bounding comment context, historical comment count affects deterministic panel counts and selection, not prompt size directly.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs-root", default="/tmp/weiguan-e2e/runs")
    parser.add_argument("--out-dir", default="../docs/manual/assets/context-cost")
    parser.add_argument("--fixed-prompt-tokens", type=int, default=2_000)
    args = parser.parse_args()

    config = EstimatorConfig(fixed_prompt_tokens=args.fixed_prompt_tokens)
    dbs = _discover_dbs(Path(args.runs_root))
    if not dbs:
        raise SystemExit(f"No run.db files found under {args.runs_root}")

    reports = [
        estimate_context_costs(db, config=config, actual_usage=DEFAULT_USAGE)
        for db in dbs
    ]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = {
        "config": asdict(config),
        "actual_usage": asdict(DEFAULT_USAGE),
        "reports": [report.to_dict() for report in reports],
    }
    (out_dir / "context-cost-comparison.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    old_points = []
    attention_points = []
    idx = 0
    for report in reports:
        for step in report.steps:
            old_points.append((idx, step.old_tokens))
            attention_points.append((idx, step.attention_tokens))
            idx += 1
    _svg(old_points, attention_points, out_dir / "context-cost-comparison.svg")

    (out_dir / "context-cost-comparison.md").write_text(
        _markdown(
            reports,
            config,
            DEFAULT_USAGE,
            "context-cost-comparison.svg",
        ),
        encoding="utf-8",
    )
    print(out_dir / "context-cost-comparison.md")


if __name__ == "__main__":
    main()
