from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel


class RunMetric(BaseModel):
    world_id: str | None
    run_id: str
    tick: int
    platform: str | None
    wall_ms: float
    active_accounts: int
    llm_calls: int
    snapshot_delta_size: int


class MetricSink(Protocol):
    def record(self, metric: RunMetric) -> None:
        ...


class NullSink:
    def record(self, metric: RunMetric) -> None:  # review:P10-T4
        return None


class MemorySink:
    def __init__(self) -> None:
        self.metrics = []

    def record(self, metric: RunMetric) -> None:  # review:P10-T4
        self.metrics.append(metric)


def emit(sink: MetricSink, metric: RunMetric) -> None:  # review:P10-T4
    try:
        sink.record(metric)
    except Exception:
        return None
