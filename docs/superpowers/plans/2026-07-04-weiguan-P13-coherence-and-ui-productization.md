# P13 · 连贯性与界面产品化（前端为主，依赖 P12）

> 设计真源：spec `2026-07-02-weiguan-world-identity-and-wishes-design.md`（§7 全节 + §7.2 两条硬规则 + §9 分片 8）。
> 依据：`docs/manual/2026-07-04-weiguan-current-state-manual.md` 截图实据与 §12 已知限制。
> 前置：**P12 已落地并通过审核**——本片按 P12 §2 契约消费，不回改后端契约。
> TDD + 每 commit `Review-Anchor: P13-T<n>`。

## 0. 根因与目标

修**根因 C：展示层产品化欠账**，并把根因 B 的前端半边接完。截图实据：

1. 多平台现场作者显示裸 hex（微博列 `7bb2eb80803d…`、Reddit `u/7bb2eb8…`）——显示名管线断裂，最刺眼。
2. 微博卡 meta 行"刚刚·来自Web"竖排溢出；桥接线是 `absolute top-[74px]` + 百分比宽度 hack（`MultiPlatformLiveScreen.tsx:165-196`）；桥接面板占满一列却常年空态。
3. Live 轮询 1500ms 永不停、无"发酵中/已完成"终态；双语义（本次发起 vs 世界全景）页面不自解释，要靠 manual 教育用户。
4. 历史/热榜口径：同内容发起 4 次 = 热榜 4 条重复标题；多平台发起在历史里缺席或入口丢 run_id。
5. replay 语义残留：回放模式左下写"实时互动 49 条新评论"、底部浮条遮内容；术语"500 步·微博客"（技术词"步"、平台标签口径不一）。
6. 命名：`码05_产品懂点码` 数据集前缀、世界总览 2.5s 白屏字符串、compose 右栏空旷。

## 1. 铁律

1. **配色单一真源**（spec §7.2 硬规则一）：语义色只准来自 `design/tokens.ts`，禁 Tailwind 默认色阶。历史三次欠账（P8-T7/P9-T8/P11 遗留），动前端必先自查。
2. **可见文案禁裸 ID**（spec §7.2 硬规则二，本片新立）：任何用户可见文本不得出现 account_id/person_id/world_id/run_id 的裸 hex；显示名一律走"payload 富化 → 投影 join → 确定性化名"解析链。
3. **单平台零回归**：`POST /api/runs`、`/run/:id/live`、单平台复盘路径行为不变；`MultiPlatformLiveScreen` 继续接受注入 `events`（测试回归）。
4. 心智词表：禁 `agent/OASIS/仿真/工作台/后端/模型/步`（对用户可见处"步"→"拍"），用 世界/身份/平台/现场/发酵/传播/桥接/拍。
5. **UI 工作流强制**：T2 先 imagegen 原型 + 自审，合格后再做 T3–T7。
6. 测试用 msw/fixture mock P12 契约，不碰 LLM key。

## 2. Tasks

### T1 · 显示名管线（后端小补 + 前端解析链） `review:P13-T1`

- 后端 `world/run_bridge.py` `delta_to_events`：seed/post/reply 事件 payload 追加 `author_display_name`（从 `delta.snapshot.actors` 按 author_id 取 `name or user_name`；取不到不写键）。只追加 payload 键，历史事件无此键属正常。
- 前端 `pov/multiplatform.ts` + `skins/`：显示名解析链（顺序固定）：
  1. `payload.author_display_name`；
  2. 世界 persons 投影 join（按 `actor_account_id` 对 account→person.display_name；Live 页进场拉一次 `listPersons` 建索引，失败静默跳过）；
  3. 确定性化名兜底：`围观者·{account_id 尾 4 位}`——**永不渲染完整裸 hex**。
- 显示名清洗（单一工具函数 `cleanDisplayName`，展示层统一调用）：去数据集前缀（`码05_产品懂点码` → `产品懂点码`，规则：`^.{1,3}\d{1,3}_`）；数字后缀（`估值洁癖2`）保留——那是唯一性区分，去掉会撞名。
- 断言：三级解析链各自命中；渲染输出对 `/[0-9a-f]{12,}/` 正则零命中（裸 ID 禁令回归测试，挂在多平台现场与单平台皮肤两处）；前缀清洗规则精确 pin。

### T2 · 原型图 + 自审 `review:P13-T2`

imagegen 产出并自审后落盘 manual assets（desktop + mobile）：

- **多平台现场改版**：模式徽标（「本次发起 · 2 平台 · 发酵中 第 n 拍」/「世界全景 · 共 N 次发起」）；桥接改为列间文档流元素（列顶横条徽章 + 列内嵌桥接标记，不再 absolute 悬浮）；桥接面板只在有桥时以右栏出现，无桥时不占列；平台列 2–3 列自适应；卡片 meta 行换行/省略策略。
- **统一发起历史**：单平台与多平台发起同列；多平台条目带平台角标组、状态徽标、「看现场」+ 每平台「评论区/复盘」；热榜同内容聚合成一条 +「发起 N 次」徽章。
- **launch 复盘**：平台 tab + 桥接摘要卡 + 风味摘要卡。
- **发起页收紧**：右栏填成本预估卡+身份摘要；提交 CTA 首屏可见。
- 自审对照 spec §7.1–§7.3 调性 + 两条硬规则 + 心智词表，自审结论落盘。

### T3 · 多平台现场改版 `review:P13-T3`

- **游标轮询 + 终态**：`getWorldEvents` 升级消费 `{frames, next_after, clock_tick, launch_status}`；轮询带 `after=next_after` 只拉增量；`mergeEvents(existing, incoming)` 按 event_id 去重、按 `(tick, created_at, event_id)` 排序；`launch_status ∈ {done, error}` 时做最后一次拉取后**停止轮询**。
- **状态徽标**：running →「发酵中 · 第 {clock_tick} 拍」；done →「已完成 · 共 {clock_tick} 拍」；error → 诚实错误态 + 重试。
- **双语义显式化**：带 run_id →「本次发起」模式徽标；不带 →「世界全景 · 共 N 次发起」+ launch 切换器（数据来自 `/api/launches` 过滤本世界，点击跳带 run_id 的本次发起 URL）。
- **布局重构**（按 T2 原型）：删除 absolute 桥接线 hack；meta 行溢出修复；空桥不占列。注入 `events` prop 的既有测试路径保持可用。
- 断言：轮询第二次请求带 after；done 后 interval 被清；两种模式徽标文案；merge 去重排序 pin；裸 ID 正则零命中。

### T4 · 统一发起历史 + 世界总览 + 热榜聚合 `review:P13-T4`

- `HistoryScreen`：数据源改 `GET /api/launches`（身份分组维度保留——按 `poster_person_id` 聚合）；多平台条目按 T2 原型渲染，「看现场」= `/world/{world_id}/live?run_id=...&run_id=...`（run_ids 来自 launch，**不再有丢 run_id 的世界现场入口**）；每平台「评论区/复盘」直连 `/run/{platform_run_id}/live?replay=1`、`/run/{platform_run_id}/retro`（P12-T6 已让这些 run 可用）。
- `WorldOverviewScreen`：「看多平台现场」改为取该世界最新 launch 的带 run_id URL；保留「世界全景」次级入口（显式命名）。
- 热榜（Gallery + History 右栏）：同 `content` 聚合为一条，取最热/最新数据 +「发起 N 次」徽章。
- 断言：历史条目 kind=multi 渲染平台角标组与正确 URL；单平台条目与现状一致（零回归快照）；热榜对 4 条同题输入输出 1 条带 N=4。

### T5 · 回放/复盘减重与语义清理 `review:P13-T5`

- `LiveScreen` replay：初始拉 `snapshot?tail=200`；评论区尾部提供「加载更早评论」（`replies_offset/replies_limit` 分页追加）；`window.totals` 驱动计数展示（评论总数不因窗口变小）。
- `RetroScreen`：审计对全量 snapshot 的依赖，改为 `/runs/{id}`（摘要）+ `/analysis` + `/retro` + 必要时 `tail` 窗口——**复盘页不再拉全量 17.9MB**。
- replay 语义清理：左下"实时互动 n 条新评论"→"回放 · 共 n 条评论"；底部浮条不遮内容（预留底距或改内联）；回放模式不出现任何"实时"字样。
- 术语统一：用户可见"步"→"拍"（`500 步 · 微博客` → `500 拍 · 微博`）；平台显示名单一真源（skin registry `label`），全站不再散落"微博客/微博/weibo"混用。
- 断言：replay 首屏请求带 tail；「加载更早」追加不重复；retro 页网络层无 `/snapshot` 全量调用（msw 断言）；可见文案对 `步`/`实时` 在回放态零命中。

### T6 · launch 复盘页 `review:P13-T6`

- 抽取 `RetroScreen` 的分析主体为可复用组件 `RunAnalysisPanel({ runId })`（传播树/立场/影响力/情绪/趋势 tabs，数据自取），`RetroScreen` 改为薄壳组合——单平台复盘渲染结果零变化（快照回归）。
- 新增 `LaunchRetroScreen`：路由 `/world/:id/retro?launch=<launch_id>`。结构：顶部 launch 摘要（内容/平台/拍数/状态）→ 平台 tab（每 tab 内嵌 `RunAnalysisPanel(platform_run_id)`）→ 桥接摘要卡（bridge_inject 事件白话列表）→ 风味摘要卡（`/runs/{run_id}/flavor?world_id=` 聚合）。
- 入口：历史页多平台条目「看复盘」、多平台现场 done 态「看结果」。
- 断言：tab 切换加载对应 run 分析；单平台 RetroScreen 渲染回归；桥接空态诚实；心智词表检查。

### T7 · 加载体验 + 发起页收紧 `review:P13-T7`

- 骨架屏：`WorldOverviewScreen` / `HistoryScreen` / `IdentityScreen` 的加载态从白屏字符串改为结构骨架（世界层调性，token 色）。
- `ComposeScreen`：右栏按 T2 原型填充（成本预估卡上移 + 当前身份摘要）；提交 CTA 在 1440×1000 首屏可见（sticky 或布局收紧）；多平台提交中给进行态（按钮禁用 + 文案），成功即跳带 run_id 的现场（P12 后端立即返回，不存在长 pending）。
- 断言：三屏 loading 态渲染骨架而非纯文本；compose 提交中按钮禁用；多平台成功跳转 URL 含全部 run_id。

### T8 · 双色源真源收敛（可选，非阻塞） `review:P13-T8`

> 定性更正：T1–T7 审核初判"硬规则一回归"**不成立**——命中的 `text-slate-400/500/600`、`bg-slate-100` 等是 spec §7.2 硬规则一**明文豁免的中性排版灰**（原文点名 `text-slate-500` 不受限）。T8 只保留一个与硬规则一无关的**真源一致性**问题，严重度非阻塞，不作为 P13 放行前置。收敛提示词见 `HANDOFF-codex-P13-color-remediation.md`。

- **真问题·双色源漂移**：`tailwind.config.ts` 手抄了与 `tokens.ts` 不一致的 hex（`ink #0B1220` vs `#14140F`、`brand #F5B12F` vs `#E8A13A`、`cream/accent/line` 均漂移），导致 `bg-brand` 等语义类名实际呈现 config 值而非 token 值，`tokens.ts` 名义真源形同虚设。收敛：`tailwind.config.ts` 的 `colors` 改为从 `./src/design/tokens` import 取值，删手抄 hex，二者色值二选一收敛（以设计意图确认后的值为准，body 记录旧→新）。
- **可选规范化**：`text-slate-950`（用在 `bg-brand` 前景）→ `text-ink`，仅规范性，非必须。
- **不做**：不动 spec 已豁免的中性排版灰（`text-slate-*` 文字层级、`bg-slate-100`、`border-line`、`bg-white`），无需为其造 token。
- 断言：`tailwind.config.ts` 不再出现字面语义 hex（除从 tokens 引用）；tokens↔config 呈现色一致的快照/单测 pin；vitest/tsc 全绿，skins/x 与单平台 Retro 零回归。

## 3. Review Index

| 锚点 | 主题 | 主要文件 |
|---|---|---|
| P13-T1 | 显示名管线 + 裸 ID 禁令 | `world/run_bridge.py`, `pov/multiplatform.ts`, `skins/` |
| P13-T2 | 原型图 + 自审 | `docs/manual/assets/` |
| P13-T3 | 多平台现场改版 | `MultiPlatformLiveScreen.tsx`, `api/client.ts` |
| P13-T4 | 统一发起历史 + 热榜聚合 | `HistoryScreen.tsx`, `WorldOverviewScreen.tsx`, `GalleryScreen.tsx` |
| P13-T5 | 回放/复盘减重 + 语义清理 | `LiveScreen.tsx`, `RetroScreen.tsx` |
| P13-T6 | launch 复盘页 | `RetroScreen.tsx`, `LaunchRetroScreen.tsx`, `shell/routes.tsx` |
| P13-T7 | 骨架屏 + 发起页收紧 | `WorldOverviewScreen.tsx`, `HistoryScreen.tsx`, `IdentityScreen.tsx`, `ComposeScreen.tsx` |
| P13-T8 | 双色源真源收敛（可选，非阻塞） | `design/tokens.ts`, `tailwind.config.ts` |

## 4. 非目标

- 不做仿真内容同质化治理（Reddit 列三条近似评论是 LLM 生成层问题，复盘洞察已自证"内容同质化严重"；需真 key 大规模实证后单独立项，不准用展示层折叠去掩盖）。
- 不做 SSE/WebSocket 实时协议（游标轮询 + 终态已满足）。
- 不做虚拟列表库引入（tail 窗口 + 分页已控体量；实证不够再议）。
- 不改后端契约（有缺口回 P12 计划提修正案，不得前端绕过）。

## 5. 验收

```bash
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
cd frontend && npx vitest run && npx tsc -b
```

全绿后由用户按 manual 复走 e2e：多平台发起→现场（终态徽标）→launch 复盘；历史/世界总览入口全部带 run_id；replay 首屏轻量；全站无裸 ID、无"步"、无硬编语义色（审核者 grep 复查两条硬规则）。
