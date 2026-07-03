from __future__ import annotations

from typing import Protocol

from weiguan.analysis.social_metrics.projection import AnalysisProjection, analyze
from weiguan.canonical import RunSnapshot


class AnalysisProvider(Protocol):
    """Analysis provider contract.

    Extension points intentionally stay unimplemented in P10:
    - NetworkxAnalysisProvider for third-party graph analysis.
    - RemoteAnalysisProvider for http/grpc/mq-backed analysis workers.

    Implementations must return the serializable AnalysisProjection contract,
    which can be emitted with model_dump(mode="json").
    """

    def analyze(self, snapshot: RunSnapshot) -> AnalysisProjection:
        ...


class EmbeddedAnalysisProvider:
    """Default in-process provider that wraps the P8 embedded projection."""

    def analyze(self, snapshot: RunSnapshot) -> AnalysisProjection:  # review:P10-T1
        return analyze(snapshot)


def default_analysis_provider() -> AnalysisProvider:  # review:P10-T1
    return EmbeddedAnalysisProvider()
