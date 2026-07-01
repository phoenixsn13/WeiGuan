# 围观前端 Review Manual

日期：2026-07-01

## Review 资产

以下截图由 Playwright 访问本地 Vite 页面生成，API 与 SSE 事件使用本地 mock，避免依赖真实后端与 LLM key。

| 场景 | 截图 |
| --- | --- |
| 圈子画廊 | [assets/weiguan-gallery.png](assets/weiguan-gallery.png) |
| 发起围观 | [assets/weiguan-compose.png](assets/weiguan-compose.png) |
| 围观进行中 | [assets/weiguan-live.png](assets/weiguan-live.png) |
| 追问抽屉 | [assets/weiguan-interview.png](assets/weiguan-interview.png) |
| 结果复盘 | [assets/weiguan-retro.png](assets/weiguan-retro.png) |

## Playwright 覆盖

截图脚本覆盖了前端主链路：

- `/` 加载圈子列表，并展示受众选择与描述输入。
- `/compose` 输入内容，展示步数选项与开始按钮。
- `/run/r_demo/live` 接收 mock EventSource 的 `run_started`、`step_started`、`delta`、`run_done` 事件，渲染 Twitter 风格动态流。
- Live 页点击用户头像打开 interview drawer，提交追问并展示 mock 回答。
- `/run/r_demo/retro` 展示复盘统计，并调用 mock insights 接口展示建议。

## 验证边界

- 截图验证的是前端渲染、路由、交互层级和主要文案，不验证真实 OASIS 引擎或真实 LLM 输出。
- 真实 LLM 路径需要配置 `WEIGUAN_TEST_LLM_KEY` 后再运行标记为 `llm` 的后端测试。
- 本轮截图使用系统 Chrome 和已安装的全局 Playwright，仅访问 `http://127.0.0.1:5173` 的本地开发服务。

## 本轮命令

```bash
npm test
npm run build
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -v -m "not llm"
NODE_PATH=$(npm root -g) node /tmp/weiguan-screenshots.cjs
```
