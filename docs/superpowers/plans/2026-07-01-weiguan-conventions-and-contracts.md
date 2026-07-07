# 围观 — 约定与接口契约

> 日期：2026-07-01
> 作用：所有计划的共同底座。①定义**审核锚点**机制（让设计者能按锚点审核 codex 的实现）；②**冻结**各计划之间的接口契约（Ports & Adapters 的"缝"）。
> 纪律：任何一层只准依赖本文件冻结的契约，不得越过缝去依赖别层的内部实现。

---

## 1. 审核锚点机制（审核锚点）

设计者（本人）不写实现，但要能对 codex 的产出做**可追溯审核**。为此约定一套贯穿"计划↔代码↔提交↔测试"的锚点标识。

### 1.1 锚点 ID 格式
```
<PlanCode>-T<任务号>[-AC<验收点号>]
```
- PlanCode：`P1`(规范模型+Adapter) `P2`(引擎+SSE) `PF0`(前端骨架) `P3`(POV+皮肤) `P4`(画廊+BYOK) `P5`(追问+复盘)。
- 例：`P2-T3` = 计划 2 的 任务 3；`P2-T3-AC1` = 该任务第 1 条验收标准。

### 1.2 codex 实现时**必须**打的三类标记
1. **代码锚点**：在实现该任务的主要代码单元上方留注释
   - Python：`# review:P2-T3`
   - TS/TSX：`// review:P2-T3`
2. **提交锚点**：commit message 末尾加 trailer
   - `Review-Anchor: P2-T3`
3. **测试锚点**：对应验收点的测试，函数名或紧邻注释带上 AC 号
   - `def test_xxx():  # review:P2-T3-AC1`

### 1.3 设计者的审核动作（我怎么审）
对任一计划：
1. `grep -rn "review:<PlanCode>" backend/ frontend/` 列出所有代码/测试锚点。
2. 对照该计划末尾的 **审核索引表**，逐条确认：每个 `AC` 都有对应测试锚点、且断言与索引表描述一致。
3. 运行索引表里列的命令，核对预期输出。
4. 缺锚点 / 锚点与索引表不符 / 命令不过 → 记为审核未通过，退回。

### 1.4 每个计划必带「审核索引表」
格式（放在每篇计划末尾）：

| 锚点 | 断言（这条要保证什么） | 审核凭据（测试名 / 命令 / 文件） |
|---|---|---|
| P2-T3-AC1 | 6/10/15 之外的 steps 被拒 | `test_steps_preset_validation` |

> 计划 1 追溯适用本机制：其锚点为 `P1-T1`(规范模型) `P1-T2`(fixture) `P1-T3`(actors/posts/replies) `P1-T4`(reactions/follows/reports/traces)。交接时请 codex 按 §1.2 补打标记。

---

## 2. 冻结的接口契约

### 2.1 规范模型（已在计划 1 冻结）
`weiguan.canonical` 的 `RunSnapshot / Actor / Post / Reply / Reaction / Follow / Report / TraceEvent` 及枚举。**所有后续层的数据形状以此为唯一真源。** 字段见 计划 1。

### 2.2 运行发起 REST（计划 2 实现，计划 4 消费）
```
POST /api/runs
Headers:
  X-LLM-Key:   <用户自带的 API key，BYOK；后端仅代传，不落库>
  X-LLM-Model: <如 gpt-4o-mini / qwen-turbo>
Body (application/json):
  {
    "audience": { "crowd_id": "tech_devs" }        // 二选一
              |  { "custom": "一二线城市、重性价比的年轻妈妈" },
    "content":  "构建砍到3秒",
    "steps":    10,                                  // 必须 ∈ {6,10,15}
    "platform": "twitter"                            // 默认 twitter
  }
Resp 200: { "run_id": "r_ab12cd" }
Resp 400: { "error": "steps must be one of 6/10/15" }
Resp 401: { "error": "missing X-LLM-Key" }
```
轮次枚举语义：`6`=快速围观 `10`=标准(推荐) `15`=深度发酵。

### 2.3 事件流 SSE（计划 2 实现，计划 3 消费）
```
GET /api/runs/{run_id}/events        (text/event-stream)
```
消息类型（`event:` 名 + `data:` 为 JSON）：
- `run_started`  → `{ "run_id","steps","platform","seed_post_id" }`
- `step_started` → `{ "step": 3, "total": 10 }`
- `delta`        → `{ "step": 3, "snapshot": <部分 RunSnapshot，仅本步新增实体> }`
  - 即：`delta.snapshot` 是一个 `RunSnapshot`，只含该 step 新产生的 actors/posts/replies/reactions/follows/reports/traces（可为空列表）。前端做累加。
- `step_done`    → `{ "step": 3 }`
- `run_done`     → `{ "run_id" }`（完整快照另经 §2.5 拉取）
- `error`        → `{ "message": "LLM key invalid" }`（发送后关闭流；已发的 delta 不回滚）

### 2.4 追问 INTERVIEW REST（计划 2 提供端点，计划 5 消费）
```
POST /api/runs/{run_id}/interview
Headers: X-LLM-Key, X-LLM-Model
Body: { "actor_id": 2, "question": "你为什么不信3秒?" }
Resp 200: { "actor_id": 2, "question": "...", "answer": "我维护过那套构建..." }
Resp 404: { "error": "run or actor not found" }
```

### 2.5 快照 REST（计划 2 实现，计划 5/复盘消费）
```
GET /api/runs/{run_id}/snapshot
Resp 200: <完整 RunSnapshot 的 model_dump() JSON>
Resp 404: { "error": "run not found" }
```

### 2.6 POV → ViewModel 形状（计划 3 冻结细节，此处先定骨架）
POV 透镜是**纯函数**：`(RunSnapshot, POV) -> ViewModel`。v1 只做 `poster` POV，ViewModel 骨架：
```ts
type FeedItem =
  | { type: "post";  post: Post;  author: Actor;  replies: Reply[] }
  | { type: "notification"; kind: "like"|"repost"|"reply"|"follow"; actor: Actor }
type PosterViewModel = {
  me: Actor;               // 发帖者（seed_post 的作者）
  seedPost: Post;
  feed: FeedItem[];        // 按时间/步排序，供皮肤逐条渲染
}
```
> 具体字段在 计划 3 定稿；此处冻结的是"POV 是纯函数、皮肤只消费 ViewModel、皮肤不碰 RunSnapshot/引擎"这一约束。

---

## 3. 目录约定
```
backend/    Python + FastAPI（weiguan.canonical / adapter / engine / api）
frontend/   React + Vite + TS + Tailwind（PF0 建骨架，P3/4/5 往里加）
docs/superpowers/{specs,plans}/   设计与计划
```

---

## 4. 写计划的顺序（串行，逐篇；本人写、留锚点、事后审）
1. 本文件（约定+契约）✅
2. 计划 2：后端引擎封装 + 逐步运行 + SSE + 运行/追问/快照 API（实现 §2.2–2.5）
3. 计划 F0：前端骨架 + 产品壳 + 设计 tokens（§6 视觉语言落成 Tailwind theme）
4. 计划 3：poster POV 透镜 + X 皮肤 + SSE 流式播放（消费 §2.3、§2.6）
5. 计划 4：圈子卡牌画廊 + 自定义受众 + BYOK 设置（消费 §2.2）
6. 计划 5：INTERVIEW 抽屉 + 复盘上帝视角（消费 §2.4、§2.5）
```

---

## 5. 每个计划必带「端到端接线验收表」（P14 起制度化）

> 立此节的教训：P6–P13 每片只**新增能力**（事件溯源、身份、多平台、读模型、界面产品化），却没有一片专门把能力接成用户可达的端到端路径 + 统一沉淀契约。用户实测暴露"找不到世界创建入口""选新身份发起后世界没新增""找不到身份运行时信息入口"——根因是"按单点做、缺产品接线"。**接线不是可选项，是标准计划的一部分。** 详见 [[2026-07-06-weiguan-P14-information-architecture-and-wiring-design]] §0/§3。

### 5.1 强制要求
从 P14 起，**每篇计划末尾（紧邻「审核索引表」）必须附「端到端接线验收表」**，逐条列出本片新增/触及的用户可达路径，且每条给出可核验的入口凭据。缺此表的计划视为未完成设计。

### 5.2 表格式
| 路径（从 → 到） | 入口（用户怎么到达） | 接线验收凭据（测试名 / 组件 / 手动步骤） |
|---|---|---|
| 发起页 → 世界 | 世界选区（新建/继续） | `ComposeScreen.test.tsx` 世界选区提交路径 |
| 世界总览 → 身份页 | 世界卡身份名可点 → `/identity/{person_id}` | `WorldOverview` 断言身份名为 link |

### 5.3 三条硬校验（每条路径都过）
1. **入口连通**：目标态确有可点入口，不是只做了页面没接链路（"按单点做"的典型漏项）。
2. **无死胡同**：到达页有返回/前进路径，不把用户困死。
3. **可见区无裸 ID**：路径上所有可见文案对 `/[0-9a-f]{12,}/`、`/w_[0-9a-f]{6,}/` 零命中（呼应 §7.2 硬规则二）。

### 5.4 沉淀契约随附
凡新增"发起/创建"类动作，必须在本表声明其**留痕语义**：是否 persist、由谁兜底命名、空值如何回落。禁止把 persist 交给脆弱推断（如 `bool(...)`），发起即留痕为默认。
