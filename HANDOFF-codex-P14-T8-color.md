# 给 codex 的整改提示词（P14-T8：ComposeScreen 选中态/提示框语义色 token 化）

> 整段发给 codex。角色不变：实现者，TDD、不改设计、不弱断言绕过。P14 审核唯一 finding：`ComposeScreen.tsx` 选中态用 `bg-blue-50`、提示框用 `bg-amber-50/amber-*`（blue/amber 是语义色系，命中 spec §7.2 硬规则一"禁硬编 Tailwind 默认色阶表达语义色"）。T6 世界选区新增行沿用了这个历史 pattern。**不动 spec 明文豁免的中性排版灰（`text-slate-*`）。** 纯前端，vitest，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。收敛 `ComposeScreen.tsx` 的选中态与提示框语义色到 `design/tokens.ts`。设计真源 spec §6/§7.2。TDD；commit 带 `Review-Anchor: P14-T8`。

### 问题（审核已定位）

`ComposeScreen.tsx` 语义色硬编（`text-slate-600/950` 是中性排版灰，**豁免、保留不动**）：

| 行 | 现状 | 语义 |
|---|---|---|
| 328/348/431（**P14-T6 新增**） | `border-accent bg-blue-50 text-accent` | 世界选区选中态 |
| 551/568/652/700/721（历史遗留同 pattern） | `border-accent bg-blue-50 text-accent` | 身份/轮次选中态 |
| 527 | `border-brand bg-amber-50 text-slate-950` | 自定义轮次选中态（brand/amber 混用，不一致） |
| 515 | `bg-amber-50 ... text-amber-700` | 小标签 |
| 757/780（`review:P7-T10` 历史） | `border-amber-200 bg-amber-50 text-amber-800` | 成本提示框 |

`bg-blue-50` 是硬编的语义蓝底、`bg-amber-50/amber-*` 是硬编的语义琥珀——都非中性色，违反硬规则一。且 527 混用 brand/amber，与其它选中态不一致。

### 设计决策（照做，别自行发挥）

1. **选中态统一到 accent 系**：所有选区选中态一律 `border-accent bg-accentSoft text-accent`（含 527 的自定义轮次，去掉它的 brand/amber 混用）；未选态保持 `border-line text-slate-600`（中性，不动）。
2. **提示框统一到 warn 系**（琥珀语义，与 brand 同色系）：`border-warnBorder bg-warnSoft text-warnInk`。

### 步骤

**Step 1 · tokens.ts 补语义色**（唯一真源加字段，不动既有键）：
```ts
// 追加到 colors
accentSoft: "#E9EEF6",   // 选中态浅底（accent 的浅色 tint）
warnSoft:   "#FBF1DE",   // 提示框浅底（brand 同色系浅底）
warnBorder: "#EFD9AC",   // 提示框描边
warnInk:    "#7A4E12",   // 提示框文字（需 AA on warnSoft）
```
给定值仅为基线，你需**验证对比度**：`text-accent` on `accentSoft` ≥ 4.5、`warnInk` on `warnSoft` ≥ 4.5，不达标微调并在 commit body 记录。

**Step 2 · tailwind.config.ts 暴露**（P13-T8 已建立"从 tokens import"机制，沿用）：把 `accentSoft/warnSoft/warnBorder/warnInk` 从 `colors` 映射进 `theme.extend.colors`，不新写字面 hex。

**Step 3 · ComposeScreen.tsx 统一替换**：
- 所有 `bg-blue-50` → `bg-accentSoft`（选中态，配 `border-accent text-accent` 不变）。
- 527 `border-brand bg-amber-50 text-slate-950` → `border-accent bg-accentSoft text-accent`（并入 accent 选中态）。
- 515 `bg-amber-50 ... text-amber-700` → `bg-warnSoft ... text-warnInk`。
- 757/780 `border-amber-200 bg-amber-50 text-amber-800` → `border-warnBorder bg-warnSoft text-warnInk`。
- **不动** `text-slate-600/950`、`border-line`、`bg-white`（中性豁免）。

### 验收
```bash
cd frontend
# ComposeScreen 不再有 blue/amber 语义色阶
rg -n "bg-(blue|amber|emerald|rose|green|indigo|purple)-[0-9]|text-(blue|amber|emerald|rose|green)-[0-9]|border-(blue|amber)-[0-9]" src/screens/ComposeScreen.tsx   # 期望零命中
npx vitest run && npx tsc -b
```
- 加测试 pin：`accentSoft/warnSoft/warnBorder/warnInk` 存在且为 hex；对比度断言（同 P13-T8 tokens.test.ts 风格）。
- `ComposeScreen.test.tsx` 既有用例零回归（选中态类名断言若引用 `bg-blue-50` 需同步更新为 `bg-accentSoft`）。

### 交付
回审核者：附 rg 零命中输出 + 对比度断言 + vitest/tsc 结果。卡点回 spec §6/§7.2，不要靠猜。
