from __future__ import annotations

from pathlib import Path


def test_p14_wiring_audit_covers_entry_matrix():  # review:P14-T7
    root = Path(__file__).resolve().parents[3]
    audit = root / "docs/manual/2026-07-06-weiguan-P14-wiring-audit.md"

    text = audit.read_text(encoding="utf-8")

    for label in ["发起页", "世界总览", "历史记录", "评论区", "多平台现场", "身份页"]:
        assert label in text
    assert "/identity/{person_id}?world_id={world_id}" in text
    assert "无人物归属不强造入口" in text
