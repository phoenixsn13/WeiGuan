# 围观 Social POV UI Review

## 设计资产

`imagegen` 概念图：

- [第一人称 Live](assets/weiguan-ui-ux/live-first-person-concept.png)
- [切换到某人视角](assets/weiguan-ui-ux/actor-perspective-concept.png)
- [围观回放时间线](assets/weiguan-ui-ux/global-timeline-concept.png)

实现截图：

- [历史记录桌面](assets/weiguan-ui-ux/review/history-desktop.png)
- [Live 桌面](assets/weiguan-ui-ux/review/live-desktop.png)
- [Live 移动](assets/weiguan-ui-ux/review/live-mobile.png)
- [Retro 桌面](assets/weiguan-ui-ux/review/retro-desktop.png)
- [Retro 移动](assets/weiguan-ui-ux/review/retro-mobile.png)

## 截图方式

前端本地服务：

```bash
cd frontend
npx vite --host 127.0.0.1
```

后端使用 `FakeEngine`，不调用 LLM：

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -c "import uvicorn; from weiguan.api.app import create_app; from weiguan.engine.fake import FakeEngine; uvicorn.run(create_app(FakeEngine()), host='127.0.0.1', port=8000, log_level='warning')"
```

截图工具：本机未安装 `playwright` npm 包，且本轮不自行安装依赖；使用系统 `google-chrome --headless=new` 截图作为浏览器渲染证据。

## 自审结论

### Live

- 通过：seed 帖固定在社交内容页上方，评论在内部滚动窗口内，不再把整页无限撑长。
- 通过：顶部是 `我看到的` / `正在从 @handle 的视角看`，没有出现 `agent`、`OASIS`、`仿真`、`工作台`。
- 通过：桌面右侧是通知摘要，移动端自动收窄为单列。
- 通过：底部控制条在社交皮肤外，像播放/回放控制，不像后台操作台。
- 待后续：当前第一批只做了“点击评论者进入 TA 视角”的状态与高亮，尚未做真正的 `actorView(snapshot, actorId)` 可见内容裁剪。

### 历史记录

- 通过：新增历史记录入口，可从历史进入 `看评论区` 或 `看回放`。
- 通过：后端 `GET /api/runs` 返回当前服务生命周期内的 run summaries。
- 待后续：历史记录尚未跨服务重启持久化；需要第二批设计 `RunStore` 持久层或从保存的 `run.db`/snapshot 重建历史。

### Retro

- 通过：复盘从简单指标条改为 `围观回放 / 发酵时间线`，表达为社交内容发酵，而不是仿真日志。
- 通过：右侧是创作者流量洞察、风险提醒、建议入口，靠近社交平台内容复盘。
- 待后续：时间线阶段目前用现有 metrics 和固定文案生成；后续应从真实 snapshot 中抽取代表评论、关键争议词和阶段摘要。

## 验证命令

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
```

```bash
cd frontend
npm test
npx tsc -b
```

## 本轮不触发 LLM

本轮 UI/UX 整改、截图和测试均使用 FakeEngine 或前端 mock，不调用 DeepSeek/OpenAI 兼容 API。
