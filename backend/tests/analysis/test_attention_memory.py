from weiguan.analysis.attention_context import (
    AttentionContextConfig,
    build_attention_context,
)


def _posts():
    return [{"post_id": 1, "user_id": 0, "content": "seed", "comments": []}]


def test_attention_context_includes_self_memory_override():  # review:P6-T7-AC1
    context = build_attention_context(
        _posts(),
        actor_id=2,
        config=AttentionContextConfig(
            self_memory_override="立场:question; 近期:反复追问证据"
        ),
    )

    assert "立场:question; 近期:反复追问证据" in context.self_memory


def test_attention_context_without_override_is_unchanged():  # review:P6-T7-AC2
    base = build_attention_context(
        _posts(),
        actor_id=2,
        config=AttentionContextConfig(),
    )
    explicit_none = build_attention_context(
        _posts(),
        actor_id=2,
        config=AttentionContextConfig(self_memory_override=None),
    )

    assert explicit_none.self_memory == base.self_memory
