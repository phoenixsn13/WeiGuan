# 给 codex 的后续工作提示词（P9：多平台编排与皮肤）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。**前置：P6、P7 已落地。** 编排测试用 FakeEngine，无需 LLM key；真多平台 LLM 联跑由用户代跑。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-02-weiguan-P9-multiplatform-orchestration.md` 逐 Task 实现「多平台编排与皮肤」（P9）。设计真源 spec `2026-07-02-weiguan-world-identity-and-wishes-design.md`（§5.3、§4.4、§7.3、§7.5）。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P9-T<n>`，代码打锚点，保留既有锚点。消费 P6 的 `WorldStore/WorldEvent/EventLog`/世界时钟与 P7 身份模型。

铁律：
1. 每平台仍是各自独立 OASIS 仿真（各自 recsys/模型：TWITTER-型 与 REDDIT-型）——**绝不把多平台塞进单一模型**，否则丢失"不同平台不同发酵"。
2. 并发写只走 `EventLog.append`，不改可变账本（复用 P6-T2 保证）；跨平台桥每拍把可外溢事件注入他平台下一拍（消息互窜）。
3. 前端平台皮肤共享同一 `PosterView`/Feed 数据契约，**只换表现不换数据**；世界层连接线走冷靛蓝，杜绝默认图表配色；前台心智词表约束、皮肤切换不改变它。
4. **UI 工作流强制**：Task 4 先 imagegen 出多平台并列 Live + 三皮肤对比原型图+自审，合格后再实现 Task 5/6。
5. 编排测试全部用 `weiguan/engine/fake.py::FakeEngine` 多实例，无需 LLM key。

**先读计划末尾「附录：新增 P9-T7（起手，先于 T1）」**：P7 投影是单账户实现，P9 一人多平台账户必须先做 T7——投影多账户泛化（立场/记忆/`standing_timeline` 跨 person 全部账户聚合）+ 发帖人按平台建号（替换硬编 `account_of[1]`），且单账户退化与 P7 逐字一致（防回归）。**T7 精确做法**：`_stance_score` 签名 `account_id: str`→`account_ids: list[str]`、过滤改 `in account_ids`（它返回 `(dominant, score)`，不存在 stance_counts，别造 merge 路径）；**保留 P8 落的 `stance_polarity(...)` 调用不回退**（极性单一真源恒为 `analysis/stance.py::stance_polarity`）。

顺序 **T7（起手）→** T1 跨平台桥(纯函数) → T2 WorldOrchestrator(共享时钟+每拍调桥) → T3 编排 API → T4 原型图+自审 → T5 平台皮肤抽象+Reddit/微博 → T6 多平台并列 Live。精确文件/签名/断言见计划。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`。完成交回审核者按 Review Index 核验。卡点回计划，契约回 spec，不要靠猜。
