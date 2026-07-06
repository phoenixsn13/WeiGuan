from weiguan.world.naming import resolve_world_name


def test_resolves_explicit_world_name():  # review:P14-T1
    assert (
        resolve_world_name(
            name="饭圈观察",
            latest_content=None,
            primary_identity_name=None,
            created_at="2026-07-06T12:00:00+00:00",
        )
        == "饭圈观察"
    )


def test_resolves_latest_content_prefix_when_name_missing():  # review:P14-T1
    assert (
        resolve_world_name(
            name=None,
            latest_content="某明星塌房这事你们怎么看这瓜太大了",
            primary_identity_name=None,
            created_at="2026-07-06T12:00:00+00:00",
        )
        == "某明星塌房这事你们怎么看"
    )


def test_resolves_primary_identity_when_content_missing():  # review:P14-T1
    assert (
        resolve_world_name(
            name=None,
            latest_content=None,
            primary_identity_name="估值洁癖",
            created_at="2026-07-06T12:00:00+00:00",
        )
        == "估值洁癖的世界"
    )


def test_skips_hex_name_and_uses_next_candidate():  # review:P14-T1
    assert (
        resolve_world_name(
            name="7bb2eb80803d44d44afacf6b9994d0c4e",
            latest_content="这条内容应该成为世界名",
            primary_identity_name="估值洁癖",
            created_at="2026-07-06T12:00:00+00:00",
        )
        == "这条内容应该成为世界名"
    )


def test_skips_hex_primary_identity():  # review:P14-T1
    assert (
        resolve_world_name(
            name=None,
            latest_content=None,
            primary_identity_name="a1b2c3d4e5f6a1",
            created_at="2026-07-06T12:00:00+00:00",
        )
        == "围观世界·2026-07-06"
    )


def test_resolves_date_fallback_when_all_candidates_empty():  # review:P14-T1
    assert (
        resolve_world_name(
            name="",
            latest_content="",
            primary_identity_name="",
            created_at="2026-07-06T12:00:00+00:00",
        )
        == "围观世界·2026-07-06"
    )
