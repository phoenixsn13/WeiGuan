from weiguan.obs.collect import collect
from weiguan.obs.emit import RunMetric


def _metric(tick: int, wall_ms: float, *, llm_calls: int = 0, growth: int = 1) -> RunMetric:
    return RunMetric(
        world_id="w1",
        run_id="r1",
        tick=tick,
        platform="twitter",
        wall_ms=wall_ms,
        active_accounts=2,
        llm_calls=llm_calls,
        snapshot_delta_size=growth,
    )


def test_collect_identifies_peak_hotspot_and_totals():  # review:P10-T5
    digest = collect(
        [
            _metric(1, 10, llm_calls=1, growth=2),
            _metric(2, 90, llm_calls=3, growth=4),
            _metric(3, 12, llm_calls=2, growth=3),
        ]
    )

    assert digest.run_id == "r1"
    assert digest.world_id == "w1"
    assert digest.total_ticks == 3
    assert digest.peak_tick == 2
    assert digest.peak_wall_ms == 90
    assert digest.total_llm_calls == 6
    assert digest.total_active_accounts == 6
    assert digest.snapshot_growth == 9
    assert any("第 2 拍耗时突增" in item for item in digest.hotspots)


def test_collect_empty_metrics_returns_zero_value():  # review:P10-T5
    digest = collect([])

    assert digest.run_id is None
    assert digest.world_id is None
    assert digest.total_ticks == 0
    assert digest.peak_tick == 0
    assert digest.peak_wall_ms == 0
    assert digest.total_llm_calls == 0
    assert digest.snapshot_growth == 0
    assert digest.hotspots == []
