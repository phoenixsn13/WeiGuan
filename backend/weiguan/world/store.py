from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .eventlog import EventLog
from .models import Person, PersonView, World, WorldEvent
from .projector import fold_world


class WorldStore:
    def __init__(self, workdir: str) -> None:
        self.root = Path(workdir) / "worlds"
        self.root.mkdir(parents=True, exist_ok=True)

    def create_world(self, *, persistent: bool) -> World:  # review:P6-T4
        world = World(
            world_id=f"w_{uuid4().hex}",
            created_at=datetime.now(timezone.utc).isoformat(),
            persistent=persistent,
        )
        self._world_dir(world.world_id).mkdir(parents=True, exist_ok=True)
        self._write_json(self._world_path(world.world_id), world.model_dump(mode="json"))
        if not self._persons_path(world.world_id).exists():
            self._write_json(self._persons_path(world.world_id), [])
        return world

    def get_world(self, world_id: str) -> World | None:
        path = self._world_path(world_id)
        if not path.exists():
            return None
        return World.model_validate(self._read_json(path))

    def upsert_person(self, world_id: str, person: Person) -> None:
        self._world_dir(world_id).mkdir(parents=True, exist_ok=True)
        persons = self._read_persons(world_id)
        by_id = {item.person_id: item for item in persons}
        by_id[person.person_id] = person
        ordered = [by_id[key].model_dump(mode="json") for key in sorted(by_id)]
        self._write_json(self._persons_path(world_id), ordered)

    def get_person_view(self, world_id: str, person_id: str) -> PersonView | None:
        world = self.get_world(world_id)
        if world is None:
            return None
        views = fold_world(world, self._read_persons(world_id), self._eventlog(world_id).read())
        return views.get(person_id)

    def append_event(self, event: WorldEvent) -> None:
        self._eventlog(event.world_id).append(event)

    def read_frames(self, run_id: str) -> list[WorldEvent]:
        frames: list[WorldEvent] = []
        for world_dir in self.root.glob("w_*"):
            if not world_dir.is_dir():
                continue
            frames.extend(EventLog(str(world_dir / "events.jsonl")).read(run_id=run_id))
        return sorted(frames, key=lambda event: (event.tick, event.created_at, event.event_id))

    def _world_dir(self, world_id: str) -> Path:
        return self.root / world_id

    def _world_path(self, world_id: str) -> Path:
        return self._world_dir(world_id) / "world.json"

    def _persons_path(self, world_id: str) -> Path:
        return self._world_dir(world_id) / "persons.json"

    def _eventlog(self, world_id: str) -> EventLog:
        return EventLog(str(self._world_dir(world_id) / "events.jsonl"))

    def _read_persons(self, world_id: str) -> list[Person]:
        path = self._persons_path(world_id)
        if not path.exists():
            return []
        return [Person.model_validate(item) for item in self._read_json(path)]

    @staticmethod
    def _read_json(path: Path) -> object:
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(path: Path, data: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
