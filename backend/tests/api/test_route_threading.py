import inspect

import weiguan.api.routes as routes


def test_file_read_routes_are_sync_functions_for_threadpool_dispatch():  # review:P12-T3-AC1
    sync_route_names = [
        "crowds",
        "get_world",
        "world_events",
        "list_world_persons",
        "list_identities",
        "create_person",
        "get_person",
        "preview_cost",
        "run_frames",
        "list_runs",
        "get_run",
        "snapshot",
        "retro",
        "analysis",
        "flavor",
        "perf",
        "saved_insights",
        "insights",
    ]

    assert {
        name
        for name in sync_route_names
        if inspect.iscoroutinefunction(getattr(routes, name))
    } == set()


def test_event_loop_routes_remain_async_functions():  # review:P12-T3-AC2
    async_route_names = [
        "create_run",
        "create_multi_run",
        "orchestrate_world",
        "stream_events",
        "interview",
    ]

    assert {
        name
        for name in async_route_names
        if not inspect.iscoroutinefunction(getattr(routes, name))
    } == set()
