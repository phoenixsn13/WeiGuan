# 围观无效控件整改清单

日期：2026-07-02

## 背景

高保真 UI 后，页面出现了一批“看起来可点但没有行为”的控件。整改原则：

- 已有数据支撑的控件必须接成真实展示或状态切换。
- 暂无后端 mutation 或回放契约的控件不能假装可用，应禁用或降级为说明性 UI。
- 不新增 LLM 调用，不引入额外成本。
- 用户主界面继续避免 `agent`、`OASIS`、`仿真`、`工作台` 等高心智门槛词。

## 分类

### A. 纯前端未接线，本轮补齐

- Live 左侧：`我的视角`、`时间线`、`人物`、`热门`、`通知`
- XFeed tabs：`评论`、`转发`、`通知`
- 通知栏：`查看全部通知`
- Retro 筛选：`全部`、`正向`、`中立`、`负向`
- Retro 左侧：`发酵时间线`、`时间轴视图`、`关键事件`、`数据趋势`

整改方式：

- 加本地 selected state。
- 从已有 snapshot/metrics 派生 display model。
- 切换时展示真实数据，而不是固定 mock。

### B. 数据已有，但缺 display 函数，本轮补齐

- 转发列表：来自 `snapshot.posts` 中 `original_post_id === seed_post_id` 的 `repost/quote`。
- 通知列表：来自 `posterView(snapshot).notifications`。
- 人物列表：来自 `snapshot.actors`，结合 replies/reactions/posts/follows 统计参与情况。
- 热门列表：来自 seed replies 的 `num_likes` 和 seed 相关 reactions/reposts。
- 时间轴：来自 seed post、replies、reactions、reposts/follows 的 `created_at`。
- 关键事件：从高赞回复、转发、关注、举报/负向动作派生。
- 数据趋势：来自 `compute_metrics` 和 snapshot 数量，前端做轻量展示。

整改方式：

- 新增前端纯函数 display model，优先放在 `frontend/src/pov/`。
- 不新增后端接口，除非前端无法从 `/snapshot` 和 `/retro` 获取数据。

### C. 前后端都未做，本轮不伪装为可用

- 评论 `回复`
- 评论 `转发`
- 评论 `点赞`

原因：

- 当前后端没有用户写回评论区、手动转发或手动点赞的 mutation API。
- 如果直接前端改数字，会制造“保存了”的错觉。

整改方式：

- 改为禁用视觉或静态计数，不使用可点击 button。
- 后续需要设计 API：`POST /runs/{id}/comments`、`POST /runs/{id}/reactions`、`POST /runs/{id}/reposts`。

### D. 需要 step/delta 存储，本轮不伪装为可用

- 底部播放条：`回到开始`、`上一步`、`暂停`、`下一步`、`到结尾`

原因：

- 当前后端 SSE 消费后只保留最终 snapshot，不保留每一步 delta 序列。
- 历史回放无法真实 seek。

整改方式：

- 历史回放态改为禁用/说明性控件，只保留 `看结果`。
- 进行中态仍可以展示状态，但不承诺暂停/seek。
- 后续需要后端保存 `RunFrame[]` 或 `RunDelta[]`，提供 `GET /runs/{id}/frames`。

## 本轮完成标准

- 所有看起来可点的控件要么有实际行为，要么明确禁用。
- Live tabs 能切换评论、转发、通知。
- Live 左侧能切换视角/时间线/人物/热门/通知视图。
- Retro 能切换发酵时间线、时间轴视图、关键事件、数据趋势。
- Retro 情绪筛选能过滤或改变展示口径。
- `npm test` 和 `npx tsc -b` 通过。

## 回填区

### A. 纯前端未接线

已补齐：

- Live 左侧导航接入本地视图状态：`我的视角`、`时间线`、`人物`、`热门`、`通知`。
- XFeed tabs 接入同一视图状态：`评论`、`转发`、`通知`。
- 右侧 `查看全部通知` 切换到完整通知列表。
- Retro 左侧入口切换真实内容：`发酵时间线`、`时间轴视图`、`关键事件`、`数据趋势`。
- Retro 情绪筛选接入波次过滤：`全部`、`正向`、`中立`、`负向`。

### B. 数据已有但缺 display 函数

新增 `frontend/src/pov/social.ts`：

- `repostRows(snapshot)`：从 seed 相关 repost/quote 派生转发列表。
- `actorRows(snapshot)`：从评论、转发、点赞、关注统计参与人物。
- `hotRows(snapshot)`：从高赞评论和转发派生热门内容。
- `timelineRows(snapshot)`：从正文、评论、反应、转发、关注生成时间线。
- `keyEvents(snapshot)`：从热门内容生成关键事件。
- `trendRows(snapshot)`：生成评论、转发、点赞、人物趋势卡。

### C. 前后端都未做

评论行里的 `回复`、`转发`、`点赞` 保持静态展示，不伪造 mutation。后续若要可用，需要先补后端写接口和保存契约。

### D. 需要 step/delta 存储

底部播放条 `回到开始`、`上一步`、`暂停`、`下一步`、`到结尾` 已改为禁用态，并用 `title` 标明需要帧数据或流控接口。当前只保留 `看结果` 作为真实行为。

### 验证

```bash
cd frontend && npm test -- social
# 5 passed

cd frontend && npm test
# 16 files / 55 tests passed

cd frontend && npx tsc -b
# exit 0
```
