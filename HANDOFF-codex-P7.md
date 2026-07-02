# 给 codex 的后续工作提示词（P7：发帖人 persona 与累积）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。**前置：P6 已落地并通过审核。** 后端 Task 无需 LLM key；前端原型/实现无需 key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-02-weiguan-P7-poster-persona-accumulation.md` 逐 Task 实现「发帖人 persona 与累积」（P7）。设计真源 `docs/superpowers/specs/2026-07-02-weiguan-world-identity-and-wishes-design.md`（§5.1、§7）。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P7-T<n>`，代码打 `# review:` / `// review:` 锚点，保留既有锚点。消费 P6-T1 冻结的 `World/Person/Account/PersonView/PersonaKind/persona_starting_standing` 与 P6 的 WorldStore/API，签名一字不差。

铁律：
1. 累积/身份数据一律从 `PersonView`（P6 投影）派生，**禁止前端假数据或本地伪造 mutation**。
2. 前台心智词表：禁 `agent/OASIS/仿真/工作台/trace/simulation/dashboard`；用 `世界/人物/TA/身份/粉丝/影响力/立场`。
3. UI 三寄存器与配色遵循 spec §7.2；世界层禁用图表库默认配色，暖琥珀为身份主色。
4. **UI 工作流强制**：前端屏先做 Task 3——用 imagegen 按 spec §7.5 brief 出 desktop+mobile 原型图、写自审 md、自审合格后再用高保真 skill 实现（Task 5/6/7/8）。

顺序 T1→T8：T1 WorldStore 身份创建/列举 → T2 身份/成本预估 API → T3 原型图(发起页/历史按人/身份主页)+自审 → T4 世界层 token → T5 发起页 persona+身份+成本 → T6 历史按人 → T7 身份主页 → T8 导航升级。精确文件/签名/断言见计划。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`。完成把结果交回审核者按 Review Index 逐条核验。卡点回计划，契约回 spec，不要靠猜。
