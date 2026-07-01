from weiguan.analysis.insights import _parse_json_object


def test_parse_json_object_repairs_unescaped_inner_quotes():  # review:P5-T2
    text = (
        '{"verdict":"ok","suggestions":["补充说明缓存条件（如是否执行过 '
        '"yarn cache clean" 或首次构建），并附上数据。","录制视频"]}'
    )

    data = _parse_json_object(text)

    assert data["verdict"] == "ok"
    assert data["suggestions"][0].startswith("补充说明缓存条件")


def test_parse_json_object_falls_back_to_schema_extraction():  # review:P5-T2
    text = (
        '{"verdict":"成果容易被质疑环境差异，需补上可复现的对比基准。",'
        '"suggestions":["在帖中补充“清缓存后首次构建”与“无缓存增量构建”的耗时对比截图，'
        '并说明测试环境（硬件、OS、包管理器版本）。",'
        '"提供一键复现脚本（如 "rm -rf cache && time build"），让读者自行验证。"]}'
    )

    data = _parse_json_object(text)

    assert data["verdict"].startswith("成果容易")
    assert len(data["suggestions"]) == 2
    assert "rm -rf cache" in data["suggestions"][1]
