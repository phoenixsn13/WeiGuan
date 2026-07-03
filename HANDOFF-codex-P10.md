# 给 codex 的后续工作提示词（P10：效果评估与可扩展性收尾）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。**前置：P6–P9 全部落地后启动**（不要与 P9 在途工作并行；P10 在 P9 收口后开始）。全程无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-03-weiguan-P10-evaluation-and-extensibility.md` 逐 Task 实现「效果评估与可扩展性收尾」（P10）。设计真源 spec `2026-07-02-weiguan-world-identity-and-wishes-design.md`（§4/§5.2/§5.3）与接口范式先例 `weiguan/engine/base.py::Engine`。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P10-T<n>`，代码打锚点，保留既有锚点。

铁律：
1. 评估数据一律是**事件日志/快照的确定性投影**（延续 C+），**绝不改推演流**；复用 `analysis/stance.py::stance_polarity`、`attention_context.classify_stance`、P8 `AnalysisProjection`、P7 `standing_timeline`，不另立并行口径。
2. **不新增第三方依赖**；`AnalysisProvider` 只画接口 + embedded 实现，第三方（networkx）/远程（http/grpc/mq）仅在 docstring 记明扩展点，**不实现**。
3. perf 观测是**旁路发射**：sink 默认 `NullSink`，不注入时推演行为与输出**逐字不变**（退化不回归，必须有断言）；emit 不得抛错打断推演。
4. 风味摘要是**给 LLM 读的确定性叙事原料、非 LLM 产物**；代表原话确定性选取（固定排序+限量）。perf 埋点不直喂 LLM，先聚合成人可读 `PerfDigest`。二者正交。
5. 本计划**无前端新屏**；风味/perf 经 API/文件产出，供 dev 评估。

顺序 T1 分析接口化（Provider Protocol，路由改走 provider，P8 逐字等价保绿）→ T2 FlavorDigest 投影 → T3 flavor API + 评估 rubric 文档 → T4 perf 旁路 emit 缝（orchestrator+引擎主循环，NullSink 默认零开销退化）→ T5 PerfDigest 聚合 + dev 路由。精确文件/签名/断言见计划。**非目标见计划末尾：不预优化 O(n²) 热点、不实现第三方/远程 provider、不建看板。**

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`（无新依赖）；前端无改动，`tsc -b`/`vitest` 保持既有绿。完成交回审核者按 Review Index 核验。卡点回计划，契约回 spec，不要靠猜。
