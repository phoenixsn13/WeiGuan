from __future__ import annotations

import json
import re

from pydantic import BaseModel

from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


class Insights(BaseModel):
    verdict: str
    suggestions: list[str]


_PROMPT = """你在帮内容作者复盘一次"发布前模拟"。
围观圈子：{audience}
原帖：{content}
部分评论：{replies}
请只输出 JSON：{{"verdict":"一句话总体判断","suggestions":["可操作建议1","可操作建议2"]}}
所有内容必须使用简体中文。suggestions 给 1-2 条，具体、可执行。不要额外文字。"""


def _parse_json_object(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.removeprefix("```json").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").strip()
    if cleaned.endswith("```"):
        cleaned = cleaned.removesuffix("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            return json.loads(_escape_inner_string_quotes(cleaned))
        except json.JSONDecodeError:
            return _extract_insights_schema(cleaned)


def _escape_inner_string_quotes(text: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False
    length = len(text)
    for index, char in enumerate(text):
        if escaped:
            result.append(char)
            escaped = False
            continue
        if char == "\\":
            result.append(char)
            escaped = in_string
            continue
        if char == '"':
            if not in_string:
                in_string = True
                result.append(char)
                continue
            next_index = index + 1
            while next_index < length and text[next_index].isspace():
                next_index += 1
            if next_index >= length or text[next_index] in {",", "}", "]", ":"}:
                in_string = False
                result.append(char)
            else:
                result.append('\\"')
            continue
        result.append(char)
    return "".join(result)


def _extract_insights_schema(text: str) -> dict:
    verdict_match = re.search(r'"verdict"\s*:\s*"(.*?)"\s*,\s*"suggestions"', text, re.S)
    suggestions_match = re.search(r'"suggestions"\s*:\s*\[(.*)\]\s*}', text, re.S)
    if not verdict_match or not suggestions_match:
        raise json.JSONDecodeError("insights schema not found", text, 0)
    return {
        "verdict": verdict_match.group(1).strip(),
        "suggestions": _extract_string_array_items(suggestions_match.group(1)),
    }


def _extract_string_array_items(text: str) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    in_string = False
    escaped = False
    length = len(text)
    for index, char in enumerate(text):
        if not in_string:
            if char == '"':
                in_string = True
                current = []
            continue
        if escaped:
            current.append(char)
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            next_index = index + 1
            while next_index < length and text[next_index].isspace():
                next_index += 1
            if next_index >= length or text[next_index] in {",", "]"}:
                items.append("".join(current).strip())
                in_string = False
                continue
        current.append(char)
    return [item for item in items if item]


# review:P5-T2  复盘洞察（真 LLM）
def generate_insights(snapshot: RunSnapshot, config: RunConfig) -> Insights:
    from weiguan.analysis.llm_client import completion_options, make_openai_client
    from weiguan.engine.crowds import crowd_instruction

    seed = next(
        (post for post in snapshot.posts if post.post_id == snapshot.seed_post_id),
        None,
    )
    content = seed.content if seed else config.content
    replies = " / ".join(reply.content for reply in snapshot.replies[:12]) or "（暂无）"
    audience = (
        crowd_instruction(config.audience.crowd_id)
        if config.audience.crowd_id
        else f"用户自定义受众：{config.audience.custom}"
    )
    client = make_openai_client(config)
    response = client.chat.completions.create(
        **completion_options(config),
        messages=[
            {
                "role": "user",
                "content": _PROMPT.format(
                    audience=audience,
                    content=content,
                    replies=replies,
                ),
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
