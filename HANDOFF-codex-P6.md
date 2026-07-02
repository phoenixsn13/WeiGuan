# 给 codex 的后续工作提示词（P6：围观世界与身份基石）

> 把下面「提示词」整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。本计划**无需 LLM key**。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-02-weiguan-P6-world-identity-foundation.md` 逐 Task 实现「围观世界与身份基石」（P6）。设计已定稿（真源 `docs/superpowers/specs/2026-07-02-weiguan-world-identity-and-wishes-design.md`），照做、不改设计、不改断言绕过。TDD 优先：每 Task 先写失败测试→确认失败→最小实现→确认通过→commit；每 commit 带 `Review-Anchor: P6-T<n>`，代码里打 `# review:P6-T<n>` 锚点，保留既有 `# review:` 锚点。

本计划把"事件溯源的世界层"接到现有单 run 引擎下，核心铁律有三条，务必守住：
1. **退化不回归**：无 `world_id` 的 run 必须与今天等价——真围观 seed 口径（`seed_interaction_count`/`seed_engaged_actor_ids`）、seed pinning、`_assert_seed_visible`、`env.close()` 既有逻辑一律不动。
2. **写路径只追加不改写**：任何 run 产出都 `EventLog.append(WorldEvent)`，绝不直接可变改 Person/Account；身份/关注/记忆/立场全部由 `Projector` 确定性折叠得到。并发多 run append 不许覆盖（T2 有专门断言）。
3. **成本中性**：`project_bounded_memory` 严格受 `person_memory_budget` 上界约束；投影全部非 LLM，复用现有 `attention_context.classify_stance`，不新造分类器、不引入联网模型。

实现顺序即 Task 顺序 T1→T8：T1 类型+persona起始盘 → T2 EventLog → T3 Projector → T4 WorldStore → T5 RunConfig扩展 → T6 Run缝（用 `weiguan/engine/fake.py::FakeEngine` 测，无 LLM）→ T7 注意力 self_memory 注入 → T8 世界/人物/帧 API。各 Task 的精确文件、类型签名（P7~P9 要消费，务必一字不差）、测试断言见计划。

验收命令：
```bash
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
```
完成标准：8 Task 全绿、退化态逐拍 snapshot 与接世界层前等价、`GET /api/runs/{id}/frames` 可用、全程无需 LLM key。做完把结果交回审核者按 Review Index 逐条核验。

卡点回计划文档；契约/边界回 spec。不要靠猜——类型签名以计划为准。
