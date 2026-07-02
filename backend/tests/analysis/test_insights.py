from weiguan.analysis.insights import _PROMPT, _parse_json_object


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


def test_insights_prompt_includes_audience_and_chinese_requirement():  # review:UI-P7-AC3
    prompt = _PROMPT.format(
        audience="你属于「科技程序员群」这个圈子，整体说话风格：毒舌、较真、爱抬杠。",
        content="大模型股买稀宇还是智谱",
        replies="我更看技术壁垒",
    )

    assert "科技程序员群" in prompt
    assert "所有内容必须使用简体中文" in prompt
