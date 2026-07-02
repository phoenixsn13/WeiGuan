# 给 codex 的后续工作提示词（P7-T9/T10：审核补齐，不降级）

> 整段发给 codex。角色不变：实现者，照规格 TDD 执行、不改设计、不改弱断言绕过。**前置：P7 已落地并通过二次审核，本轮是审核补齐。** 全程无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/manual/2026-07-02-weiguan-P7-review-findings.md` 实现 P7 审核补齐（P7-T9 后端、P7-T10 前端）。这是审核发现的补齐、**不是降级**：判据是"真数据已在事件日志（事件溯源），缺口只是薄投影/展示面，所以补齐不妥协"。照规格、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P7-T9/T10`，代码打 `# review:` / `// review:` 锚点。

背景：审核发现 IdentityScreen 的"立场时间线/影响力曲线"是**伪造形状**——`pov/identity.ts` 用 `total_influence*(index+1)/N` 造线性阶梯、每个立场点给同一 score。根因是 `PersonView` 只有 `total_influence` 标量、无按 run 的历史 standing。真数据本就在事件日志（每 `WorldEvent` 带 `tick`+`run_id`），补齐一个前缀折叠投影即可。

- **P7-T9（后端）**：`world/models.py` 加 `StandingPoint` 与 `PersonView.standing_timeline`（保持既有字段不变）；`world/projector.py` 加 `project_standing_timeline(person, events, run_order)`——对 `run_order` 逐次**前缀累积折叠**（第 i 点=仅 `run_order[:i+1]` 事件折叠后的该 person 账户 standing），并在 `fold_world` 填充。确定性、非 LLM。断言见规格：同序对应、影响力/粉丝**真实单调**、stance 只看前缀、确定性。
- **P7-T10（前端）**：`stanceDriftSeries/influenceSeries` **改吃 `person.standing_timeline`**、**删掉插值与常数 score 的伪造逻辑**；`standing_timeline` 不足时返回空、IdentityScreen 显诚实空态（不画假图）。`/identity/me` 死胡同修复：localStorage 存 `wg_current_person_id`+`wg_current_world_id`（发起 run/建身份后写），AppShell "我" 指向绑定身份、无绑定时回退到 `/history`（不落"缺少世界信息"）。ComposeScreen 成本条补一行"自有算力不额外计费；付费 API 按 token 估算约 ¥X"。

铁律：前台不得出现 `agent/OASIS/仿真/工作台/trace/simulation/dashboard`（代码字段名如 `llm_max_agents` 不算）；身份/累积数据一律来自 `PersonView`（现含真 `standing_timeline`），不得再有前端伪造。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`。完成把结果交回审核者按 Review Index 复核。卡点回规格，不要靠猜。
