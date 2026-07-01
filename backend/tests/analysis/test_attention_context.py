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
