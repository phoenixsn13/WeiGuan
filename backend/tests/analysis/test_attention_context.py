from weiguan.analysis.attention_context import (
    AttentionContextConfig,
    build_attention_context,
)


def test_attention_context_keeps_direct_recent_salient_and_bounded_comments():
    comments = [
        {
            "comment_id": idx,
            "post_id": 1,
            "user_id": idx,
            "content": "source?" if idx % 2 else f"analysis maybe {idx}",
            "created_at": idx,
            "num_likes": idx,
            "num_dislikes": 0,
        }
        for idx in range(1, 20)
    ]
    comments.append(
        {
            "comment_id": 99,
            "post_id": 1,
            "user_id": 7,
            "content": "my earlier reply should remain visible",
            "created_at": 1,
            "num_likes": 0,
            "num_dislikes": 0,
        }
    )
    posts = [
        {
            "post_id": 1,
            "user_id": 0,
            "content": "seed",
            "comments": comments,
        }
    ]

    context = build_attention_context(
        posts,
        actor_id=7,
        config=AttentionContextConfig(comment_budget=6, comment_chars=32),
    )

    assert len(context.visible_comments) <= 6
    assert context.discussion_panel["total_visible_comments"] == 20
    assert context.discussion_panel["omitted_comments"] == 14
    assert any(item["user_id"] == 7 for item in context.visible_comments)
    assert "question" in context.discussion_panel["stance_counts"]


def test_attention_context_includes_chinese_language_and_crowd_instruction():  # review:UI-P7-AC2
    context = build_attention_context(
        [{"post_id": 1, "user_id": 0, "content": "seed", "comments": []}],
        actor_id=3,
        config=AttentionContextConfig(
            audience_instruction="你属于「财经吐槽」这个圈子，整体说话风格：嘴碎、看空、爱唱反调。",
        ),
    )

    assert "财经吐槽" in context.self_memory
    assert "简体中文" in context.self_memory
    assert "有限注意力" not in context.self_memory
