# 围观（Weiguan）— 给 codex 的一页式交接说明

**你的角色**：实现者。设计与计划已定稿，**照计划执行、不擅自改设计**。有疑问先看对应文档，仍不清再回问。

## 这是什么
在 **OASIS**（CAMEL-AI 的社交模拟器，`./oasis` 符号链接）之上做一个消费级 Web 应用「围观」：用户把内容"扔进"一个模拟人群，在**以假乱真的 X 皮肤**里第一人称看反应逐条刷出、点任意评论人**追问"为什么"**、最后**上帝视角复盘** + 1–2 条建议。后端 Python/FastAPI+SSE，前端 React+Vite+TS+Tailwind。

## 先读这两份（必读）
1. `docs/superpowers/specs/2026-07-01-weiguan-design.md` — 设计定稿（视觉语言 §6、线框 §7）。
2. `docs/superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md` — **审核锚点机制 + 冻结的 REST/SSE 契约**。任何跨层交互以此为准。

## 执行顺序（计划文档均在 `docs/superpowers/plans/`）
```
Plan 1  规范模型 + OASIS Adapter        （纯后端内核，无 LLM）
  ↓
Plan 2  引擎 + SSE + API               （含真实 LLM 打通，硬验收）
  ↓
Plan F0 前端骨架 + 产品壳 + 设计 tokens
  ↓
Plan 3 / Plan 4 / Plan 5  ← 三者只依赖已冻结契约，可并行
   3 poster POV + X 皮肤 + 流式播放
   4 圈子画廊 + 自定义受众 + BYOK + 发起
   5 追问抽屉 + 复盘上帝视角
```
每篇计划自带 Task、逐步 TDD、完整代码、AC 和末尾**审核索引表**。**按顺序逐 Task 做，先写失败测试再实现。**

## 铁律（务必遵守）
- **契约不可越界**：任一层只依赖 `weiguan.canonical` + 冻结契约，**不得直接读 OASIS 表 / 不得跨层依赖内部实现**。皮肤只消费 ViewModel，皮肤区**禁止**出现围观品牌色。
- **审核锚点**（每个 Task 都要打，供事后审计）：
  - 代码注释 `# review:P2-T3`（Py）/ `// review:P2-T3`（TS）
  - commit trailer：`Review-Anchor: P2-T3`
  - 验收测试处：`# review:P2-T3-AC1`
- **真实 LLM 必须打通**，不许拿"跳过"充数。三处 `@pytest.mark.llm`：`P2-T6`、`P4-T3`、`P5-T2`。无 key 时 skip，**有 key 时必须 PASS**。
- **频繁提交**：每个 Task 结束就按计划里的 commit 命令提交。
- 不改已定稿的签名（如 `OasisEngine` 构造、`RunConfig`、SSE 事件名）；需要扩展时用**组合**（见 Plan 4 的 `RoutingEngine`）。

## 验证命令
```bash
# 后端（不烧钱的全部逻辑）
cd backend && python -m pytest -m "not llm" -v
# 后端真实 LLM 三处对接（用真实 key）
cd backend && WEIGUAN_TEST_LLM_KEY=<你的key> python -m pytest -m llm -v
# 前端
cd frontend && npm install && npm test
```
每个 Task 内的"运行确认失败/通过"命令是权威，按它做。

## 目录
```
backend/    weiguan.{canonical,adapter,engine,api,analysis} + tests
frontend/   src/{model,pov,skins/x,api,components,shell,screens} + *.test.tsx
oasis/      OASIS 源码与数据（符号链接，只读参考；profile 数据在 oasis/data/）
docs/superpowers/{specs,plans}/   设计与计划（真源）
```

## 生产装配（做完 Plan 4/5 后）
```python
create_app(RoutingEngine(
    make_resolver(workdir, generate_custom_profile),
    lambda profile_path: OasisEngine(profile_path, per_run_dir)))
```

## 完成的定义
- `pytest -m "not llm"` 与 `npm test` 全绿；`pytest -m llm`（带 key）全绿。
- 每个 Task 的 AC 都有对应 `review:` 锚点，且与该计划审核索引表一致。
- 端到端手测：选圈子 → 写内容 → 开始围观（X 皮肤流式）→ 点头像追问 → 看结果（复盘 + 建议）。

有卡点：回到对应计划文档的该 Task；契约相关回 conventions-and-contracts.md。不要靠猜。
