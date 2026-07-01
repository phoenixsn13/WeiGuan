import csv
import os

import pytest

from weiguan.engine.config import Audience, RunConfig
from weiguan.engine.custom_profile import generate_custom_profile
from tests.llm_config import llm_kwargs

pytestmark = pytest.mark.llm


def _cfg():
    return RunConfig(
        audience=Audience(custom="一二线城市、重性价比的年轻妈妈"),
        content="x",
        steps=6,
        **llm_kwargs(),
    )


def test_generates_valid_profile_csv(tmp_path):  # review:P4-T3-AC1
    path = generate_custom_profile(_cfg(), str(tmp_path), n=5)
    assert os.path.exists(path)
    with open(path, encoding="utf-8") as file:
        rows = list(csv.reader(file))
    assert rows[0][1:] == [
        "user_id",
        "name",
        "username",
        "following_agentid_list",
        "previous_tweets",
        "user_char",
        "description",
    ]
    assert len(rows) >= 6
