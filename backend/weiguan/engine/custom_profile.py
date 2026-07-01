from __future__ import annotations

import csv
import json
import os

from weiguan.engine.config import RunConfig

_HEADER = [
    "",
    "user_id",
    "name",
    "username",
    "following_agentid_list",
    "previous_tweets",
    "user_char",
    "description",
]

_PROMPT = """你在为一个社交模拟生成 {n} 个虚拟用户。受众画像：{desc}
只输出 JSON 数组，每个元素形如：
{{"name":"张三","username":"zhangsan","user_char":"性格与说话风格一句话","description":"身份背景一句话"}}
不要额外文字。"""


def _parse_json_array(text: str):
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.removeprefix("```json").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").strip()
    if cleaned.endswith("```"):
        cleaned = cleaned.removesuffix("```").strip()
    return json.loads(cleaned)


# review:P4-T3  自定义受众 -> OASIS profile（真 LLM）
def generate_custom_profile(config: RunConfig, workdir: str, n: int = 60) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=config.llm_key)
    response = client.chat.completions.create(
        model=config.llm_model,
        messages=[
            {
                "role": "user",
                "content": _PROMPT.format(n=n, desc=config.audience.custom),
            }
        ],
    )
    text = response.choices[0].message.content or "[]"
    people = _parse_json_array(text)
    os.makedirs(workdir, exist_ok=True)
    path = os.path.join(workdir, "custom_profile.csv")
    with open(path, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(_HEADER)
        for i, person in enumerate(people):
            writer.writerow(
                [
                    i,
                    10000 + i,
                    person.get("name", f"user_{i}"),
                    person.get("username", f"user{i}"),
                    "[]",
                    "[]",
                    person.get("user_char", ""),
                    person.get("description", ""),
                ]
            )
    return path
