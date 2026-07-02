from __future__ import annotations

from pydantic import BaseModel

from weiguan.canonical import RunSnapshot

from .diffusion import DiffusionMetrics, diffusion_metrics
from .influence import InfluenceMetrics, influence_metrics
from .opinion import OpinionMetrics, opinion_metrics
from .temporal import TemporalMetrics, temporal_metrics


class AnalysisProjection(BaseModel):
    diffusion: DiffusionMetrics
    opinion: OpinionMetrics
    influence: InfluenceMetrics
    temporal: TemporalMetrics


def analyze(snapshot: RunSnapshot) -> AnalysisProjection:  # review:P8-T5
    return AnalysisProjection(
        diffusion=diffusion_metrics(snapshot),
        opinion=opinion_metrics(snapshot),
        influence=influence_metrics(snapshot),
        temporal=temporal_metrics(snapshot),
    )
