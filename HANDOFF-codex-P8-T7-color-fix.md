# 给 codex 的修正提示词（P8-T7 情绪时间线配色 token 化）

> 整段发给 codex。角色不变：实现者，照修正执行、不改设计。单点修正，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。审核者在 P8-T7 二次核验发现一处配色偏离设计语言，做单点修正，不动其它逻辑。

**问题：** `frontend/src/components/SentimentTimeline.tsx` 的 `COLORS` 硬编了 Tailwind 默认亮色 `bg-emerald-500`/`bg-rose-500`/`bg-slate-300`，违反 spec §7.2「世界层/复盘台杜绝图表库默认配色」，也绕开了已有设计 token。设计系统里立场色是克制的世界层色，见 `frontend/src/design/tokens.ts::sentimentColor`（positive `#3E9B6E`、negative `#C4553B`、neutral `#8A8578`）。同批其它组件（`CascadeTree`/`InfluenceBoard`/`StanceDistribution`）都走 `bg-brand`/`border-line` token，唯此处破了连贯性。

**要求（照做）：**
1. `SentimentTimeline.tsx` 删除 `COLORS` 那个 Tailwind class 映射；发酵柱的颜色改用 `tokens.sentimentColor(...)` 返回值，走内联 `style={{ backgroundColor }}`（与幂等的世界层视觉语言一致）。`fermentation_curve` 的 `sentiment` 值域是 `"positive"|"negative"|"neutral"`，直接作为 `Sentiment` 传入 `sentimentColor`；未知值兜底用 `sentimentColor("neutral")`。
2. 不改组件的数据契约、空态、`aria-label`、布局与其余样式；只替换柱体填充色来源。
3. 全站唯一立场色真源是 `tokens.sentimentColor`，不得再引入第二套硬编颜色。若发现同族组件里还有别的 Tailwind 默认立场色残留，一并 token 化（但不扩大改动范围到非配色逻辑）。

**TDD/锚点：** 若现有 `AnalysisComponents.test.tsx` 断言的是 class 名，改为断言渲染不抛且结构在（颜色属于视觉，不必强测具体色值）；保留 `// review:P8-T7` 锚点。commit 带 `Review-Anchor: P8-T7`，message 例：`fix(retro): sentiment timeline uses world-layer stance tokens`。

**验收：** `cd frontend && npx vitest run && npx tsc -b` 全绿。完成交回审核者复核这一处。卡点回 spec §7.2 与 `tokens.ts`，不要靠猜。
