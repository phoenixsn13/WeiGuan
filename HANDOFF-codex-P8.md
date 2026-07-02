# 给 codex 的后续工作提示词（P8：专业社媒分析）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。**前置：P6 已落地。** 全程无需 LLM key（现有 LLM insights 保留不动）。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-02-weiguan-P8-professional-social-analysis.md` 逐 Task 实现「专业社媒分析」（P8）。设计真源 spec `2026-07-02-weiguan-world-identity-and-wishes-design.md`（§5.2 五方法族、§7.4/7.5 Retro）。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P8-T<n>`，代码打锚点，保留既有锚点。

铁律：
1. 五方法族（传播/级联、意见动力学、极化/回音室、影响力中心性、情绪/时间动力学）全部**确定性、非 LLM、可测**；复用现有 `analysis/attention_context.classify_stance` 做 stance/情绪，不新造。
2. **不新增第三方依赖**；PageRank/特征向量中心性用手写幂迭代（固定迭代上界 ≤50）。
3. 洞察是"人话"不是公式；现有 LLM 型 `insights` 保留不动，本层只为其提供更好输入。
4. 前台心智词表约束；Retro 是"复盘台"非"仪表盘"，世界层配色、**杜绝图表库默认配色**；情绪筛选口径=阶段主导情绪、空态诚实。
5. **UI 工作流强制**：Task 6 先 imagegen 出 Retro 原型图+自审，合格后再实现 Task 7。

顺序 T1→T7：T1 级联 → T2 意见/极化 → T3 影响力中心性 → T4 时间动力学 → T5 聚合`analyze`+`GET /runs/{id}/analysis` → T6 Retro 原型图+自审 → T7 Retro 重构消费 analysis。精确文件/签名/断言见计划。

**务必先读计划末尾「附录：P7 修正带来的必要调整」**：T2 的立场极性必须复用 P7 `projector._stance_score` 的同一映射（抽成共享 `analysis/stance.py::stance_polarity`，projector 与 P8 同引，改 projector 保持 P7 测试绿）；T3 的结构影响力用 `structural_influence`/`centrality` 命名，与身份页跨 run `influence` 区分；跨 run"影响力/立场随时间"直接复用 `PersonView.standing_timeline`。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`（无新依赖）；`cd frontend && npx vitest run && npx tsc -b`。完成交回审核者按 Review Index 核验。卡点回计划，契约回 spec，不要靠猜。
