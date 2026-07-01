from __future__ import annotations

import json

from pydantic import BaseModel

from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


class Insights(BaseModel):
    verdict: str
    suggestions: list[str]


_PROMPT = """你在帮内容作者复盘一次"发布前模拟"。
原帖：{content}
部分评论：{replies}
请只输出 JSON：{{"verdict":"一句话总体判断","suggestions":["可操作建议1","可操作建议2"]}}
suggestions 给 1-2 条，具体、可执行。不要额外文字。"""


def _parse_json_object(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.removeprefix("```json").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").strip()
    if cleaned.endswith("```"):
        cleaned = cleaned.removesuffix("```").strip()
    return json.loads(cleaned)


# review:P5-T2  复盘洞察（真 LLM）
def generate_insights(snapshot: RunSnapshot, config: RunConfig) -> Insights:
    from weiguan.analysis.llm_client import completion_options, make_openai_client

    seed = next(
        (post for post in snapshot.posts if post.post_id == snapshot.seed_post_id),
        None,
    )
    content = seed.content if seed else config.content
    replies = " / ".join(reply.content for reply in snapshot.replies[:12]) or "（暂无）"
    client = make_openai_client(config)
    response = client.chat.completions.create(
        **completion_options(config),
        messages=[
            {
                "role": "user",
                "content": _PROMPT.format(content=content, replies=replies),
            }
        ],
    )
    data = _parse_json_object(response.choices[0].message.content or "{}")
    suggestions = [
        suggestion
        for suggestion in data.get("suggestions", [])
        if isinstance(suggestion, str) and suggestion.strip()
    ][:2] or ["（无）"]
    return Insights(
        verdict=data.get("verdict", "").strip() or "（无明显结论）",
        suggestions=suggestions,
    )
