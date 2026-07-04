from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .eventlog import EventLog
from weiguan.canonical import Platform

from .models import (
    IdentitySummary,
    Launch,
    Person,
    PersonView,
    PersonaKind,
    World,
    WorldEvent,
    persona_starting_standing,
)
from .projector import fold_world


class WorldStore:
    def __init__(self, workdir: str) -> None:
        self.root = Path(workdir) / "worlds"
        self.root.mkdir(parents=True, exist_ok=True)
        self._projection_cache: dict[
            str,
            tuple[tuple[int, int], dict[str, PersonView]],
        ] = {}  # review:P12-T2

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

    def persist_world(self, world_id: str) -> World | None:
        world = self.get_world(world_id)
        if world is None:
            return None
        if not world.persistent:
            world = world.model_copy(update={"persistent": True})
            self._write_json(self._world_path(world.world_id), world.model_dump(mode="json"))
        return world

    def upsert_person(self, world_id: str, person: Person) -> None:
        self.upsert_persons(world_id, [person])

    def upsert_persons(self, world_id: str, persons: list[Person]) -> None:  # review:P12-T4
        if not persons:
            return
        self._world_dir(world_id).mkdir(parents=True, exist_ok=True)
        existing = self._read_persons(world_id)
        by_id = {item.person_id: item for item in existing}
        for person in persons:
            by_id[person.person_id] = person
        ordered = [by_id[key].model_dump(mode="json") for key in sorted(by_id)]
        self._write_json(self._persons_path(world_id), ordered)

    def get_person(self, world_id: str, person_id: str) -> Person | None:  # review:P9-T7
        for person in self._read_persons(world_id):
            if person.person_id == person_id:
                return person
        return None

    def set_clock_tick(self, world_id: str, tick: int) -> World | None:  # review:P9-T2
        world = self.get_world(world_id)
        if world is None:
            return None
        world = world.model_copy(update={"clock_tick": tick})
        self._write_json(self._world_path(world.world_id), world.model_dump(mode="json"))
        return world

    def create_launch(self, launch: Launch | dict) -> Launch:  # review:P12-T5
        item = launch if isinstance(launch, Launch) else Launch.model_validate(launch)
        launches = self._read_launches(item.world_id)
        by_id = {existing.launch_id: existing for existing in launches}
        by_id[item.launch_id] = item
        self._write_launches(item.world_id, list(by_id.values()))
        return item

    def update_launch(
        self, world_id: str, launch_id: str, **updates: object
    ) -> Launch | None:  # review:P12-T5
        launches = self._read_launches(world_id)
        updated: Launch | None = None
        result: list[Launch] = []
        for launch in launches:
            if launch.launch_id == launch_id:
                launch = launch.model_copy(update=updates)
                updated = launch
            result.append(launch)
        if updated is not None:
            self._write_launches(world_id, result)
        return updated

    def list_launches(self, world_id: str) -> list[Launch]:  # review:P12-T5
        return sorted(
            self._read_launches(world_id),
            key=lambda launch: launch.created_at,
            reverse=True,
        )

    def list_all_launches(self) -> list[Launch]:  # review:P12-T5
        launches: list[Launch] = []
        for world_dir in self.root.glob("w_*"):
            if not world_dir.is_dir():
                continue
            world = self.get_world(world_dir.name)
            if world is None or not world.persistent:
                continue
            launches.extend(self.list_launches(world.world_id))
        return sorted(launches, key=lambda launch: launch.created_at, reverse=True)

    def find_launch_for_runs(
        self, world_id: str, run_ids: set[str]
    ) -> Launch | None:  # review:P12-T5
        if not run_ids:
            return None
        for launch in self._read_launches(world_id):
            if set(launch.run_ids).issuperset(run_ids):
                return launch
        return None

    def create_person(
        self,
        world_id: str,
        *,
        display_name: str,
        persona_kind: PersonaKind,
        platform: Platform,
        handle: str,
    ) -> Person:  # review:P7-T1
        from .models import Account

        followers, influence = persona_starting_standing(persona_kind)
        person_id = f"p_{uuid4().hex}"
        person = Person(
            person_id=person_id,
            display_name=display_name,
            persona_kind=persona_kind,
            accounts=[
                Account(
                    account_id=f"acct_{world_id}_{platform.value}_{person_id}",
                    person_id=person_id,
                    platform=platform,
                    handle=handle,
                    avatar_seed=handle,
                    num_followers=followers,
                    influence_score=influence,
                )
            ],
        )
        self.upsert_person(world_id, person)
        return person

    def list_persons(self, world_id: str) -> list[PersonView]:
        world = self.get_world(world_id)
        if world is None:
            return []
        views = self._fold_cached(world)
        return [views[person_id] for person_id in sorted(views)]

    def get_person_view(self, world_id: str, person_id: str) -> PersonView | None:
        world = self.get_world(world_id)
        if world is None:
            return None
        views = self._fold_cached(world)
        return views.get(person_id)

    def list_identities(self) -> list[IdentitySummary]:  # review:P7-T11
        identities: list[IdentitySummary] = []
        for world_dir in sorted(self.root.glob("w_*")):
            if not world_dir.is_dir():
                continue
            world = self.get_world(world_dir.name)
            if world is None or not world.persistent:
                continue
            views = self._fold_cached(world)
            for view in views.values():
                identities.append(
                    IdentitySummary(
                        world_id=world.world_id,
                        person_id=view.person.person_id,
                        display_name=view.person.display_name,
                        persona_kind=view.person.persona_kind,
                        total_influence=view.total_influence,
                        run_count=len(view.run_ids),
                    )
                )
        return sorted(
            identities,
            key=lambda item: (-item.total_influence, item.person_id),
        )

    def append_event(self, event: WorldEvent) -> None:
        self._eventlog(event.world_id).append(event)

    def read_frames(self, run_id: str) -> list[WorldEvent]:
        frames: list[WorldEvent] = []
        for world_dir in self.root.glob("w_*"):
            if not world_dir.is_dir():
                continue
            frames.extend(EventLog(str(world_dir / "events.jsonl")).read(run_id=run_id))
        return sorted(frames, key=lambda event: (event.tick, event.created_at, event.event_id))

    def read_world_events(self, world_id: str) -> list[WorldEvent]:  # review:P9-T2
        return self._eventlog(world_id).read()

    def read_world_events_page(
        self,
        world_id: str,
        *,
        after: int = 0,
        run_ids: set[str] | None = None,
    ) -> tuple[list[WorldEvent], int]:  # review:P12-T1
        return self._eventlog(world_id).read_page(after=after, run_ids=run_ids)

    def _world_dir(self, world_id: str) -> Path:
        return self.root / world_id

    def _world_path(self, world_id: str) -> Path:
        return self._world_dir(world_id) / "world.json"

    def _persons_path(self, world_id: str) -> Path:
        return self._world_dir(world_id) / "persons.json"

    def _eventlog(self, world_id: str) -> EventLog:
        return EventLog(str(self._world_dir(world_id) / "events.jsonl"))

    def _launches_path(self, world_id: str) -> Path:
        return self._world_dir(world_id) / "launches.json"

    def _read_launches(self, world_id: str) -> list[Launch]:
        path = self._launches_path(world_id)
        if not path.exists():
            return []
        return [Launch.model_validate(item) for item in self._read_json(path)]

    def _write_launches(self, world_id: str, launches: list[Launch]) -> None:
        ordered = sorted(launches, key=lambda launch: launch.created_at, reverse=True)
        self._write_json(
            self._launches_path(world_id),
            [launch.model_dump(mode="json") for launch in ordered],
        )

    def _projection_key(self, world_id: str) -> tuple[int, int]:  # review:P12-T2
        events_path = self._world_dir(world_id) / "events.jsonl"
        persons_path = self._persons_path(world_id)
        events_bytes = events_path.stat().st_size if events_path.exists() else 0
        persons_bytes = persons_path.stat().st_size if persons_path.exists() else 0
        return events_bytes, persons_bytes

    def _fold_cached(self, world: World) -> dict[str, PersonView]:  # review:P12-T2
        key = self._projection_key(world.world_id)
        cached = self._projection_cache.get(world.world_id)
        if cached is not None and cached[0] == key:
            return cached[1]

        views = fold_world(
            world,
            self._read_persons(world.world_id),
            self._eventlog(world.world_id).read(),
        )
        self._projection_cache[world.world_id] = (key, views)
        return views

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
