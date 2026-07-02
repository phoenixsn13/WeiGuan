# 给 codex 的后续工作提示词（计划 A：真端到端手测 + 前置装配）

> 把下面「提示词」整段发给 codex。角色不变：实现者，照设计执行、不改设计、不改弱断言绕过。需要 LLM key 的步骤由用户代跑；不记录/不打印 key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/manual/2026-07-01-weiguan-plan-A-e2e-manual-test.md` 执行「围观」的真端到端手测（计划 A）。设计已定稿，照做、不改设计、不改断言绕过；每个任务一个 commit 带 `Review-Anchor:`，TDD 优先，保留既有 `# review:` 锚点、新能力打新锚点（本计划码 `PA`）。

背景：至今所有验收都在单测层，整条 UI 链路从没用真后端+真 OASIS+真 LLM 跑通过；现有 frontend-review 只是 mock 截图，不算数。我读代码已确认三个把前后端接起来的装配 blocker，先修再手测。

先做前置整改（三个任务，详见文档 §二）：
- **PA-T1**：新增 `backend/weiguan/api/main.py`，把 `create_app(RoutingEngine(make_resolver(WORKDIR, generate_custom_profile), _build_engine))` 装配成可跑的 `app`，`_build_engine` 每次用独立 run 目录（避免并发抢 run.db）。核对 `make_resolver`/`generate_custom_profile` 真实签名并对齐。走 vite 代理可不加 CORS。`# review:PA-T1`；AC1（无 LLM）：`from weiguan.api.main import app` 可导入且构造期不触真 LLM/联网。
- **PA-T2**：`frontend/vite.config.*` 加 `server.proxy["/api"] -> http://127.0.0.1:8000`；确保 `/api/runs/{id}/events` 的 SSE 逐条透传不被缓冲。`// review:PA-T2`。
- **PA-T3**：前端 BYOK 补全——`Creds` 与三处请求头补 `X-LLM-Base-Url`/`X-LLM-Reasoning-Effort`/`X-LLM-Thinking`（有值才发）；`useApiKey` localStorage 增 `wg_llm_base_url/wg_llm_model/wg_llm_reasoning/wg_llm_thinking`（仍只存本地、不落服务端）；补一个最小 BYOK 设置入口填这些值。`// review:PA-T3`；AC1（vitest，mock fetch）：creds 含 base_url 时 createRun 请求头带 `X-LLM-Base-Url`，不含时不带。

再做手测（PA-T4，详见文档 §三，需 key 的部分由用户代跑）：
- 两终端起 `uvicorn weiguan.api.main:app --port 8000` + `npm run dev`；浏览器 BYOK 填 DeepSeek（base_url `https://api.deepseek.com`、model `deepseek-v4-pro`、reasoning `high`、thinking `enabled`），小人群 + steps=6 控成本。
- 逐屏走 `/`→`/compose`→`/run/:id/live`→追问抽屉→`/run/:id/retro`，每屏截图（`e2e-gallery/compose/live/interview/retro.png`），重点验证 live 里 **seed 真有评论逐条刷出**、追问回答**接地到该 actor 真实评论**、未参与 actor 返 404/置灰。
- 产出缺陷记录表（屏/现象/期望/严重度/截图/归属），填进文档末尾"手测记录"区。手测只发现与归类，**不就地大改**；阻断项可当场小修并注明，其余按严重度另开任务。

验收命令：
```bash
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
cd frontend && npx vitest run && npx tsc -b
# 真链路手测见文档 §三，用户代跑回传截图+缺陷表
```
完成标准：PA-T1/T3 单测 + 全回归绿；vite 代理生效；五屏截图齐全、主链路真人走通、缺陷表填好带归属与严重度。做完把结果填进文档"手测记录"区，交回审核者核验。

卡点回 `docs/manual/2026-07-01-weiguan-plan-A-e2e-manual-test.md`；契约相关回 `docs/superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md`。不要靠猜。
