from __future__ import annotations

import os

from pydantic import BaseModel

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "crowds")


class Crowd(BaseModel):
    id: str
    name: str
    emoji: str
    blurb: str
    profile_file: str


# review:P4-T1
CROWDS: list[Crowd] = [
    Crowd(
        id="tech_devs",
        name="科技程序员群",
        emoji="T",
        blurb="毒舌、较真、爱抬杠",
        profile_file="tech_devs.csv",
    ),
    Crowd(
        id="fan_circle",
        name="饭圈",
        emoji="F",
        blurb="上头、护崽、情绪足",
        profile_file="fan_circle.csv",
    ),
    Crowd(
        id="finance_snark",
        name="财经吐槽",
        emoji="$",
        blurb="嘴碎、看空、爱唱反调",
        profile_file="finance_snark.csv",
    ),
    Crowd(
        id="parenting_moms",
        name="育儿妈妈",
        emoji="P",
        blurb="细腻、共情、重细节",
        profile_file="parenting_moms.csv",
    ),
    Crowd(
        id="hardcore_gamers",
        name="硬核玩家",
        emoji="G",
        blurb="硬核、挑刺、看参数",
        profile_file="hardcore_gamers.csv",
    ),
]

_BY_ID = {crowd.id: crowd for crowd in CROWDS}


def crowd_profile_path(crowd_id: str) -> str:
    crowd = _BY_ID[crowd_id]
    return os.path.abspath(os.path.join(_DATA_DIR, crowd.profile_file))


def list_crowds() -> list[dict]:
    return [
        {"id": c.id, "name": c.name, "emoji": c.emoji, "blurb": c.blurb}
        for c in CROWDS
    ]


def crowd_instruction(crowd_id: str | None) -> str:
    if not crowd_id:
        return "你是中文社交平台上的普通用户。"
    crowd = _BY_ID.get(crowd_id)
    if crowd is None:
        return "你是中文社交平台上的普通用户。"
    return f"你属于「{crowd.name}」这个圈子，整体说话风格：{crowd.blurb}。"
