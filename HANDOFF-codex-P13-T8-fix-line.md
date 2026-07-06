# 给 codex 的修正提示词（P13-T8 line token 异语义合并回归）

> 整段发给 codex。角色不变：实现者，TDD、不改设计、不弱断言绕过。**背景：T8（c45a824）已合入且核心达标**——tailwind 从 tokens 取值、防漂移测试到位、中性灰 token 化都接受。本文只修 T8 引入的**一个回归**：`line` token 被异语义合并，导致全站亮壳白卡描边从浅灰突变深蓝。纯前端，vitest，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。修一个 T8 收敛引入的回归：`line` token 语义合并错误。设计真源 spec §6/§7.2。TDD；commit 带 `Review-Anchor: P13-T8`（同锚点，修正提交）。

### 回归（审核已定位）

T8 把 `tailwind.config.ts` 的 `line` 从 `#E4E8F0`（浅灰发丝边）改为 `world.line`（`#2C4A7C` 深蓝）。但这是**两个不同语义**被错误合并：

| 语义 | 用途 | 正确色 |
|---|---|---|
| **亮壳发丝边框** | `border-line` 类名，全站 **118 处**白/米底卡片描边（`border border-line bg-white`） | 浅灰 `#E4E8F0` |
| **暗世界层连接线** | `world.line`，深色世界层（`surface #0F172A` 深底）上的连接线、inline `style={{ color: world.line }}` 箭头 | 深蓝 `#2C4A7C` |

合并后全站白底卡片描边变刺眼深蓝，视觉回归。这俩不能共用一个 token。

### 修法（分离两个语义，别再二选一）

1. **tokens.ts 增亮壳边框语义**：在 `colors` 加 `hairline: "#E4E8F0"`（亮壳发丝边框，spec §6 亮壳基线色）。`world.line` 保持 `#2C4A7C` 不动（它是暗层连接线，语义正确）。
2. **tailwind.config.ts**：`line: colors.hairline`（改回浅灰），**不再指向 `world.line`**。
3. **不动**：所有 `border-line` 类名用法（118 处自动恢复浅灰）；所有 `style={{ color: world.line }}` 等暗层连接线 inline 用法（深蓝，正确）；T8 其余收敛（brand/ink/cream/accent/muted/subtle/nightScrim）全部保留。

### 顺带修一个小瑕疵（同 commit）

`tailwind.config.ts` 的 `sentiment.contestedFrom` 被设为 `world.influenceDown`（`#C4553B`），但 contested 的语义源是 `sentimentColor("contested")` 的渐变起点 `#B4552F`。改 `contestedFrom` 对齐 `#B4552F`（可在 tokens 暴露一个 `contestedFrom` 常量或直接引用），别用 influenceDown 顶替。

### 验收

```bash
cd frontend
# tailwind line 恢复浅灰、等于 tokens.hairline
rg -n "hairline|line:" src/design/tokens.ts tailwind.config.ts
npx vitest run && npx tsc -b
```
- 更新防漂移测试：断言 tailwind `line` === `tokens.colors.hairline`（`#E4E8F0`），`world.line` 仍 `#2C4A7C`。
- 断言 `border-line` 呈现为浅灰（可在 tokens 测试层 pin 值，视觉由审核者/用户抽查）。
- skins/x、单平台 Retro、LaunchRetro、MultiPlatformLive 零回归；153+ 全绿。

### 交付

回审核者：附 tokens/config diff + 防漂移测试更新 + vitest/tsc 结果。卡点回 spec §6，不要靠猜。
