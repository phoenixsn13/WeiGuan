# 给 codex 的后续工作提示词（P7-T11/T12：持久身份接线补齐）

> 整段发给 codex。角色不变：实现者，照规格 TDD 执行、不改设计、不改弱断言绕过。**前置：P7-T9/T10 已过审。** 后端 Task 无需 LLM key；真链路联跑如需由用户代跑。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/manual/2026-07-02-weiguan-P7-T11-persistent-identity-wiring.md` 实现 P7-T11（后端）、P7-T12（前端）。这是审核发现的**接线缺口补齐**：P7-T9/T10 正确实现了"给定持久累积世界时"的投影与绑定，但主发起流程从不创建可复用的持久身份、也不传 `world_id`，导致 `standing_timeline`/累积/"我"绑定在真实使用中是空数据。补齐=把主流程接上，不是降级。照规格、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P7-T11/T12`，打 `# review:` / `// review:` 锚点。

根因（务必修对）：
- `ComposeScreen.startRun` 从不传 `world_id`；后端 `run_bridge.py:43` `create_world(persistent=bool(config.world_id))` → 每次 run 建 ephemeral 世界 → 跨 run 不累积。
- `create_run` 只回 `{"run_id"}`，新身份 id 拿不到 → 绑不上"我"。
- "继续身份"让用户手输 person_id、且不传 world_id → 又建新世界。

要做：
- **P7-T11（后端）**：`world/models.py` 加 `IdentitySummary`；`world/store.py` 加 `list_identities()`（遍历世界，**仅 persistent=True**，fold 出 summary，按影响力降序确定性）；`api/routes.py` 加 `GET /api/identities`；`run_bridge.py` 的 `ensure_world_for_run` 改为：`poster_person_id` 或 `world_id` 任一给定即 `persistent=True`（复用/新建持久世界），仅两者皆空才 ephemeral。
- **P7-T12（前端）**：新身份流程先 `createPerson(persistent, persona, 昵称)` 拿 `{world_id, person}`→`saveCurrentIdentity`→`createRun` 带返回的 `world_id`+`poster_person_id`；继续身份用 `getIdentities()` 渲染**选择器**（删手输 textarea），选中带 `world_id`+`poster_person_id` 发 run；IdentityScreen 影响力条按序列最大值**归一化**。

铁律：前台不得出现 `agent/OASIS/仿真/工作台/trace/simulation/dashboard`（代码字段名不算）；身份/累积数据一律来自后端投影，不得前端伪造/推断补数。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`。完成标准：走一遍"新身份 run → 继续该身份 run → 打开身份主页"，`standing_timeline` 真出现 2 点且累积单调。完成交回审核者复核。卡点回规格，不要靠猜。
