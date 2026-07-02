from __future__ import annotations

from pathlib import Path

from .models import WorldEvent


class EventLog:
    """Append-only JSONL event log."""

    def __init__(self, path: str) -> None:
        self.path = Path(path)

    def append(self, event: WorldEvent) -> None:  # review:P6-T2
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as file:
            file.write(event.model_dump_json())
            file.write("\n")

    def read(self, *, run_id: str | None = None) -> list[WorldEvent]:
        if not self.path.exists():
            return []

        events: list[WorldEvent] = []
        with self.path.open("r", encoding="utf-8") as file:
            for line in file:
                stripped = line.strip()
                if not stripped:
                    continue
                event = WorldEvent.model_validate_json(stripped)
                if run_id is None or event.run_id == run_id:
                    events.append(event)

        return sorted(events, key=lambda event: (event.tick, event.created_at, event.event_id))
