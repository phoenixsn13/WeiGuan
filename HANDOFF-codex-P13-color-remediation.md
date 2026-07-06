# 给 codex 的收敛提示词（P13-T8 双色源真源收敛·可选非阻塞）

> 整段发给 codex。角色不变：实现者，TDD、不改设计、不弱断言绕过。**定性说明：这不是硬规则一违规整改**——P13 审核初判的"slate 硬编回归"经复核 spec §7.2 **不成立**（`text-slate-500` 等中性排版灰是 spec 明文豁免项）。本片只收敛一个与硬规则一无关的**真源一致性 bug**：`tailwind.config.ts` 与 `tokens.ts` 色值漂移。非阻塞，可与后续片打包。纯前端，vitest，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。做一件事：收敛**双色源漂移**，让 `src/design/tokens.ts` 成为前端语义色的**实际**唯一真源。设计真源 spec §6/§7.2。TDD；commit 带 `Review-Anchor: P13-T8`。

### 问题（审核已定位）

`tailwind.config.ts` 的 `theme.extend.colors` **手抄了一套 hex**，与 spec 点名的唯一真源 `src/design/tokens.ts` 对不上：

| 语义 | tailwind.config.ts | tokens.ts | 
|---|---|---|
| ink | `#0B1220` | `#14140F` |
| brand | `#F5B12F` | `#E8A13A` |
| cream | `#F5F7FB` | `#F7F4EC` |
| accent | `#0F6FFF` | `#2C4A7C` |
| line | `#E4E8F0` | `world.line #2C4A7C` |

后果：`bg-brand`/`text-ink`/`border-line` 等语义类名渲染的是 **config 的值**，`tokens.ts` 名义真源形同虚设，两处任一改动都不会传导到另一处。

### 铁律

1. **单向真源**：`tokens.ts` 是唯一源。`tailwind.config.ts` 必须 `import { colors, world, sentimentColor } from "./src/design/tokens"` 取值填 `colors`，**删掉所有手抄字面 hex**（`sentiment.*` 也对齐 `sentimentColor` 取值）。
2. **色值收敛需设计确认**：两套值不一致处（ink/brand/cream/accent/line）**不要擅自二选一**——先在 commit body 列出 `旧config值 → 拟用tokens值` 全表等待审核者（设计者）确认取值；实现时以 tokens.ts 现值为准（spec §6 基线即 tokens.ts）。若某语义视觉呈现因此变化，截图/说明记录。
3. **不扩面**：**不要动** spec §7.2 明文豁免的中性排版灰——`text-slate-*` 文字层级、`bg-slate-100`、`bg-white`、`border-line` 全部保留，不为其造 token、不替换。这些不是语义色。
4. **零回归**：`skins/x` 全部测试、单平台 Retro、以及所有用 `bg-brand/text-ink/border-line/text-accent` 的组件渲染零回归（呈现色以收敛后的 tokens 值为准）。

### 可选规范化（做不做都行，别扩到别处）

- `MultiPlatformLiveScreen.tsx` 的 `text-slate-950`（用在 `bg-brand` 前景）→ `text-ink`，仅语义规范。

### 验收

```bash
cd frontend
# config 不再有裸语义 hex（应只剩从 tokens import 的引用）
rg -n "#[0-9A-Fa-f]{6}" tailwind.config.ts   # 期望零命中或仅 shadow 等非语义色
npx vitest run && npx tsc -b
```
加一个测试 pin 住 `tailwind.config` 消费的 `ink/brand/cream/accent/line` 等于 `tokens.ts` 对应值（防再次漂移）。

### 交付

回审核者：附 `旧config→tokens` 色值收敛全表 + 呈现变化说明（若有）+ vitest/tsc 结果 + 防漂移测试。卡点回 spec §6/§7.2，不要靠猜。
