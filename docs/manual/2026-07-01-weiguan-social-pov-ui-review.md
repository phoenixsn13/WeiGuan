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

高保真整改后截图：

- [Live 桌面高保真](assets/weiguan-ui-ux/review/live-desktop-hifi.png)
- [Live 移动高保真](assets/weiguan-ui-ux/review/live-mobile-hifi.png)
- [Retro 桌面高保真](assets/weiguan-ui-ux/review/retro-desktop-hifi.png)
- [Retro 移动高保真](assets/weiguan-ui-ux/review/retro-mobile-hifi.png)

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

## 高保真整改回填

日期：2026-07-02

使用 `frontend-app-builder` 高保真流程复核现有三张概念图，并把它们作为生产规格：

- `live-first-person-concept.png`：深色顶栏、左侧视角栏、中间微博正文、右侧通知、底部控制条。
- `actor-perspective-concept.png`：点击评论者后显示 `正在从 @handle 的视角看`，并高亮该评论者内容。
- `global-timeline-concept.png`：深色事件侧栏、发酵时间线、右侧创作者流量洞察。

本轮改动：

- 全局壳改为深色顶栏、浅灰应用背景、居中产品导航和右侧身份状态。
- Live 页改为三栏社交内容结构：左侧视角栏、中心微博正文、右侧通知；评论仍在内部滚动窗口，不撑高页面。
- 评论、头像、通知、主帖操作区重做为更接近微博/X 详情页的视觉密度。
- Retro 页改为概念图式三栏：左侧发布内容与回放信息，中间四阶段发酵时间线，右侧流量洞察与情绪条。
- 历史、发起页接入同一套视觉系统，避免从高保真页面跳回调试页质感。

Fidelity ledger：

- 布局：Live 从单一内容卡提升为左侧视角栏 + 微博正文 + 通知栏；Retro 从两栏指标页提升为深色侧栏 + 时间线 + 洞察栏。
- 密度：Live 评论区、通知栏、Retro 波次卡增加真实数据行和操作/指标区，首屏不再显得空。
- 文案：用户可见层仍避免 `agent`、`OASIS`、`仿真`、`工作台`；保留“围观”“评论区”“回放”等社交表达。
- 数据：Retro 代表评论、发言者、讨论标签仍从保存的 snapshot 派生；未改回 mock 固定评论。
- 交互：历史进入 Live 使用 `?replay=1`，只读 snapshot；点击评论者仍切换视角并可回到“我看到的”。
- 响应式：移动端保持单列社交内容，底部控制条固定；Retro 移动端隐藏深色侧栏和右侧洞察，保留主时间线。

剩余有意偏差：

- 概念图中的真人/插画头像未引入独立位图资产；实现使用基于用户的渐变头像，避免新增外部资产依赖。
- 概念图中的迷你趋势线使用 CSS 柱状图近似；当前没有真实逐分钟热度数据。
- Actor 视角仍是 UI 状态和高亮，尚未实现真正的可见内容裁剪算法。

验证命令：

```bash
cd frontend
npm test
npx tsc -b
```

截图方式：

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -c "import uvicorn; from weiguan.api.app import create_app; from weiguan.engine.fake import FakeEngine; uvicorn.run(create_app(FakeEngine()), host='127.0.0.1', port=8000, log_level='warning')"
```

```bash
cd frontend
npx vite --host 127.0.0.1
```

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=1600,1000 --screenshot=docs/manual/assets/weiguan-ui-ux/review/live-desktop-hifi.png 'http://127.0.0.1:5173/run/r_58974970/live?replay=1'
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=1600,1000 --screenshot=docs/manual/assets/weiguan-ui-ux/review/retro-desktop-hifi.png 'http://127.0.0.1:5173/run/r_58974970/retro'
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=390,844 --screenshot=docs/manual/assets/weiguan-ui-ux/review/live-mobile-hifi.png 'http://127.0.0.1:5173/run/r_58974970/live?replay=1'
google-chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 --window-size=390,844 --screenshot=docs/manual/assets/weiguan-ui-ux/review/retro-mobile-hifi.png 'http://127.0.0.1:5173/run/r_58974970/retro'
```
