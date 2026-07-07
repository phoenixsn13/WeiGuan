from __future__ import annotations

from weiguan.api.app import create_app
from weiguan.api.store import RunStore
from weiguan.canonical import Platform
from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.fake import FakeEngine
from weiguan.world.backfill import backfill_single_launches
from weiguan.world.store import WorldStore


def _config(world_id: str | None, *, content: str = "历史单次围观") -> RunConfig:
    return RunConfig(
        audience=Audience(crowd_id="tech_devs"),
        content=content,
        steps=6,
        platform=Platform.TWITTER,
        llm_key="sk-test",
        llm_model="test-model",
        world_id=world_id,
    )


def test_backfill_creates_missing_single_launches_idempotently(tmp_path):  # review:P15-T3
    run_store = RunStore(tmp_path / "runs.json")
    world_store = WorldStore(str(tmp_path))
    world = world_store.create_world(persistent=True, name="历史世界")
    run_id = run_store.create(_config(world.world_id))
    record = run_store.get(run_id)
    assert record is not None
    record.status = "done"
    record.current_step = 6
    run_store.save()

    created = backfill_single_launches(run_store, world_store)
    created_again = backfill_single_launches(run_store, world_store)
    launches = world_store.list_all_launches()
    matching = [launch for launch in launches if launch.run_ids == [run_id]]

    assert created == 1
    assert created_again == 0
    assert len(matching) == 1
    assert matching[0].launch_id.startswith("launch_")
    assert matching[0].world_id == world.world_id
    assert matching[0].content == "历史单次围观"
    assert matching[0].platforms == [Platform.TWITTER]
    assert matching[0].status == "done"


def test_backfill_skips_runs_without_world_id(tmp_path):  # review:P15-T3
    run_store = RunStore(tmp_path / "runs.json")
    world_store = WorldStore(str(tmp_path))
    run_store.create(_config(None))

    assert backfill_single_launches(run_store, world_store) == 0
    assert world_store.list_all_launches() == []


def test_create_app_backfills_existing_run_store(tmp_path):  # review:P15-T3
    store_path = tmp_path / "runs.json"
    run_store = RunStore(store_path)
    world_store = WorldStore(str(tmp_path))
    world = world_store.create_world(persistent=True, name="启动回填")
    run_id = run_store.create(_config(world.world_id, content="启动期历史内容"))
    record = run_store.get(run_id)
    assert record is not None
    record.status = "done"
    run_store.save()

    app = create_app(FakeEngine(), store_path=store_path)

    launches = app.state.world_store.list_all_launches()
    assert [launch.run_ids for launch in launches] == [[run_id]]
    assert launches[0].content == "启动期历史内容"
