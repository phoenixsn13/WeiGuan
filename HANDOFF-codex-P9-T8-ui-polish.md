# 给 codex 的补齐提示词（P9-T8：多平台 Live 高保真补齐）

> 整段发给 codex。角色不变：实现者，照计划执行、不改设计。**欠账当场清**：把 T6 自审披露的"未达原型质感"补到位。纯前端表现层，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-02-weiguan-P9-multiplatform-orchestration.md` 末尾「附录：P9-T8」补齐多平台 Live 高保真。设计真源 spec §7.2（世界层配色/冷靛蓝）、§7.3（平台皮肤）、§7.5（多平台 Live brief）+ 原型 `frontend/prototypes/multiplatform-live.png`。**只动表现层**：不改 `PosterViewModel` 数据契约、不改 `pov/multiplatform.ts` 派生逻辑、不改后端、不改皮肤数据流。TDD，锚点 `// review:P9-T8`，commit 带 `Review-Anchor: P9-T8`，保留既有锚点。

先对照原型自审当前 `MultiPlatformLiveScreen.tsx`，把下面 5 条 delta 的现状/目标写入 `P9-selfreview.md` 追加节，再实现：

1. **冷靛蓝 token 化（同 P8-T7 教训，务必先做）**：桥接线/徽标现用原生 `indigo-200/50/400/700`，**全部换成设计 token `world.line`（`#2C4A7C`）**（经 `design/tokens.ts`）。杜绝任何图表/工具默认色——连接线冷靛蓝是 §7.2 硬约束。
2. **世界层深色外框**：多平台舞台包一层 `world.surface`（`#0F172A`）深色容器，读作"世界层"、与内部社交白卡分层；世界时钟+标题落在深色外框上。
3. **三平台同屏为桌面主布局**：`xl:grid-cols-2 2xl:grid-cols-3` → 桌面即三列同屏（`lg:grid-cols-3` 或横向滚动舞台），收紧间距、列头带平台记号，提升密度。
4. **桥接路径真连列**：现状居中悬浮横条 + 泛化"外溢"标签，与具体 from→to 列无位置关系。改为桥接可视化**锚定到具体来源/目标平台列**（列头出入向桥标记，或两列位置间连线），确定性来自 `view.bridges`；移动端收敛为桥接摘要。
5. **世界时钟**：从 `slate-100` 灰药丸提升为世界层外框上的显著时钟。

铁律：`PosterViewModel` 契约不变、三皮肤仍只换表现；**零禁用心智词**（不得引入自审已标注的"配置中心/世界地图/后端/模型"等后台词）；桥接可视化保持从 `view.bridges` 确定性派生。

验收：补断言——桥接元素不含 `indigo-` 默认类、存在世界层深色容器、桥标记引用具体 from/to 平台；`cd frontend && npx vitest run && npx tsc -b` 全绿；截图对照 `multiplatform-live.png` 自审合格。完成交回审核者核验这 5 条。卡点回计划附录，配色回 `tokens.ts`，不要靠猜。
