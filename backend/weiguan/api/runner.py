from __future__ import annotations

import asyncio
from collections.abc import Callable

from weiguan.api.store import RunStore
from weiguan.engine.base import Engine
from weiguan.canonical import RunSnapshot
from weiguan.world.run_bridge import (
    delta_to_events,
    ensure_account_for_actor,
    ensure_world_for_run,
)
from weiguan.world.store import WorldStore


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
        world_store: WorldStore | None = None,
        task_factory: Callable[[object], asyncio.Task] | None = None,
    ) -> None:
        self._store = store
        self._engine = engine
        self._world_store = world_store
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
        world = None
        poster_account_id = None
        account_of: dict[int, str] = {}
        if self._world_store is not None:  # review:P6-T6
            world, poster = ensure_world_for_run(self._world_store, record.config)
            poster_account = next(
                (
                    account
                    for account in poster.accounts
                    if account.platform == record.config.platform
                ),
                None,
            )
            poster_account_id = poster_account.account_id if poster_account else None
        try:
            async for delta in self._engine.run(record.config):
                if self._world_store is not None and world is not None:
                    if poster_account_id is not None:  # review:P9-T7
                        for post in delta.snapshot.posts:
                            if (
                                delta.snapshot.seed_post_id is not None
                                and post.post_id == delta.snapshot.seed_post_id
                            ):
                                account_of[post.author_id] = poster_account_id
                    for actor in delta.snapshot.actors:
                        if actor.user_id not in account_of:
                            account_of[actor.user_id] = ensure_account_for_actor(
                                self._world_store,
                                world_id=world.world_id,
                                platform=record.config.platform,
                                actor_id=actor.user_id,
                                display_name=actor.name
                                or actor.user_name
                                or f"actor_{actor.user_id}",
                            )
                record.accumulate(delta.snapshot)
                record.current_step = delta.step
                self._store.save()
                if self._world_store is not None and world is not None:
                    for event in delta_to_events(
                        delta,
                        world_id=world.world_id,
                        run_id=run_id,
                        platform=record.config.platform,
                        account_of=account_of,
                    ):
                        self._world_store.append_event(event)
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
