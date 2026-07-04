from __future__ import annotations

from collections.abc import AsyncIterator

from weiguan.api.runner import RunRunner
from weiguan.api.store import RunStore
from weiguan.canonical import RunSnapshot
from weiguan.engine.base import RunDelta
from weiguan.engine.config import Audience, RunConfig


def _cfg(steps: int = 10) -> RunConfig:
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content="写入治理测试",
        steps=steps,
        llm_key="sk-test",
        llm_model="fake",
    )


class TenStepEngine:
    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        for step in range(1, 11):
            yield RunDelta(step=step, snapshot=RunSnapshot())

    async def interview(
        self,
        config: RunConfig,
        snapshot: RunSnapshot,
        actor_id: int,
        question: str,
    ) -> str:
        return "ok"


class DeferredTask:
    def __init__(self, coroutine) -> None:
        self.coroutine = coroutine

    def done(self) -> bool:
        return False


async def test_runner_does_not_persist_every_delta(tmp_path, monkeypatch):  # review:P12-T4
    store = RunStore(tmp_path / "runs.json")
    run_id = store.create(_cfg())
    save_count = 0
    scheduled: list[DeferredTask] = []

    def counting_save() -> None:
        nonlocal save_count
        save_count += 1

    def task_factory(coroutine):
        task = DeferredTask(coroutine)
        scheduled.append(task)
        return task

    monkeypatch.setattr(store, "save", counting_save)
    runner = RunRunner(store, TenStepEngine(), task_factory=task_factory)

    runner.start(run_id)
    await scheduled[0].coroutine

    assert store.get(run_id).status == "done"
    assert save_count <= 4
