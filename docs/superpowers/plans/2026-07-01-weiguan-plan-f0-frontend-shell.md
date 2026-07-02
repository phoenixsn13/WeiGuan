# 围观 计划 F0 — 前端骨架 + 产品壳 + 设计 tokens 实现计划

> **给 agentic 实现者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项实现本计划。步骤使用复选框（`- [ ]`）语法跟踪。
> **审核锚点**：遵守 `2026-07-01-weiguan-conventions-and-contracts.md` §1。每个任务 = 锚点 `PF0-T<n>`；实现时打 `// review:PF0-T<n>`、commit trailer `Review-Anchor: PF0-T<n>`、验收测试打 `// review:PF0-T<n>-AC<k>`。

**目标：** 立起 React+Vite+TS+Tailwind 前端骨架，把设计文档 §6 的视觉语言固化为可复用的 tokens 与壳组件，并铺好 计划 3/4/5 往里加内容的路由与挂载点——**不实现任何皮肤或业务功能**。

**架构：** 三层：`design/`（tokens：颜色/字体/圆角/聚光阴影/情绪语义色/POV 枚举）→ `components/`（壳原语：Button/Card/SentimentTag）→ `shell/`（AppShell 品牌外壳 + 路由，含 4 个占位屏，供后续计划替换内容）。皮肤与 ViewModel 消费**不在本计划**。

**技术栈：** React 18，Vite 5，TypeScript 5，Tailwind CSS 3，Vitest + @testing-library/react + jsdom，react-router-dom 6。

## 全局约束
- 只做骨架/壳/tokens；**不实现皮肤、不接后端、不写业务屏内容**（占位屏仅放标题文字）。
- 视觉 tokens 必须与设计文档 §6 一致（下方逐值列出，逐字使用）。
- 品牌壳（寄存器 B）与皮肤区（寄存器 A）**分离**：本计划只做壳；皮肤区留空插槽。
- 前端根目录 `frontend/`；测试命令 `cd frontend && npm test`（Vitest run 模式）。
- 设计 token 值（来自 §6，逐字）：
  - ink `#14140F`、cream `#F7F4EC`
  - brand（暖琥珀）`#E8A13A`、accent（靛蓝）`#2C4A7C`
  - 情绪：positive `#3E9B6E`、negative `#C4553B`、neutral `#8A8578`、contested 用 `#B4552F`→`#E8A13A` 渐变
  - 圆角 card=8px、描边 1px、聚光阴影 spotlight
  - 字体：display=Noto Serif SC（标题、策展感），body=Noto Sans SC，数字 tabular-nums

## 文件结构
```
frontend/
  package.json  vite.config.ts  tsconfig.json  tsconfig.node.json
  tailwind.config.ts  postcss.config.js  index.html  vitest.setup.ts
  src/
    main.tsx  App.tsx  index.css
    design/tokens.ts            design/tokens.test.ts          # PF0-T2
    components/Button.tsx  components/Card.tsx  components/SentimentTag.tsx
    components/components.test.tsx                             # PF0-T3
    shell/AppShell.tsx  shell/routes.tsx  shell/shell.test.tsx # PF0-T4
    screens/GalleryScreen.tsx  screens/ComposeScreen.tsx
    screens/LiveScreen.tsx     screens/RetroScreen.tsx         # PF0-T4 占位
```

---

### 任务 1 (PF0-T1): Vite+React+TS+Tailwind+Vitest 骨架

**文件：** Create `frontend/` 下全部脚手架文件；Test `frontend/src/App.test.tsx`（临时 smoke）。

**接口 — 产出：** `npm test` 可跑、`npm run build` 可过的空壳；`App` 组件渲染 "围观"。

- [ ] **步骤 1：写 `frontend/package.json`**
```json
{
  "name": "weiguan-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **步骤 2：写配置文件**

`frontend/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```
`frontend/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom";
```
`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020", "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"], "module": "ESNext",
    "skipLibCheck": true, "moduleResolution": "bundler",
    "resolveJsonModule": true, "isolatedModules": true, "noEmit": true,
    "jsx": "react-jsx", "strict": true, "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"], "references": [{ "path": "./tsconfig.node.json" }]
}
```
`frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": { "composite": true, "skipLibCheck": true,
    "module": "ESNext", "moduleResolution": "bundler", "allowSyntheticDefaultImports": true },
  "include": ["vite.config.ts"]
}
```
`frontend/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```
`frontend/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14140F",
        cream: "#F7F4EC",
        brand: "#E8A13A",     // 暖琥珀 · 聚光灯
        accent: "#2C4A7C",    // 靛蓝 · 理性/数据
        sentiment: {
          positive: "#3E9B6E",
          negative: "#C4553B",
          neutral: "#8A8578",
          contestedFrom: "#B4552F",
          contestedTo: "#E8A13A",
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', "serif"],
        body: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      borderRadius: { card: "8px" },
      boxShadow: {
        spotlight: "0 6px 20px -8px rgba(20,20,15,0.35), 0 0 0 1px rgba(232,161,58,0.15)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **步骤 3：写 `frontend/index.html` 与入口**

`frontend/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>围观 Weiguan</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```
`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --wg-ink: #14140F; --wg-cream: #F7F4EC;
  --wg-brand: #E8A13A; --wg-accent: #2C4A7C;
}
body { @apply bg-cream text-ink font-body; }
.tabular { font-variant-numeric: tabular-nums; }
```
`frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```
`frontend/src/App.tsx`（本任务 临时版，PF0-T4 会替换为路由）:
```tsx
export default function App() {
  return <div className="font-display text-2xl">围观</div>;
}
```

- [ ] **步骤 4：写 smoke 测试 `frontend/src/App.test.tsx`**
```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders brand", () => {  // review:PF0-T1-AC1
  render(<App />);
  expect(screen.getByText("围观")).toBeInTheDocument();
});
```

- [ ] **步骤 5：安装并运行** — `cd frontend && npm install && npm test`
期望： 1 passed。再 `npm run build` 期望： 构建成功。

- [ ] **步骤 6：提交**
```bash
git add frontend/
git commit -m "chore(frontend): Vite+React+TS+Tailwind+Vitest 骨架

Review-Anchor: PF0-T1"
```

---

### 任务 2 (PF0-T2): 设计 tokens 模块

**文件：** Create `frontend/src/design/tokens.ts`；Test `frontend/src/design/tokens.test.ts`.

**接口 — 产出：**
- `colors` = { ink, cream, brand, accent }
- `sentimentColor(kind: Sentiment): string`，`Sentiment = "positive"|"negative"|"neutral"|"contested"`
- `POV = { POSTER:"poster", PLATFORM:"platform", KOL:"kol" } as const`（v1 只用 POSTER，其余留位）

- [ ] **步骤 1：写失败测试 `design/tokens.test.ts`**
```ts
import { colors, sentimentColor, POV } from "./tokens";

test("brand and accent tokens match 设计 §6", () => {  // review:PF0-T2-AC1
  expect(colors.brand).toBe("#E8A13A");
  expect(colors.accent).toBe("#2C4A7C");
  expect(colors.ink).toBe("#14140F");
});

test("sentiment colors map correctly", () => {  // review:PF0-T2-AC2
  expect(sentimentColor("positive")).toBe("#3E9B6E");
  expect(sentimentColor("negative")).toBe("#C4553B");
  expect(sentimentColor("neutral")).toBe("#8A8578");
  expect(sentimentColor("contested")).toContain("gradient");
});

test("POV enum reserves three lenses, poster first", () => {  // review:PF0-T2-AC3
  expect(POV.POSTER).toBe("poster");
  expect(Object.values(POV)).toEqual(["poster", "platform", "kol"]);
});
```

- [ ] **步骤 2：运行确认失败** — `npm test -- tokens` → FAIL。

- [ ] **步骤 3：写实现 `design/tokens.ts`**
```ts
// review:PF0-T2  设计 tokens（对应 设计 §6）
export const colors = {
  ink: "#14140F",
  cream: "#F7F4EC",
  brand: "#E8A13A",
  accent: "#2C4A7C",
} as const;

export type Sentiment = "positive" | "negative" | "neutral" | "contested";

export function sentimentColor(kind: Sentiment): string {
  switch (kind) {
    case "positive": return "#3E9B6E";
    case "negative": return "#C4553B";
    case "neutral": return "#8A8578";
    case "contested": return "linear-gradient(90deg, #B4552F, #E8A13A)";
  }
}

export const POV = { POSTER: "poster", PLATFORM: "platform", KOL: "kol" } as const;
export type PovKind = (typeof POV)[keyof typeof POV];
```

- [ ] **步骤 4：运行确认通过** — `npm test -- tokens` → PASS（3 passed）。
- [ ] **步骤 5：提交**
```bash
git add frontend/src/design
git commit -m "feat(frontend): 设计 tokens（颜色/情绪/POV）

Review-Anchor: PF0-T2"
```

---

### 任务 3 (PF0-T3): 壳原语 Button / Card / SentimentTag

**文件：** Create `frontend/src/components/{Button,Card,SentimentTag}.tsx`；Test `frontend/src/components/components.test.tsx`.

**接口 — 产出：**
- `Button({children, onClick, variant?})`，variant `"primary"|"ghost"`，primary 用 brand 底色。
- `Card({children, interactive?})`，`interactive` 时带 `hover:shadow-spotlight`（聚光升起）；根节点 `data-testid="wg-card"`。
- `SentimentTag({kind, label})`，用 `sentimentColor(kind)` 上色（positive/negative/neutral 用纯色，contested 用渐变 background）。

- [ ] **步骤 1：写失败测试 `components/components.test.tsx`**
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";
import { Card } from "./Card";
import { SentimentTag } from "./SentimentTag";

test("button fires onClick and shows label", () => {  // review:PF0-T3-AC1
  const fn = vi.fn();
  render(<Button onClick={fn}>开始围观</Button>);
  fireEvent.click(screen.getByText("开始围观"));
  expect(fn).toHaveBeenCalledOnce();
});

test("interactive card has spotlight hover class", () => {  // review:PF0-T3-AC2
  render(<Card interactive>内容</Card>);
  expect(screen.getByTestId("wg-card").className).toContain("hover:shadow-spotlight");
});

test("sentiment tag colors positive", () => {  // review:PF0-T3-AC3
  render(<SentimentTag kind="positive" label="正向" />);
  const el = screen.getByText("正向");
  expect(el).toHaveStyle({ color: "#3E9B6E" });
});
```

- [ ] **步骤 2：运行确认失败** — `npm test -- components` → FAIL。

- [ ] **步骤 3：写实现**

`components/Button.tsx`:
```tsx
// review:PF0-T3
type Props = { children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" };
export function Button({ children, onClick, variant = "primary" }: Props) {
  const base = "rounded-card px-4 py-2 font-body text-sm transition";
  const style = variant === "primary"
    ? "bg-brand text-ink hover:brightness-105"
    : "bg-transparent text-ink border border-ink/15 hover:border-brand";
  return <button className={`${base} ${style}`} onClick={onClick}>{children}</button>;
}
```
`components/Card.tsx`:
```tsx
// review:PF0-T3
type Props = { children: React.ReactNode; interactive?: boolean };
export function Card({ children, interactive }: Props) {
  const base = "rounded-card border border-ink/10 bg-white p-4 transition";
  const hover = interactive ? "hover:shadow-spotlight hover:-translate-y-0.5" : "";
  return <div data-testid="wg-card" className={`${base} ${hover}`}>{children}</div>;
}
```
`components/SentimentTag.tsx`:
```tsx
// review:PF0-T3
import { sentimentColor, Sentiment } from "../design/tokens";
type Props = { kind: Sentiment; label: string };
export function SentimentTag({ kind, label }: Props) {
  const isGradient = kind === "contested";
  const style = isGradient
    ? { background: sentimentColor(kind), WebkitBackgroundClip: "text",
        color: "transparent" as const }
    : { color: sentimentColor(kind) };
  return <span className="text-xs font-body" style={style}>{label}</span>;
}
```

- [ ] **步骤 4：运行确认通过** — `npm test -- components` → PASS（3 passed）。
- [ ] **步骤 5：提交**
```bash
git add frontend/src/components
git commit -m "feat(frontend): 壳原语 Button/Card/SentimentTag

Review-Anchor: PF0-T3"
```

---

### 任务 4 (PF0-T4): AppShell 品牌外壳 + 路由 + 占位屏

**文件：** Create `frontend/src/shell/{AppShell,routes}.tsx`、`frontend/src/screens/{GalleryScreen,ComposeScreen,LiveScreen,RetroScreen}.tsx`；Modify `frontend/src/App.tsx`；Test `frontend/src/shell/shell.test.tsx`.

**接口 — 产出：**
- `AppShell({children})`：顶部品牌条（"围观" wordmark + 标语 + 主题切换占位按钮），下方 `<main>` 渲染 children（皮肤/业务将挂这里）。
- `routes.tsx`：导出 `AppRoutes` 组件，映射 `/`→Gallery、`/compose`→Compose、`/run/:id/live`→Live、`/run/:id/retro`→Retro（均为占位屏，仅标题文字）。
- `App` 用 `BrowserRouter` 包 `AppShell` + `AppRoutes`。

- [ ] **步骤 1：写失败测试 `shell/shell.test.tsx`**
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { AppRoutes } from "./routes";

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell><AppRoutes /></AppShell>
    </MemoryRouter>
  );
}

test("shell shows brand wordmark", () => {  // review:PF0-T4-AC1
  at("/");
  expect(screen.getByText("围观")).toBeInTheDocument();
});

test("root route renders gallery placeholder", () => {  // review:PF0-T4-AC2
  at("/");
  expect(screen.getByText(/选一个圈子/)).toBeInTheDocument();
});

test("live route renders live placeholder", () => {  // review:PF0-T4-AC3
  at("/run/r_1/live");
  expect(screen.getByText(/进行时/)).toBeInTheDocument();
});
```

- [ ] **步骤 2：运行确认失败** — `npm test -- shell` → FAIL。

- [ ] **步骤 3：写实现**

`shell/AppShell.tsx`:
```tsx
// review:PF0-T4
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="flex items-center justify-between border-b border-ink/10 px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl">围观</span>
          <span className="text-xs text-ink/50">把你的内容，先扔给一群人围观一下</span>
        </div>
        <button className="text-xs text-ink/50 hover:text-brand" aria-label="主题切换">◐</button>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
```
四个占位屏（每个仅一行标题，供后续计划替换）：
`screens/GalleryScreen.tsx`:
```tsx
export default function GalleryScreen() {
  return <h1 className="font-display text-2xl">选一个圈子</h1>;  // review:PF0-T4
}
```
`screens/ComposeScreen.tsx`:
```tsx
export default function ComposeScreen() {
  return <h1 className="font-display text-2xl">写点什么</h1>;  // review:PF0-T4
}
```
`screens/LiveScreen.tsx`:
```tsx
export default function LiveScreen() {
  return <h1 className="font-display text-2xl">进行时 · 围观中</h1>;  // review:PF0-T4
}
```
`screens/RetroScreen.tsx`:
```tsx
export default function RetroScreen() {
  return <h1 className="font-display text-2xl">复盘</h1>;  // review:PF0-T4
}
```
`shell/routes.tsx`:
```tsx
// review:PF0-T4
import { Routes, Route } from "react-router-dom";
import GalleryScreen from "../screens/GalleryScreen";
import ComposeScreen from "../screens/ComposeScreen";
import LiveScreen from "../screens/LiveScreen";
import RetroScreen from "../screens/RetroScreen";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<GalleryScreen />} />
      <Route path="/compose" element={<ComposeScreen />} />
      <Route path="/run/:id/live" element={<LiveScreen />} />
      <Route path="/run/:id/retro" element={<RetroScreen />} />
    </Routes>
  );
}
```
`src/App.tsx`（替换 Task1 临时版）:
```tsx
import { BrowserRouter } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import { AppRoutes } from "./shell/routes";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell><AppRoutes /></AppShell>
    </BrowserRouter>
  );
}
```
> 注意：Task1 的 `src/App.test.tsx` 断言 "围观" 仍成立（AppShell 含 wordmark），但它直接 `render(<App/>)` 会因 BrowserRouter 正常工作；保留该测试。

- [ ] **步骤 4：运行确认通过** — `cd frontend && npm test` → 全绿（App smoke + tokens 3 + components 3 + shell 3）。
- [ ] **步骤 5：提交**
```bash
git add frontend/src/shell frontend/src/screens frontend/src/App.tsx
git commit -m "feat(frontend): AppShell 品牌壳 + 路由 + 占位屏

Review-Anchor: PF0-T4"
```

---

## 审核索引

| 锚点 | 断言 | 审核凭据 |
|---|---|---|
| PF0-T1-AC1 | 骨架可跑、App 渲染品牌 | `src/App.test.tsx`；`npm run build` 成功 |
| PF0-T2-AC1 | brand/accent/ink 值合 §6 | `tokens.test.ts` |
| PF0-T2-AC2 | 情绪色映射正确 | `tokens.test.ts` |
| PF0-T2-AC3 | POV 保留三视角、poster 优先 | `tokens.test.ts` |
| PF0-T3-AC1 | Button 点击回调 | `components.test.tsx` |
| PF0-T3-AC2 | 交互 Card 有聚光 hover | `components.test.tsx` |
| PF0-T3-AC3 | SentimentTag 上色 | `components.test.tsx` |
| PF0-T4-AC1 | 壳显示品牌 wordmark | `shell.test.tsx` |
| PF0-T4-AC2 | `/` 渲染画廊占位 | `shell.test.tsx` |
| PF0-T4-AC3 | `/run/:id/live` 渲染进行时占位 | `shell.test.tsx` |

## 自审
- **规格覆盖**：落实 §6 全部 tokens（双色主题底色、brand/accent、情绪语义色、圆角/聚光阴影、display/body 字体、tabular-nums）与"壳/皮肤分离"约束；铺好 §3 核心循环的 4 个路由挂载点（画廊→写内容→进行时→复盘）。皮肤与 ViewModel 消费明确留给 计划 3。
- **占位符扫描**：占位屏是**有意的**空屏（后续计划替换），非计划占位符；每步均有完整文件内容与命令。
- **类型一致性**：`POV`/`Sentiment`/`sentimentColor` 在 tokens 定义、被 SentimentTag 消费；`AppShell`/`AppRoutes` 签名在 shell 与 App 中一致；Tailwind theme 的 `brand/accent/sentiment/shadow-spotlight/rounded-card/font-display` 与组件 className 引用一致。
