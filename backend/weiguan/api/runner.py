from __future__ import annotations

import asyncio
from collections.abc import Callable

from weiguan.api.store import RunStore
from weiguan.engine.base import Engine
from weiguan.canonical import RunSnapshot


class RunEvent:
    def __init__(
        self,
        kind: str,
        step: int,
        snapshot: RunSnapshot | None = None,
        message: str | None = None,
    ) -> None:
        self.kind = kind
        self.step = step
        self.snapshot = snapshot
        self.message = message


class RunRunner:
    def __init__(
        self,
        store: RunStore,
        engine: Engine,
        task_factory: Callable[[object], asyncio.Task] | None = None,
    ) -> None:
        self._store = store
        self._engine = engine
        self._tasks: dict[str, asyncio.Task] = {}
        self._subscribers: dict[str, set[asyncio.Queue[RunEvent]]] = {}
        self._task_factory = task_factory or asyncio.create_task

    def start(self, run_id: str) -> None:
        record = self._store.get(run_id)
        if record is None:
            return
        if record.status in {"running", "done"}:
            return
        existing = self._tasks.get(run_id)
        if existing is not None and not existing.done():
            return
        record.status = "running"
        record.current_step = 0
        self._store.save()
        self._tasks[run_id] = self._task_factory(self._run(run_id))

    def is_active(self, run_id: str) -> bool:
        task = self._tasks.get(run_id)
        return task is not None and not task.done()

    def subscribe(self, run_id: str) -> asyncio.Queue[RunEvent]:
        queue: asyncio.Queue[RunEvent] = asyncio.Queue()
        self._subscribers.setdefault(run_id, set()).add(queue)
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue[RunEvent]) -> None:
        queues = self._subscribers.get(run_id)
        if queues is None:
            return
        queues.discard(queue)
        if not queues:
            self._subscribers.pop(run_id, None)

    def _publish(self, run_id: str, event: RunEvent) -> None:
        for queue in list(self._subscribers.get(run_id, set())):
            queue.put_nowait(event)

    async def _run(self, run_id: str) -> None:
        record = self._store.get(run_id)
        if record is None:
            return
        try:
            async for delta in self._engine.run(record.config):
                record.accumulate(delta.snapshot)
                record.current_step = delta.step
                self._store.save()
                self._publish(
                    run_id,
                    RunEvent("snapshot", record.current_step, record.snapshot),
                )
            record.status = "done"
            record.current_step = record.config.effective_steps
            self._store.save()
            self._publish(run_id, RunEvent("done", record.current_step))
        except Exception as exc:  # noqa: BLE001
            record.status = "error"
            record.error = str(exc)
            self._store.save()
            self._publish(run_id, RunEvent("error", record.current_step, message=str(exc)))
