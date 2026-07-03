from __future__ import annotations

from pydantic import BaseModel, Field

from weiguan.obs.emit import RunMetric


class PerfDigest(BaseModel):
    run_id: str | None = None
    world_id: str | None = None
    total_ticks: int = 0
    peak_tick: int = 0
    peak_wall_ms: float = 0.0
    total_llm_calls: int = 0
    total_active_accounts: int = 0
    snapshot_growth: int = 0
    hotspots: list[str] = Field(default_factory=list)


def collect(metrics: list[RunMetric]) -> PerfDigest:  # review:P10-T5
    if not metrics:
        return PerfDigest()

    ordered = sorted(metrics, key=lambda item: (item.tick, item.platform or "", item.run_id))
    peak = max(ordered, key=lambda item: (item.wall_ms, -item.tick))
    average_wall = sum(item.wall_ms for item in ordered) / len(ordered)
    snapshot_growth = sum(item.snapshot_delta_size for item in ordered)
    hotspots: list[str] = []
    if average_wall > 0 and peak.wall_ms > average_wall * 2:
        hotspots.append(f"第 {peak.tick} 拍耗时突增，可能存在单拍计算或 LLM 等待瓶颈")
    if snapshot_growth > 1_000:
        hotspots.append("快照增量累计较大，建议检查事件投影和回放内存增长")

    return PerfDigest(
        run_id=ordered[0].run_id if {item.run_id for item in ordered} == {ordered[0].run_id} else None,
        world_id=ordered[0].world_id
        if {item.world_id for item in ordered} == {ordered[0].world_id}
        else None,
        total_ticks=len({item.tick for item in ordered}),
        peak_tick=peak.tick,
        peak_wall_ms=peak.wall_ms,
        total_llm_calls=sum(item.llm_calls for item in ordered),
        total_active_accounts=sum(item.active_accounts for item in ordered),
        snapshot_growth=snapshot_growth,
        hotspots=hotspots,
    )
