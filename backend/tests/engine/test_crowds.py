import csv
import os

import pytest

from weiguan.engine.crowds import CROWDS, crowd_profile_path, list_crowds


def test_five_crowds_registered():  # review:P4-T1-AC1
    ids = {c.id for c in CROWDS}
    assert {
        "tech_devs",
        "fan_circle",
        "finance_snark",
        "parenting_moms",
        "hardcore_gamers",
    } <= ids


def test_profile_path_exists_and_has_header():  # review:P4-T1-AC2
    path = crowd_profile_path("tech_devs")
    assert os.path.exists(path)
    with open(path, encoding="utf-8") as file:
        header = file.readline()
    assert "user_id" in header and "username" in header


def test_unknown_crowd_raises():  # review:P4-T1-AC3
    with pytest.raises(KeyError):
        crowd_profile_path("nope")


def test_list_crowds_hides_profile_file():  # review:P4-T1-AC4
    item = next(c for c in list_crowds() if c["id"] == "fan_circle")
    assert set(item) == {"id", "name", "emoji", "blurb"}


def test_builtin_crowd_profiles_use_weibo_style_display_names():  # review:UI-P7-AC4
    for crowd in CROWDS:
        with open(crowd_profile_path(crowd.id), newline="", encoding="utf-8") as file:
            rows = list(csv.DictReader(file))
        assert len(rows) >= 20
        assert all(not row["name"].startswith("user_") for row in rows)
        assert all(not row["username"].startswith("user") for row in rows)
        assert all(row["user_char"].strip() for row in rows)
        assert all(row["description"].strip() for row in rows)
