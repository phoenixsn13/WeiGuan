from __future__ import annotations

from uuid import uuid4

from weiguan.api.store import RunStore

from .models import Launch, PersonaKind
from .store import WorldStore


_LAUNCH_STATUSES = {"running", "done", "error"}


def _launch_status(status: str) -> str:
    return status if status in _LAUNCH_STATUSES else "running"


def backfill_single_launches(run_store: RunStore, world_store: WorldStore) -> int:
    covered_run_ids: set[str] = set()
    for launch in world_store.list_all_launches():
        covered_run_ids.update(launch.run_ids)

    created = 0
    for record in run_store.list():
        if record.run_id in covered_run_ids:
            continue
        world_id = record.config.world_id
        if not world_id or world_store.get_world(world_id) is None:
            continue
        world_store.create_launch(
            Launch(
                launch_id=f"launch_{uuid4().hex}",
                world_id=world_id,
                content=record.config.content,
                steps=record.config.steps,
                platforms=[record.config.platform],
                run_ids=[record.run_id],
                status=_launch_status(record.status),
                clock_tick=record.current_step,
                poster_person_id=record.config.poster_person_id,
                poster_persona=record.config.poster_persona or PersonaKind.ORDINARY,
                error=record.error,
                created_at=record.created_at,
            )
        )
        covered_run_ids.add(record.run_id)
        created += 1
    return created
