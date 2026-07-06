from __future__ import annotations

import re

from weiguan.canonical import Platform
from weiguan.engine.config import Audience, RunConfig
from weiguan.world.models import PersonaKind
from weiguan.world.run_bridge import ensure_world_for_run
from weiguan.world.store import WorldStore


NAKED_ID = re.compile(r"[0-9a-f]{12,}")


def _cfg(**kw) -> RunConfig:
    base = {
        "audience": Audience(crowd_id="tech_devs"),
        "content": "新身份发起也要沉淀",
        "steps": 2,
        "platform": Platform.TWITTER,
        "llm_key": "sk",
        "llm_model": "m",
    }
    base.update(kw)
    return RunConfig(**base)


def test_new_run_world_is_persistent_without_world_or_person(tmp_path):  # review:P14-T3
    store = WorldStore(str(tmp_path))

    world, person = ensure_world_for_run(store, _cfg())

    assert world.persistent is True
    assert store.get_world(world.world_id).persistent is True
    assert person.display_name.startswith("普通人·")
    assert not NAKED_ID.search(person.display_name)


def test_new_world_receives_optional_name(tmp_path):  # review:P14-T3
    store = WorldStore(str(tmp_path))

    world, _ = ensure_world_for_run(store, _cfg(world_name="测试世界"))

    assert store.get_world(world.world_id).name == "测试世界"


def test_existing_world_name_is_not_overwritten(tmp_path):  # review:P14-T3
    store = WorldStore(str(tmp_path))
    existing = store.create_world(persistent=True, name="原来的世界")

    world, _ = ensure_world_for_run(
        store,
        _cfg(world_id=existing.world_id, world_name="不应该覆盖"),
    )

    assert world.world_id == existing.world_id
    assert store.get_world(existing.world_id).name == "原来的世界"


def test_named_person_keeps_display_name_safe(tmp_path):  # review:P14-T3
    store = WorldStore(str(tmp_path))

    _, person = ensure_world_for_run(
        store,
        _cfg(poster_person_id="p_author", poster_persona=PersonaKind.KOL),
    )

    assert person.display_name == "KOL·thor"
    assert not NAKED_ID.search(person.display_name)
