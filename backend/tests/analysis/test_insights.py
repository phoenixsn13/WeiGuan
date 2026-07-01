from weiguan.analysis.insights import _parse_json_object


def test_parse_json_object_repairs_unescaped_inner_quotes():  # review:P5-T2
    text = (
        '{"verdict":"ok","suggestions":["补充说明缓存条件（如是否执行过 '
        '"yarn cache clean" 或首次构建），并附上数据。","录制视频"]}'
    )

    data = _parse_json_object(text)

    assert data["verdict"] == "ok"
    assert data["suggestions"][0].startswith("补充说明缓存条件")
