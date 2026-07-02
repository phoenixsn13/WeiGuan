# 给设计者的当前现状交接（围观）

日期：2026-07-02

目的：这份交接给下一轮设计/规划使用。它不是新的实现计划，而是把最初交接给 codex 的认知、`docs/superpowers` 设计/计划体系、`docs/manual` 整改与手测记录、以及最近实际实现状态合并成一个可继续规划的基线。

## 一、设计者应先读的真源

按这个顺序读：

1. `README.md`：当前项目怎么启动、怎么配置 `.env`、怎么验证。
2. `docs/README.md`：文档体系导航。
3. `HANDOFF-codex.md`：最初交给实现者的角色约束、执行顺序和铁律。
4. `docs/superpowers/specs/2026-07-01-weiguan-design.md`：最初产品设计真源。
5. `docs/superpowers/specs/2026-07-01-weiguan-social-pov-ui-design.md`：后续 UI/UX 纠偏后的社交视角设计真源。
6. `docs/superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md`：契约、锚点、跨层边界。
7. `docs/manual/2026-07-01-weiguan-remediation-2-seed-engagement.md`：真 OASIS/LLM 链路有效性的关键整改。
8. `docs/manual/2026-07-01-weiguan-cost-safety-design.md`：成本安全与上下文算法。
9. `docs/manual/2026-07-02-weiguan-inert-controls-remediation.md`：无效控件整改和后续需要补契约的控件。
10. `docs/manual/2026-07-01-weiguan-social-pov-ui-review.md`：UI 高保真整改、截图资产和自审结论。

## 二、最初认知与后来修正

最初 `HANDOFF-codex.md` 的核心认知是：

- 设计与计划已定稿，实现者照计划执行。
- 架构按 `Engine -> Adapter -> Canonical -> POV -> Skin` 分层。
- 用户前台体验应该是“熟悉社交 App 的第一人称体验”，不是仿真工作台。
- 真实 LLM 必须打通，不能用 skip 或 mock 假装完成。
- 每个任务要保留 review anchor，方便设计者审计。

后续实际推进中，发现并修正了几类原计划没覆盖够的问题：

- 真 OASIS run 一开始只是“能发内容”，但不是“围观成立”。有效围观现在已改为 seed 口径：必须有人围绕用户原帖评论/互动。
- `DefaultPlatformType.TWITTER` 会触发 twhin-bert 模型下载，失败后 seed 不可见。现在已改为自建 random `Platform` + seed pinning + 可见性硬校验。
- `interview()` 原来会重建环境并删除现场，现在已改为基于同一次 run 的 snapshot、真实评论/动作和人设直连 LLM。
- OASIS 默认 observation/prompt 成本会随轮次和评论历史膨胀，已增加固定上界的 attention context，不再把全量历史都给每个 agent。
- 历史回放不能重新发起推演；当前 Live 的 `?replay=1` 是只读 snapshot。
- UI 从后端调试页式表达，逐步改回“微博/社交内容页”风格，但仍有一些视角和复盘逻辑需要设计者二次定稿。

## 三、当前已经实现的能力

### 后端

- FastAPI 应用入口：`backend/weiguan/api/main.py` / `create_app()`。
- Run 生命周期：`RunStore` 持久化 run summary、snapshot、config、insights。
- 历史接口：`GET /api/runs`、`GET /api/runs/{id}`、`GET /api/runs/{id}/snapshot`。
- SSE：`GET /api/runs/{id}/events`。后续已修正为 run 执行逻辑和 view consumer 分离，避免第二个 Live 页面重复触发推演。
- OASIS 引擎：`OasisEngine` 使用自建 random `Platform`，seed pin 到推荐表，推荐失败要响。
- LLM 配置：
  - 支持 `.env` 默认值；
  - 前端 BYOK header 可以覆盖；
  - 支持 OpenAI-compatible endpoint；
  - vLLM 需要 base URL 带 `/v1`。
- 成本安全：
  - `llm_max_agents`
  - `llm_max_steps`（留空表示不做硬截断）
  - `oasis_llm_semaphore`
  - `attention_comment_budget`
  - `llm_max_tokens`
  - `llm_cost_budget_rmb`
- 注意力上下文：`weiguan.analysis.attention_context`，按 self/recent/salient/stance sample 选固定数量评论。
- 成本 dry-run：`weiguan.analysis.context_cost_estimator` 与 `scripts/analyze_context_costs.py`，文档输出在 `docs/manual/assets/context-cost/`。
- Retro 指标：`compute_metrics`、`seed_engaged_actor_ids`、`seed_interaction_count`。
- Insights：
  - `POST /api/runs/{id}/insights` 生成建议；
  - `GET /api/runs/{id}/insights` 读取已保存建议；
  - 建议已持久化，刷新不丢。
- Interview：
  - 只能追问参与过 seed 的 actor；
  - 未参与 actor 返回 404；
  - 追问基于同一次 run 的 seed 原文、真实评论/动作和人设。

### 前端

- 页面：
  - 选圈子/发起页；
  - 历史记录页；
  - Live 评论区；
  - Retro 回放页。
- 历史记录：
  - 重启服务后，只要 `WEIGUAN_WORKDIR` 稳定，历史可以从后端持久化读取；
  - `看评论区` 进入 `/run/:id/live?replay=1`，不会重新推演；
  - `看回放` 进入 `/run/:id/retro`。
- Live：
  - 当前主视角是“我看到的”；
  - seed 帖固定在上方；
  - 评论区内部滚动；
  - 右侧通知摘要；
  - 评论按新到旧展示；
  - 时间显示已从“一律刚刚”改为根据 `created_at` 做相对时间；
  - 底部控制条已移除不真实的 seek/pause 控件，只保留真实状态和 `看结果`。
- Replay：
  - replay 模式只读 snapshot；
  - 不打开 SSE，不触发 run。
- Retro：
  - 从“调试指标页”改为“围观回放 / 发酵时间线”；
  - 左侧是发布内容和回放信息；
  - 中间是波次/时间线/关键事件/数据趋势；
  - 右侧是创作者流量洞察、情绪条、风险提醒和建议；
  - 建议可重新生成，并会持久化。
- Display model：
  - `frontend/src/pov/social.ts` 派生转发、人物、热门、时间轴、关键事件、趋势。
- UI/UX：
  - 已按 `frontend-app-builder` 高保真方向整改过；
  - 文案避免 `agent/OASIS/仿真/工作台` 等高心智门槛词；
  - 用户看到的是社交平台表达，不是研究工具表达。

## 四、当前验证基线

已知最近的验证状态：

- 文档中文化提交：`6368e73 docs: 中文化文档体系并补充 README`。
- Retro 情绪分类一致性提交：`314861a fix(retro): classify wave sentiment consistently`。
- 近期 UI / run / cost 相关提交包括：
  - `7073178 fix(ui): align live feed chronology`
  - `a5144ef fix(run): decouple execution from live views`
  - `e6f141f fix(run): prevent duplicate event streams`
  - `c96c530 fix(live): hydrate run before stream deltas`
  - `6576b8b fix(engine): rotate budgeted llm actors`
  - `e747dea feat(ui): add custom rounds and trend rail`
  - `fbed118 fix(social): prevent internal mention leakage`

最近一次明确通过的前端验证：

```bash
cd frontend
npx vitest run
npx tsc -b
```

最近一次明确通过的文档校验：

```bash
git diff --check
```

真实 LLM 测试成本高，设计者审核时不要自行执行。需要 LLM key 的测试，以用户代跑结果为准，或明确让用户执行。

## 五、当前产品表现与已知问题

### 1. 有效围观已成立，但大轮次质量仍需要产品规则

500 轮自有算力 run 可以跑完，但观察到过：

- 同一 actor 多次重复评论；
- 某些主题下观点表达容易同质化；
- 评论数量和轮次之间不是“一轮一条评论”的线性关系；
- 长轮次界面能展示，但“500 轮的产品意义”还没有被设计成用户可理解的阶段叙事。

这不是简单 UI bug，下一轮设计需要定义：

- 长轮次到底代表什么：时间流逝、传播层级、重复曝光、还是平台推荐周期？
- 用户为什么要选 100/500/1000 轮？
- 长轮次结果应该怎么压缩成可消费信息，而不是让用户读 500 次刷新。

### 2. Retro 情绪 tabs 的产品意图刚刚被纠偏

之前出现过“负向/正向/中立筛选逻辑混乱”的问题。最新处理原则：

- 情绪 tabs 不是强行让某一类有数据；
- 每个波次根据该阶段评论内容判断主导情绪；
- `正向/中立/负向` tab 展示该情绪占上风的阶段；
- 没有符合条件的阶段就显示空态。

设计者下一步需要确认这个产品意图是否成立。若不成立，应重定义 tabs：

- 是按“阶段主导情绪”筛？
- 还是按“单条评论情绪”筛？
- 还是应该取消情绪 tabs，改为情绪解释卡？

### 3. Actor 视角仍是占位级别

`docs/superpowers/specs/2026-07-01-weiguan-social-pov-ui-design.md` 提到 `TA 看到的`，但当前实现仍主要是 UI 状态和高亮，尚未实现真正的：

- `actorView(snapshot, actorId)`；
- “TA 合理可能看到什么”的可见内容裁剪；
- 从 TA 视角进入评论区/通知/历史的完整体验。

这需要下一轮设计明确算法与交互：

- TA 视角是否只能看 TA 参与过的主题？
- 是否显示 TA 自己历史动作？
- 是否显示平台推荐给 TA 的少量公开内容？
- 是否能继续追问，追问如何与视角切换区分？

### 4. 底部播放/回放控制仍缺后端帧契约

当前已去掉或禁用了不可用的 seek/pause 控件。真实支持“回到开始 / 上一步 / 下一步 / 到结尾”需要后端保存帧：

- `RunFrame[]` 或 `RunDelta[]`；
- `GET /api/runs/{id}/frames`；
- Live 与 Replay 都消费帧，不重跑引擎。

这属于产品与契约共同设计，不应只在前端补按钮。

### 5. 用户主动参与评论区尚未设计

当前评论行的 `回复/转发/点赞` 是静态展示，不伪造 mutation。要做成可点，需要新契约：

- `POST /api/runs/{id}/comments`
- `POST /api/runs/{id}/reactions`
- `POST /api/runs/{id}/reposts`

同时要定义：用户在推演过程中插话，会不会影响后续 OASIS agent？这是核心产品决策。

### 6. 社交平台皮肤机制还没真正多平台化

设计真源提过不同平台皮肤，但当前基本是微博客风格。后续需要规划：

- 微博皮肤和 X 皮肤是否拆开；
- Reddit/论坛皮肤是否进入下一阶段；
- 皮肤与 OASIS platform 的约束关系；
- 不同皮肤是否共享同一 `posterView`。

### 7. 圈子和 persona 仍偏 demo 数据

已经修过 `user0/user1`、内部 `@0/@1` 泄漏、财/港/研等前缀显示问题，但 persona 体系仍需要产品设计：

- 圈子名称、话术、用户名风格要更像真实社交媒体；
- 是否允许用户自定义圈子；
- 自定义圈子生成后是否保存；
- profile 数据是否需要可视化预览。

### 8. 成本安全已有底座，但还缺用户可见解释

现在后端有预算和上下文上界，但前端对“为什么默认这么多人/这么多轮/会花多少钱”的解释还不充分。下一轮设计应决定：

- 是否在发起页展示成本预估；
- 自有算力和付费 API 的不同提示；
- 大轮次时如何提示性能/耗时/历史体积；
- 预算熔断发生时前端怎么解释。

## 六、设计者下一轮建议优先级

建议不要直接继续“美化页面”，先补产品语义和契约。

### P0：长轮次与回放帧设计

原因：用户已经在跑 500 轮；没有清晰的“轮次语义 + 帧存储 + 回放交互”，大轮次会持续表现为进度数字和评论列表的堆叠。

需要产出：

- 轮次语义；
- 阶段聚合规则；
- `RunFrame` / `RunDelta` 契约；
- Live/Replay/Retro 如何共同消费帧；
- 大轮次 UI 如何摘要、采样和跳转。

### P1：Retro 信息架构重定稿

原因：当前 Retro 已经从调试页变成回放页，但情绪 tabs、波次、风险提醒、建议、趋势之间的产品意图仍不够自洽。

需要产出：

- 情绪筛选的业务含义；
- 波次如何从真实数据生成；
- 代表评论怎么选；
- 风险提醒和建议的展示/持久化/重新生成机制；
- 空态与异常态。

### P2：TA 视角与追问的关系

原因：这是最初设计里很有辨识度的能力，但当前只是第一批 UI 状态。

需要产出：

- `actorView` 的可见性算法；
- TA 视角页结构；
- 与追问抽屉的交互关系；
- 哪些 actor 可点、哪些只展示。

### P3：用户主动参与评论区

原因：如果“围观”要从观察工具变成互动预演工具，用户插话、回复、补充澄清是自然需求。但它会改变后续推演输入。

需要产出：

- 用户插话是否进入 OASIS 后续 context；
- mutation API；
- UI 中如何区分用户原帖、用户补充、模拟人评论；
- 历史回放如何保存这些动作。

### P4：圈子/persona 产品化

原因：当前圈子足够 demo，但离“用户能信任这群人像真实受众”还有距离。

需要产出：

- 预设圈子策略；
- 自定义圈子的保存、预览、编辑；
- 用户名/头像/人设规范；
- 多平台皮肤下 persona 如何适配。

## 七、给设计者的审核提醒

- 不要把 UI 拉回“仿真工作台/仪表盘/agent 管理台”。用户前台语言继续保持社交媒体心智。
- 不要只看静态页面截图。必须区分：
  - 正在推演；
  - 历史回放；
  - 复盘；
  - 重新生成建议；
  - 多浏览器同时观看同一 run。
- 不要要求实现者用真实 LLM key 自己跑昂贵测试。LLM 测试由用户代跑，设计者采信输出或明确让用户执行。
- 不要用“全量历史都给 agent”解决质量问题。成本安全设计已经明确：全量历史归业务层，agent 只能看有限注意力上下文。
- 不要用前端假数据补产品逻辑。历史、Retro、通知、热门、人物都应该从 snapshot/metrics/frames 派生。

## 八、当前工作区状态

本交接写入时，工作区只应保留本地密钥文件未跟踪：

```text
backend/.env.deepseek
```

不要提交该文件。

