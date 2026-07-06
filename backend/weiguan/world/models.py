from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from weiguan.canonical import Platform


# review:P6-T1
class PersonaKind(str, Enum):
    ORDINARY = "ordinary"
    VERIFIED = "verified"
    KOL = "kol"


class WorldEventKind(str, Enum):
    SEED = "seed"
    POST = "post"
    REPLY = "reply"
    REACTION = "reaction"
    FOLLOW = "follow"
    REPORT = "report"
    BRIDGE_INJECT = "bridge_inject"


class Account(BaseModel):
    account_id: str
    person_id: str
    platform: Platform
    handle: str
    avatar_seed: str = ""
    num_followers: int = 0
    influence_score: float = 0.0


class Person(BaseModel):
    person_id: str
    display_name: str
    persona_kind: PersonaKind
    accounts: list[Account] = Field(default_factory=list)


class World(BaseModel):
    world_id: str
    created_at: str
    clock_tick: int = 0
    persistent: bool = False
    name: str | None = None  # review:P14-T1


class Launch(BaseModel):  # review:P12-T5
    launch_id: str
    world_id: str
    content: str
    steps: int
    platforms: list[Platform]
    run_ids: list[str]
    status: Literal["running", "done", "error"]
    clock_tick: int = 0
    poster_person_id: str | None = None
    poster_persona: PersonaKind
    error: str | None = None
    created_at: str


class WorldEvent(BaseModel):
    event_id: str
    world_id: str
    tick: int
    created_at: str
    platform: Platform
    actor_account_id: str | None = None
    kind: WorldEventKind
    payload: dict = Field(default_factory=dict)
    run_id: str | None = None


class StanceState(BaseModel):
    stance_counts: dict[str, int] = Field(default_factory=dict)
    dominant: str = "other"


class StandingPoint(BaseModel):
    run_id: str
    influence: float = 0.0
    followers: int = 0
    stance_dominant: str = "other"
    stance_score: int = 0


class BoundedMemory(BaseModel):
    stance_line: str = ""
    recent_utterances: list[str] = Field(default_factory=list)


class PersonView(BaseModel):
    person: Person
    stance: StanceState
    total_influence: float = 0.0
    run_ids: list[str] = Field(default_factory=list)
    standing_timeline: list[StandingPoint] = Field(default_factory=list)


class IdentitySummary(BaseModel):
    world_id: str
    person_id: str
    display_name: str
    persona_kind: PersonaKind
    total_influence: float = 0.0
    run_count: int = 0


def persona_starting_standing(kind: PersonaKind) -> tuple[int, float]:
    """(起始粉丝, 起始影响力)。ordinary→低, verified→中, kol→高。"""
    if kind == PersonaKind.ORDINARY:
        return (20, 1.0)
    if kind == PersonaKind.VERIFIED:
        return (2_000, 10.0)
    if kind == PersonaKind.KOL:
        return (50_000, 50.0)
    raise ValueError(f"unknown persona kind: {kind}")
