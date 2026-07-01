# 围观 — Plan A：真·端到端手测（含前置装配整改）

> 日期：2026-07-01　设计/审核者出，codex 执行。
> **目的**：到目前所有验收都在单测层。整条 UI 链路（选圈子→写内容→X 皮肤流式→点头像追问→复盘）**从未用真后端+真 OASIS+真 LLM 跑通过一次**。现有 `weiguan-frontend-review.md` 只是 **mock API/SSE 的截图**，不算数。本计划先补齐三个把前后端接起来的装配缺口，再真人走一遍并留证据。
>
> **锚点**：新计划码 `PA`。每个 Task 打 `# review:PA-T<n>`、commit trailer `Review-Anchor: PA-T<n>`、可测的验收打 `# review:PA-T<n>-AC<k>`。规则同前：TDD、不改设计、不改弱断言绕过、频繁提交。
> **LLM key**：由用户提供并代跑需要 key 的步骤；codex/审核者都**不记录、不打印 key**。

---

## 一、审核已发现的三个前置装配缺口（E2E 的 blocker，必须先修）

我读代码时已确认，这三处不修则浏览器流程根本连不通真后端：

| # | 缺口 | 证据 | 后果 |
|---|------|------|------|
| B1 | **没有可运行的后端入口**：`create_app(engine)` 需要传引擎，但仓库里没有任何模块把 `RoutingEngine(make_resolver(...), lambda p: OasisEngine(p, ...))` 装配成 `app`。 | `backend/weiguan/api/app.py:11` 只有工厂；`grep RoutingEngine` 仅在 `engine/routing.py`。 | `uvicorn` 起不来，前端 `/api/*` 全 404。 |
| B2 | **前端 dev 无 `/api` 代理**：client 全用相对路径 `/api/...`，vite 无 `server.proxy`。 | `frontend/src/api/client.ts:22/33/67/83/91` 相对路径；`vite.config` 无 proxy。 | dev 下 `:5173` 调 `/api` 打到自己，404/连不上后端。 |
| B3 | **前端 BYOK 不完整**：后端 `create_run` 接受 `X-LLM-Base-Url / X-LLM-Reasoning-Effort / X-LLM-Thinking`，但前端只发 `X-LLM-Key / X-LLM-Model`，`useApiKey` 只存 `wg_llm_key/wg_llm_model`。 | `routes.py:64-68` vs `client.ts:37-38`；`useApiKey.ts:5-18`。 | 用户的 DeepSeek key **传不进 base_url**，真跑只能打 OpenAI 默认，失败。 |

---

## 二、前置整改（先做，三个 Task）

### PA-T1　后端可运行入口（生产装配）
**新增** `backend/weiguan/api/main.py`：把 §HANDOFF 的生产装配落地，导出 `app`。
```python
# review:PA-T1
import os, tempfile, uuid
from weiguan.api.app import create_app
from weiguan.engine.routing import RoutingEngine, make_resolver
from weiguan.engine.oasis_engine import OasisEngine
from weiguan.engine.custom_profile import generate_custom_profile

WORKDIR = os.environ.get("WEIGUAN_WORKDIR", tempfile.mkdtemp(prefix="weiguan-"))

def _build_engine(profile_path: str) -> OasisEngine:
    # 每次 build 用独立 run 目录，避免并发 run 抢同一个 run.db
    per_run_dir = os.path.join(WORKDIR, "runs", uuid.uuid4().hex)
    os.makedirs(per_run_dir, exist_ok=True)
    return OasisEngine(profile_path, per_run_dir)

app = create_app(RoutingEngine(make_resolver(WORKDIR, generate_custom_profile), _build_engine))
```
- 确认 `make_resolver` / `generate_custom_profile` 的真实签名（`routing.py:37`、`custom_profile.py`）与上面一致，不一致就对齐**实现**。
- 加 CORS（若走 vite 代理可不加；直连 `:5173→:8000` 跨域则加 `CORSMiddleware` 允许本地源）。
- **AC `PA-T1-AC1`（无 LLM）**：`from weiguan.api.main import app; assert app.routes` 能导入且不触发真 LLM/联网（构造期不该建引擎）。

### PA-T2　前端 dev 代理
在 `frontend/vite.config.*` 加：
```ts
server: { proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } } }
```
- **SSE 注意**：`/api/runs/{id}/events` 是 EventSource 长连接，代理需**不缓冲**（vite 默认基于 http-proxy，一般透传 chunk；若发现事件被攒住不逐条到，禁用压缩/缓冲或直接让后端设 `X-Accel-Buffering: no`、`Cache-Control: no-cache`）。打 `// review:PA-T2`。

### PA-T3　前端 BYOK 补全（key + model + base_url + reasoning + thinking）
- 扩 `Creds`（`client.ts`）与三个请求的 headers：补 `X-LLM-Base-Url`、`X-LLM-Reasoning-Effort`、`X-LLM-Thinking`（有值才发）。
- 扩 `useApiKey`：localStorage 增 `wg_llm_base_url` / `wg_llm_model` / `wg_llm_reasoning` / `wg_llm_thinking`；**仍只存浏览器本地、不落服务端**（保持 BYOK）。
- 补一个**最小 BYOK 设置入口**（可在画廊/发布页放一个"设置"折叠区或抽屉）：填 key / base_url / model / reasoning / thinking，保存进 localStorage。打 `// review:PA-T3`。
- **AC `PA-T3-AC1`（无 LLM，vitest）**：mock fetch，断言 createRun 在 creds 含 base_url 时请求头带 `X-LLM-Base-Url`；不含时不带该头。

---

## 三、真·端到端手测脚本（PA-T4，用户提供 key 代跑）

> 这一段是**探索性手测 + 截图 + 缺陷记录**，不是自动化断言。目标：暴露契约/时序/皮肤在真链路下的真实问题。

### 启动（两个终端）
```bash
# 终端1 后端（真引擎）
cd backend
WEIGUAN_WORKDIR=/tmp/weiguan-e2e \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m uvicorn weiguan.api.main:app --port 8000
# 终端2 前端
cd frontend && npm run dev    # http://127.0.0.1:5173
```
浏览器开 `:5173`，在 BYOK 设置里填：key=<DeepSeek key>、base_url=`https://api.deepseek.com`、model=`deepseek-v4-pro`、reasoning=`high`、thinking=`enabled`。用**小人群 + steps=6** 控成本。

### 逐屏核对点（每屏截图，记录实际值/异常）
1. **`/` 圈子画廊**：卡牌加载（真 `/api/crowds`）；自定义受众输入可用；选中态清晰；无控制台报错。截图 `e2e-gallery.png`。
2. **`/compose` 写内容 + 选轮次**：X 风发布框；轮次 6/10/15 可选；"开始"触发 `POST /api/runs` 返回 `run_id`（Network 里确认请求头带 `X-LLM-Base-Url`）。截图 `e2e-compose.png`。
3. **`/run/:id/live` 进行时**：EventSource 连上，`run_started→delta→run_done` **逐条**到（不是一次性灌）；评论真的围绕你的内容；点赞/转发数跳动；**seed 有真实评论刷出**（这是核心体验，重点看）。记录：首条 delta 到达耗时、总耗时、评论条数。截图 `e2e-live.png`。
4. **追问抽屉**：点一个**评论过 seed** 的头像 → 抽屉滑入 → 提交问题 → 拿到**贴合该人设、针对其真实评论**的回答（`POST …/interview`）。再点一个**没参与**的（若 UI 允许）→ 应拿到 404 的友好提示或入口本就置灰。截图 `e2e-interview.png`。
5. **`/run/:id/retro` 复盘**：情绪分布/传播曲线/totals 与 live 观察一致；`/insights` 返回 verdict + 1-2 条建议。截图 `e2e-retro.png`。

### 产出：缺陷记录表（PA-T4 交付物）
在本文件末尾"手测记录"区，用表格记录每个问题：`屏/步骤 | 现象 | 期望 | 严重度(阻断/一般/观感) | 截图 | 建议归属(前端/后端/契约/引擎)`。**不在本轮就地大改**——手测只负责发现与归类；修复按严重度另开 Task（阻断项可当场小修并注明）。

**PA-T4 完成标准**：五屏截图齐全；主链路能真人走通（选圈子→写→流式看到 seed 真评论→追问拿到接地回答→复盘出建议）；缺陷表填好并给出归属与严重度。

---

## 四、验收命令
```bash
# 无 LLM（PA-T1/T3 的单测 + 回归）
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
cd frontend && npx vitest run && npx tsc -b
# 真链路手测：见 §三，用户代跑并回传截图 + 缺陷表
```

## 五、Review Index
| 锚点 | 交付 | 验收 |
|------|------|------|
| PA-T1 | `api/main.py` 生产装配入口 | PA-T1-AC1 可导入不触真 LLM |
| PA-T2 | vite `/api` 代理（含 SSE 透传） | 手测 §三·3 事件逐条到 |
| PA-T3 | 前端 BYOK 补全 base_url/reasoning/thinking + 设置入口 | PA-T3-AC1 header 断言 |
| PA-T4 | 端到端手测五屏截图 + 缺陷表 | §三完成标准 |

---

## 手测记录（PA-T4，codex/用户填写）

### 前置整改状态

PA-T1/PA-T2/PA-T3 已完成，等待用户代跑 PA-T4 真链路手测。LLM key 不写入文档；需要 key 的命令由用户本机执行。

已完成提交：

| Task | Commit | 说明 |
|------|--------|------|
| PA-T1 | `a55d28b` | 后端 `weiguan.api.main:app` 可导入，按 run 隔离工作目录 |
| PA-T2 | `73b0e72` | Vite dev `/api` 代理到 `127.0.0.1:8000` |
| PA-T3 | `df1d916` | 前端 BYOK 补齐 base_url/model/reasoning/thinking，本地保存并随三处 LLM 请求发送 |

### 用户代跑命令

终端 1：

```bash
cd backend
WEIGUAN_WORKDIR=/tmp/weiguan-e2e \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m uvicorn weiguan.api.main:app --port 8000
```

终端 2：

```bash
cd frontend
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`，在发布页 `BYOK 设置` 中填写：

| 字段 | 值 |
|------|----|
| API Key | 用户本地填写，不回填文档 |
| Base URL | `https://api.deepseek.com` |
| Model | `deepseek-v4-pro` |
| Reasoning | `high` |
| Thinking | `enabled` |

### 截图回填

| 屏幕 | 截图路径 | 关键观察 |
|------|----------|----------|
| 圈子画廊 | 待回填：`e2e-gallery.png` | 待回填 |
| 发布页 | 待回填：`e2e-compose.png` | Network 确认 `X-LLM-Base-Url` 已发送 |
| Live | 待回填：`e2e-live.png` | 待回填首条 delta 耗时、总耗时、seed 评论条数 |
| 追问 | 待回填：`e2e-interview.png` | 待回填接地情况；未参与 actor 的 404/置灰表现 |
| 复盘 | 待回填：`e2e-retro.png` | 待回填 totals/insights 与 live 是否一致 |

### 缺陷表

| 屏/步骤 | 现象 | 期望 | 严重度 | 截图 | 建议归属 |
|---------|------|------|--------|------|----------|
| 待回填 | 待回填 | 待回填 | 待回填 | 待回填 | 待回填 |

### 主链路结论

待用户代跑后回填：是否完成 `选圈子 -> 写内容 -> Live 流式看到 seed 真评论 -> 追问拿到接地回答 -> 复盘出建议`。
