# 围观文档导航

这里汇总围观项目的产品设计、实现计划、整改记录、成本分析和手工验证材料。阅读时优先从“设计真源”和“契约”开始，再看分阶段计划和人工验收记录。

## 推荐阅读顺序

1. [产品与交互设计](superpowers/specs/2026-07-01-weiguan-design.md)
2. [社交视角 UI 设计](superpowers/specs/2026-07-01-weiguan-social-pov-ui-design.md)
3. [契约与约定](superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md)
4. [成本安全设计](manual/2026-07-01-weiguan-cost-safety-design.md)
5. [种子可见与参与整改](manual/2026-07-01-weiguan-remediation-2-seed-engagement.md)
6. [成本排查记录](manual/2026-07-01-weiguan-cost-investigation-notes.md)

## 设计文档

- [围观产品设计](superpowers/specs/2026-07-01-weiguan-design.md)：产品定位、用户心智、页面与交互原则。
- [社交视角 UI 设计](superpowers/specs/2026-07-01-weiguan-social-pov-ui-design.md)：第一人称评论区、平台视角、历史回放和皮肤机制。

## 实现计划

- [计划 1：Canonical Adapter](superpowers/plans/2026-07-01-weiguan-plan-1-canonical-adapter.md)
- [计划 2：Engine 与 SSE](superpowers/plans/2026-07-01-weiguan-plan-2-engine-sse.md)
- [计划 3：发布者视角与 X 皮肤](superpowers/plans/2026-07-01-weiguan-plan-3-poster-pov-x-skin.md)
- [计划 4：Gallery、BYOK 与启动链路](superpowers/plans/2026-07-01-weiguan-plan-4-gallery-byok-launch.md)
- [计划 5：追问与复盘](superpowers/plans/2026-07-01-weiguan-plan-5-interview-retro.md)
- [前端 Shell 计划](superpowers/plans/2026-07-01-weiguan-plan-f0-frontend-shell.md)
- [契约与约定](superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md)

## 手工验证与整改

- [最新版验收手册](manual/2026-07-07-weiguan-latest-manual.md)
- [P14 完整验收手册](manual/2026-07-06-weiguan-P14-complete-manual.md)
- [P14 入口接线审计](manual/2026-07-06-weiguan-P14-wiring-audit.md)
- [计划 A 端到端手工测试](manual/2026-07-01-weiguan-plan-A-e2e-manual-test.md)
- [围观整改记录](manual/2026-07-01-weiguan-remediation.md)
- [种子可见与参与整改](manual/2026-07-01-weiguan-remediation-2-seed-engagement.md)
- [前端评审记录](manual/2026-07-01-weiguan-frontend-review.md)
- [社交视角 UI 评审](manual/2026-07-01-weiguan-social-pov-ui-review.md)
- [惰性控件整改](manual/2026-07-02-weiguan-inert-controls-remediation.md)

## 成本与上下文

- [成本排查记录](manual/2026-07-01-weiguan-cost-investigation-notes.md)
- [成本安全设计](manual/2026-07-01-weiguan-cost-safety-design.md)
- [OASIS 上下文成本估算演练](manual/assets/context-cost/context-cost-comparison.md)

## 交接文件

根目录下的 `HANDOFF-codex*.md` 是实现交接和审核材料，保留任务上下文、Review-Anchor 和执行约束。它们不是面向最终用户的说明文档，但属于项目工程记录。

## 维护约定

- 文档正文使用中文；命令、文件路径、API 字段、marker、Review-Anchor 和代码标识保持原样。
- 新增实现计划放在 `docs/superpowers/plans/`。
- 新增产品或交互设计放在 `docs/superpowers/specs/`。
- 新增手工验证、评审、成本分析、整改记录放在 `docs/manual/`。
- 涉及 LLM 成本、真实 key 或外部服务的操作必须明确标注是否需要用户执行。
