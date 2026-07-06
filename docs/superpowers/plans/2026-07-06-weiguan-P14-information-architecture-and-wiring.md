# P14 · 信息架构与产品接线贯通实现计划

> **For codex（实现者）：** 按本计划逐 Task TDD 实现，不改设计、不弱断言绕过。设计真源 spec `docs/superpowers/specs/2026-07-06-weiguan-P14-information-architecture-and-wiring-design.md`（契约见其 §2）+ `2026-07-02-weiguan-world-identity-and-wishes-design.md` §7 视觉硬规则。每 commit 带 `Review-Anchor: P14-T<n>`，代码打锚点，保留既有锚点。

**Goal：** 把"发起→世界→身份→现场→复盘→历史"接成用户可达的端到端流程，世界升为一等对象（可创建、可命名），发起即留痕，补全身份页入口。

**Architecture：** 后端归一（World 追加 `name`、新增只读 `GET /api/worlds`、发起 persist 归一），前端**先出原型图再高保真实现**（对齐 P13 调性），补世界选区与身份页多入口。纯文件存储不变，不引新依赖。

**Tech Stack：** FastAPI/pydantic（后端）；React/Vite/TS/Tailwind/vitest（前端）；imagegen（原型）。后端 venv `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python`。

## Global Constraints（每个 Task 隐含包含，逐字遵守）

1. **配色单一真源**：语义色只来自 `frontend/src/design/tokens.ts`（P13-T8 后 `tailwind.config.ts` 已从 tokens import）；禁在组件硬编 Tailwind 默认色阶表达语义色。**中性排版灰**（`text-slate-*` 文字层级、`bg-slate-100`、`bg-white`、`border-line`）按 spec §7.2 明文豁免，不受限。
2. **可见文案禁裸 ID**（spec §7.2 硬规则二）：世界名/身份名/作者名等可见区对 `/[0-9a-f]{12,}/` 与 `/w_[0-9a-f]{6,}/` **零命中**；测试 pin。
3. **心智词表**：禁 `agent/OASIS/仿真/工作台/后端/模型/微博客`；用户可见"步"→"拍"。
4. **发起即留痕**：任何发起路径一律 `persistent=True`，无"不保存"逃生口。
5. **name 单一真源**：世界显示名一律经后端 `resolve_world_name` 兜底，永不为空、永不裸 hex。
6. **P12 契约只追加**：不改既有端点响应形状，只追加 `name` 字段与新增 `GET /api/worlds`；`fold_world`、事件日志行格式、单平台路径语义不变。
7. **调性一致**：前端一切新增/改版**对齐 P13 原型**（`docs/manual/assets/2026-07-06-P13-prototypes/`）与现有组件语言（`components/Button.tsx` 的 primary/ghost、`components/Card.tsx`、圆角 `rounded-card`、字重层级），不得另起视觉风格。

顺序：**T1→T2→T3（后端）→ T4 原型图+自审（前端硬门，合格才继续）→ T5→T6→T7（前端）**。

---

## Task 1 · World.name 字段 + resolve_world_name 纯函数

**Files：**
- Modify: `backend/weiguan/world/models.py`（`World` 追加 `name`）
- Create: `backend/weiguan/world/naming.py`（`resolve_world_name`）
- Test: `backend/tests/world/test_world_naming.py`

**Interfaces：**
- Produces: `resolve_world_name(*, name: str | None, latest_content: str | None, primary_identity_name: str | None, created_at: str) -> str`

**要点：**
- `World` 追加 `name: str | None = None`（非破坏，旧数据缺省 None）。
- `resolve_world_name` 逐级候选，**每级过 `/[0-9a-f]{12,}/` 校验，命中即降级**：
  1. `name`（非空且非裸 hex）
  2. `latest_content` 前 12 字（strip 后非空）
  3. `{primary_identity_name}的世界`（且 primary 非裸 hex）
  4. `围观世界·{created_at 取日期部分 YYYY-MM-DD}`
- 保证返回非空、非裸 hex。

**断言（`review:P14-T1`）：**
- `name="饭圈观察"` → 返回 `"饭圈观察"`。
- `name=None, latest_content="某明星塌房这事你们怎么看这瓜太大了"` → 返回前 12 字 `"某明星塌房这事你们怎么看"`。
- `name=None, latest_content=None, primary_identity_name="估值洁癖"` → `"估值洁癖的世界"`。
- `name="7bb2eb80803d..."`（裸 hex）→ 跳过第 1 级，降级到后续。
- `primary_identity_name="a1b2c3d4e5f6a1"`（裸 hex）→ 跳过第 3 级。
- 全空 → `"围观世界·2026-07-06"`（用 created_at）。

---

## Task 2 · GET /api/worlds 只读接口

**Files：**
- Modify: `backend/weiguan/api/routes.py`（新增 `world_list`，`def` 走线程池）
- Modify: `backend/weiguan/world/store.py`（若需 `list_worlds` 聚合辅助）
- Test: `backend/tests/api/test_worlds_route.py`

**Interfaces：**
- Consumes: `resolve_world_name`（T1）、`WorldStore.list_all_launches`（P12-T5）、`list_identities`/`list_persons`、`RunStore.list`。
- Produces: `GET /api/worlds` → `{"worlds": [...]}`，字段见 spec §2.3。

**要点：**
- 只含 `persistent` 世界；每条：`world_id, name(resolved), identity_count, total_influence, platform_count, run_count, latest{content,created_at,status,run_ids,launch_id}, created_at`。
- `name` 用 `resolve_world_name`，`latest_content` 取该世界最近 launch/run 的 content，`primary_identity_name` 取该世界影响力最高身份。
- `latest` 取该世界最新 launch（`list_all_launches` 按世界过滤），无 launch 时回落最近 run。
- 排序：`latest.created_at`（无则 `created_at`）降序。
- `def` 函数（P12-T3 线程池），纯文件读不触发 LLM。

**断言（`review:P14-T2`）：**
- 非 persistent 世界不出现。
- 每条 `name` 非裸 hex（`/[0-9a-f]{12,}/`、`/w_[0-9a-f]{6,}/` 零命中）。
- `worlds` 按 latest 时间降序。
- 有 launch 的世界 `latest.run_ids` 非空；无 launch 有 run 的世界 `latest` 回落 run。
- `inspect.iscoroutinefunction(routes.world_list) is False`（线程池回归 pin）。

---

## Task 3 · 发起 persist 归一 + 匿名化名修裸 ID + name 透传

**Files：**
- Modify: `backend/weiguan/world/run_bridge.py:78-110`（`ensure_world_for_run`）
- Modify: `backend/weiguan/api/routes.py`（`create_run`/`create_multi_run`/`create_person` 接 `world_name`）
- Modify: `backend/weiguan/engine/config.py`（`RunConfig` 若需 `world_name` 透传字段，可选）
- Test: `backend/tests/world/test_run_bridge_persist.py`、`backend/tests/api/test_launch_persist_wiring.py`

**要点：**
- **persist 归一**：`ensure_world_for_run` 内 `persistent = True`（删 `bool(config.world_id or config.poster_person_id)`）；新建/复用世界一律持久化。
- **匿名化名修裸 ID**：`run_bridge.py:105` 的 `display_name = "我" if poster_person_id is None else person_id` → 改为无名时给确定性化名 `_anon_display_name(persona_kind, account_id)` = `{persona 中文}·{account_id 尾4}`，**删除 `else person_id`（裸 hex）分支**。persona 中文映射：ordinary=普通人 / verified=大V / kol=KOL。
- **name 透传**：新建世界时把可选 `world_name` 写入 `World.name`（`create_world(persistent=True, name=world_name)`）；继续已有世界忽略 name（空值不覆盖）。三个发起端点 body 追加可选 `world_name: str | None = None`。

**断言（`review:P14-T3`）：**
- 单平台 `create_run` 且 `poster_person_id=None, world_id=None` 发起后：世界 `persistent=True`、出现在 `GET /api/worlds`（覆盖"世界没新增"根因）。
- 匿名新身份 `display_name` 匹配 `围观者|普通人|大V|KOL` 化名，**不匹配** `/[0-9a-f]{12,}/`。
- `create_multi_run` 传 `world_name="测试世界"` 新建世界 → `World.name=="测试世界"`。
- 继续已有世界传 `world_name` → 不覆盖既有 name。
- 既有单平台/多平台成功路径其余行为零回归。

---

## Task 4 · 原型图 + 自审（前端硬门）

> **这是前端硬门：先出原型，对照 spec §7 自审落盘，合格后才做 T5–T7。** 不出原型直接改前端 = 违反计划。

**Files：**
- Create: `docs/manual/assets/2026-07-06-P14-prototypes/`（4 张 desktop+mobile 合图 + 一份自审 md）

### 完备原型提示词（codex 照此生成，逐条满足）

用 imagegen 产出以下 **4 个视图，每个 desktop + mobile 并排**，风格**严格对齐** `docs/manual/assets/2026-07-06-P13-prototypes/`（同一套视觉系统，不得另起风格）：

**通用调性硬约束（全部视图）：**
- 底色 `cream #F7F4EC`，主文字 `ink #14140F`，品牌强调 `brand #E8A13A`，次要文字 muted 灰，卡片白底 + `hairline #E4E8F0` 发丝边 + 圆角 8px（`rounded-card`）。
- 按钮沿用现有语言：主操作 = 实心 brand（primary），次操作 = 描边 ghost。
- 字重层级：标题 `font-black`、正文常规、辅助信息 muted 小字。
- **文案禁忌**：不出现 `agent/OASIS/仿真/工作台/后端/模型/微博客`；轮次用"拍"；不出现任何裸 hex（世界/身份/作者一律显示中文名或化名）。

**视图 1 · 发起页世界选区（ComposeScreen 改版）**
- 在现有"发帖身份"区**上方**新增"世界"选区：两个分段——「新建世界」（一个可选名称输入框 + 占位提示"留空自动命名"）/「继续世界」（可搜索的世界列表，窗口化展示，每项显示世界名 + 身份数 + 最近发起摘要，不无限铺开）。
- 保留原有正文、平台、身份、轮次、成本预览布局；世界选区自然融入右侧或顶部，不破坏首屏 CTA 可见性。

**视图 2 · 世界总览改版（WorldOverviewScreen）**
- 顶部区右上角新增「新建世界」按钮（ghost 或 primary，与"发起一条内容"并列且层级清晰）。
- 世界卡：标题用**世界名**（非 hex）；卡内**身份名可点**（视觉上给可点样式，如下划线/箭头）指向身份页；卡整体可点进世界全景；保留状态徽标、评论/转发/点赞/围观统计与"看最新现场/世界全景/看回放"操作。

**视图 3 · 身份页入口连贯（IdentityScreen 到达态）**
- 展示从"世界卡身份名 / 历史条目作者 / 现场作者名"点入身份页的**到达态**：身份页顶部有"返回来源世界"的面包屑/返回入口；页面显示昵称（非 hex）、身份类型、影响力、立场、账户信息。重点是**入口连贯**的视觉表达，不是新页面。

**视图 4 · 世界详情/全景入口（可与视图 2 合并出一张关系示意）**
- 示意世界卡 → 世界全景（不带 run_id）/ 本次发起现场（带 run_id）两条路径的入口区分，双语义标签清晰（呼应 P13"本次发起/世界全景"）。

### 自审（落 `2026-07-06-P14-prototypes/self-review.md`）
对照 spec §7.1–§7.3 逐条核：色彩全部可映射到 tokens；无裸 hex 文案；无禁忌词；组件语言与 P13 一致；四视图信息层级清晰。**不合格重出，合格才进 T5。**

**断言（`review:P14-T4`）：** 4 张合图 + self-review.md 存在；self-review 明确逐条对照 §7 且结论合格。

---

## Task 5 · 世界一等化前端

**Files：**
- Modify: `frontend/src/api/client.ts`（`fetchWorlds` + `WorldSummary` 类型）
- Modify: `frontend/src/screens/WorldOverviewScreen.tsx`（数据源换 `GET /api/worlds`）
- Modify: `frontend/src/pov/worlds.ts`（若卡片映射改为直接消费 WorldSummary）
- Test: `frontend/src/screens/WorldOverviewScreen.test.tsx`、`frontend/src/pov/worlds.test.ts`

**要点：**
- `fetchWorlds(): Promise<WorldSummary[]>` 打 `GET /api/worlds`；`WorldSummary` 含 spec §2.3 字段。
- `WorldOverviewScreen` 用 `fetchWorlds`，卡标题 = `world.name`（已 resolved）；删除靠 `getIdentities` 反推聚合的旧路径（`loadWorldCards`）。
- 世界卡可见区**零裸 world_id**（标题/统计/摘要都不显示 hex）。
- 按 T4 视图 2 调性；中性灰豁免，语义色走 token。

**断言（`review:P14-T5`）：**
- 给定 mock `GET /api/worlds` 两条，渲染两张卡，标题为 name。
- 渲染输出对 `/w_[0-9a-f]{6,}/`、`/[0-9a-f]{12,}/` 零命中。
- `fetchWorlds` 请求 URL 为 `/api/worlds`。

---

## Task 6 · 发起页世界选区

**Files：**
- Modify: `frontend/src/screens/ComposeScreen.tsx`（世界选区 + 提交透传 world_name/world_id）
- Modify: `frontend/src/api/client.ts`（`createRun`/`createMultiRun`/`createPerson` 入参加可选 `world_name`）
- Test: `frontend/src/screens/ComposeScreen.test.tsx`

**要点：**
- 世界选区两态（新建/继续）按 T4 视图 1：新建 = 可选名称输入（留空→不传 name，后端兜底）；继续 = `fetchWorlds` 列表，搜索 + 窗口化（复用 P13 身份列表窗口化模式）。
- 提交时：新建世界不传 `world_id`、传 `world_name`（若填）；继续世界传选中 `world_id`、不传 name。
- 单/多平台既有跳转逻辑不变（P13 行为零回归）。

**断言（`review:P14-T6`）：**
- 选"新建世界"填名 → 提交 payload 含 `world_name`、无 `world_id`。
- 选"继续世界" → payload 含选中 `world_id`、无 `world_name`。
- 继续世界列表可搜索过滤，超阈值窗口化（不全量铺开）。
- 单平台成功仍跳 `/run/:id/live`，多平台仍跳带全部 run_id 的 `/world/:id/live`。

---

## Task 7 · 信息架构入口贯通 + 端到端入口审计

**Files：**
- Modify: `frontend/src/screens/WorldOverviewScreen.tsx`（身份名 → `/identity/`）
- Modify: `frontend/src/screens/HistoryScreen.tsx`（条目作者 → `/identity/`）
- Modify: `frontend/src/screens/MultiPlatformLiveScreen.tsx` / `LiveScreen.tsx`（作者名 → `/identity/`，在有 person 归属时）
- Create: `docs/manual/2026-07-06-weiguan-P14-wiring-audit.md`（端到端入口审计清单）
- Test: 对应 `*.test.tsx`

**要点：**
- 身份页多入口：世界卡 `primaryIdentityName`、历史条目作者、现场作者名（有 person_id 归属时）→ `navigate(/identity/{person_id}?world_id=...)`。无 person 归属的匿名作者不强造入口。
- 端到端入口审计清单落 manual：按 spec §3 入口矩阵，逐跳转列**当前入口 + P14 后入口 + 验收方式**，作为接线可验收锚。
- 作者名可点但仍**显示化名/中文名**（禁裸 hex）。

**断言（`review:P14-T7`）：**
- 世界卡身份名点击 → 导航到 `/identity/{person_id}?world_id=...`。
- 历史条目作者点击 → 同上。
- 审计 manual 存在且覆盖 §3 入口矩阵每一行。
- 各入口锚文本对 `/[0-9a-f]{12,}/` 零命中。

---

## Task 8 · ComposeScreen 选中态/提示框语义色 token 化（审核回归补片）

> 起因：T1–T7 审核发现 `ComposeScreen.tsx` 选中态用 `bg-blue-50`、提示框用 `bg-amber-50/amber-*`（blue/amber 语义色系，命中硬规则一），T6 世界选区新增行沿用了此历史 pattern。整改提示词见 `HANDOFF-codex-P14-T8-color.md`。

- tokens.ts 补 `accentSoft`（选中态浅底）+ `warnSoft`/`warnBorder`/`warnInk`（提示框），AA 对比度达标；`tailwind.config.ts` 从 tokens import 暴露。
- ComposeScreen 选中态统一 `border-accent bg-accentSoft text-accent`（含 527 去 brand/amber 混用）；提示框统一 `border-warnBorder bg-warnSoft text-warnInk`。
- **不动**中性排版灰（`text-slate-*`、`border-line`、`bg-white`）。
- 断言：`rg "bg-(blue|amber)-[0-9]" src/screens/ComposeScreen.tsx` 零命中；对比度断言 pin；`ComposeScreen.test.tsx` 零回归。

## Review Index

| 锚点 | 主题 | 主要文件 |
|---|---|---|
| P14-T1 | World.name + resolve_world_name | `world/models.py`, `world/naming.py` |
| P14-T2 | GET /api/worlds | `api/routes.py`, `world/store.py` |
| P14-T3 | 发起 persist 归一 + 化名修裸ID + name 透传 | `world/run_bridge.py`, `api/routes.py` |
| P14-T4 | 原型图 + 自审 | `docs/manual/assets/2026-07-06-P14-prototypes/` |
| P14-T5 | 世界一等化前端 | `WorldOverviewScreen.tsx`, `api/client.ts`, `pov/worlds.ts` |
| P14-T6 | 发起页世界选区 | `ComposeScreen.tsx`, `api/client.ts` |
| P14-T7 | 入口贯通 + 审计清单 | `WorldOverviewScreen.tsx`, `HistoryScreen.tsx`, `*LiveScreen.tsx`, `manual` |
| P14-T8 | 选中态/提示框语义色 token 化（审核回归补片） | `design/tokens.ts`, `tailwind.config.ts`, `ComposeScreen.tsx` |

## 非目标（YAGNI）

- 世界删除/归档（发起即留痕会积累试验世界，短期靠"最新在前"排序承载；需要再单独立项）。
- 不动仿真内容质量 / 分析能力 / SSE 协议 / 虚拟列表。
- 不改 P12 已锁定的既有响应形状。
- spec 第 4 节（标准计划模板升级）由**设计者**执行，不在本实现片。

## 验收

```bash
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
cd frontend && npx vitest run && npx tsc -b
```

审核者按 Review Index 逐 Task 核 + 两条硬规则复查（`/w_[0-9a-f]{6,}/`、`/[0-9a-f]{12,}/` 可见区零命中；配色 token；心智词表）+ 原型调性对照 P13。e2e（用户代跑）：新身份发起→`/worlds` 出现该世界（带名）；世界卡身份名可点进身份页；试验发起也留痕。
