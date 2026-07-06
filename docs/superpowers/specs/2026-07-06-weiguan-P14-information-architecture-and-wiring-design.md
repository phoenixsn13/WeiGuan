# 围观 P14 · 信息架构与产品接线贯通（设计 spec）

版本日期：2026-07-06
设计者：审核/规划者（本人）。实现者：codex。
上游：[[2026-07-02-weiguan-world-identity-and-wishes-design]]（§4 身份、§7 视觉硬规则）、P12 读模型与发起生命周期、P13 连贯性与界面产品化。

## 0. 为什么有 P14

P6–P13 每一片都在**新增能力**（事件溯源、身份、多平台、读模型、界面产品化），但**没有任何一片专门负责把能力接成用户可达的端到端路径 + 统一沉淀契约**。结果是"按单点做、缺产品接线"，用户实测暴露：

- **找不到世界创建入口**：世界是三条发起路径的副产物，没有一等心智。
- **选新身份发起后世界没新增**：某些发起路径不 persist（见根因证据）。
- **找不到查看身份运行时信息的入口**：全站 `/identity/` 仅 `AppShell` 顶部"我"一处。

接线不是可选项，是标准计划的一部分。P14 是第一片专门做信息架构与接线，并把"接线验收"制度化。

### 根因证据（代码级）

1. **世界非一等、persist 语义三路分散**
   - `run_bridge.py:81` `persistent = bool(config.world_id or config.poster_person_id)`——单平台直接 `create_run` 且新身份（`poster_person_id=None`、`world_id=None`）→ `persistent=False` → **世界不留痕**。这是"世界没新增"在该路径的确切根因。
   - `routes.py:561` `create_person` → `create_world(persistent=True)`；`routes.py:428` `create_multi_run` → `create_world(persistent=True)`。三路三套 persist 逻辑。
2. **身份页几乎无入口**：全前端 `/identity/` 仅 `AppShell` 顶部"我"（依赖 `localStorage.saveCurrentIdentity`）。世界卡的 `primaryIdentityName`、历史条目作者、现场作者名均不可点进身份页。
3. **裸 ID 隐患**：`run_bridge.py:105` 新匿名身份 `display_name = "我" if poster_person_id is None else person_id`——`else` 分支把**裸 person_id（hex）**当显示名，违反 spec §7.2 硬规则二。

## 1. 锁定决策（brainstorming 已确认）

| 维度 | 决定 |
|---|---|
| 后端契约 | 允许**归一**：非破坏，只追加字段 / 新增只读接口（沿用 P12 铁律"只追加字段"）。 |
| 世界定位 | **一等对象**：显式创建 + 用户可读命名。 |
| 发起↔世界 | **发起页选世界上下文**：新建世界（可起名）/ 继续已有世界 → 选身份 → 发内容。 |
| 沉淀 | **发起即留痕**：一律 persist，删除脆弱推断，无"不保存"逃生口。 |
| 命名 | **可留空给兜底名**：留空按确定性规则生成，永不裸 hex。 |

## 2. 契约（P14 实现片的消费面，锁定）

### 2.1 World 模型追加字段（非破坏）

`World` 追加 `name: str | None = None`。旧数据 `name` 缺省为 None，读路径回落兜底名。事件日志/既有响应形状不变。

### 2.2 显示名解析（单一真源在后端）

新增纯函数 `resolve_world_name(world, *, latest_content, primary_identity_name) -> str`：
- `world.name` 非空 → 原样返回；
- 否则兜底：`{latest_content 前 12 字}` 优先；无内容则 `{primary_identity_name}的世界`（且 `primary_identity_name` 须先过裸 hex 校验，命中 `/[0-9a-f]{12,}/` 则跳过此级）；再无则 `围观世界·{created_at 日期}`。
- **保证**：返回值永不为空、永不为裸 hex（每级候选都过 `/[0-9a-f]{12,}/` 校验，命中即降级）。所有对外接口返回的世界名都是 resolve 后的可显示名。

### 2.3 `GET /api/worlds`（新只读接口）

```json
{
  "worlds": [
    {
      "world_id": "w_...",
      "name": "已解析的可显示名",
      "identity_count": 3,
      "total_influence": 128,
      "platform_count": 2,
      "run_count": 5,
      "latest": { "content": "...", "created_at": "...", "status": "done", "run_ids": ["..."], "launch_id": "..." },
      "created_at": "..."
    }
  ]
}
```
- 只含 `persistent` 世界；`created_at`（或 latest.created_at）降序。
- 世界总览改用此接口，不再靠 `/identities` 反推聚合。
- 无参数不触发 LLM，纯文件读，走 P12 线程池 `def`。

### 2.4 发起 persist 归一（语义契约）

- `ensure_world_for_run` 的 `persistent` 恒为 `True`；删除 `bool(config.world_id or config.poster_person_id)` 推断。
- 三路发起（`create_run` / `create_multi_run` / `create_person`）**统一"发起即 persist 世界 + 身份"**。
- 匿名新身份 `display_name` 不再落裸 person_id：无名时给确定性化名 `{persona 中文}·{account 尾4}`（复用 P13 硬规则二化名策略），`else person_id` 分支删除。

### 2.5 name 透传

`create_world` / `create_person` / `POST /api/multi-runs` / `POST /api/runs` 接受可选 `world_name`，仅在**新建世界**时写入；继续已有世界时忽略。空值不覆盖既有 name。

## 3. 设计分节

### 第 1 节 · 世界一等化
- 后端：§2.1 `name` 字段 + §2.2 resolve 函数 + §2.3 `GET /api/worlds`。
- 前端：`WorldOverviewScreen` 数据源换 `GET /api/worlds`；世界卡标题、现场标题、`LaunchRetroScreen` 标题一律用 `name`；**可见区对 `/w_[0-9a-f]{6,}/` 零命中**（呼应硬规则二，审核必查）。

### 第 2 节 · 发起即沉淀契约归一
- 后端：§2.4 persist 归一 + 匿名化名修裸 ID。
- 前端：`ComposeScreen` 新增"世界"选区——新建世界（可填名，留空兜底）/ 继续已有世界（列表来自 `GET /api/worlds`，搜索 + 窗口化，不无限铺开）→ 再走既有身份选择。
- 单平台 launch：P12 `/api/launches` 已 wrap 单平台记录，**后端不双写**，前端一致消费。

### 第 3 节 · 信息架构入口贯通
- **P14 第一实现产物 = 端到端入口审计清单**（落 `docs/manual`），目标态入口矩阵：

  | 从 | 到 | 入口 |
  |---|---|---|
  | 发起页 | 世界 | 世界选区（新建/继续） |
  | 世界总览 | 世界全景/管理 | 世界卡点击 |
  | 世界总览 / 历史 / 现场 | 身份页 | 身份名 / 作者名可点 → `/identity/` |
  | 现场 | 复盘 | 已有"看结果" |
  | 历史 | 现场/复盘 | 已有 |

- 身份页多入口：世界卡 `primaryIdentityName`、历史条目作者、现场作者名 → `/identity/{person_id}?world_id=...`。
- 世界详情入口：世界卡可点进全景 `/world/{id}/live`（不带 run_id = 全景语义，P13 已有）。

### 第 4 节（横切）· 标准计划模板升级
> 本节由**设计者（本人）**执行，不进 codex 实现片：改我的计划模板 + 记忆，属流程改进。
- 在计划模板（本人今后所有 `docs/superpowers/plans/*`）固定新增一节 **"端到端接线验收"**：每片必须列出它新增/触及的用户可达路径，并逐条验收入口连通、无死胡同、可见区无裸 ID。
- 写入 [[weiguan-project]] 记忆，作为规划标准。

## 4. 非目标（YAGNI）

- 世界**删除/归档**：发起即留痕会积累试验世界，短期靠世界总览"最新在前"排序承载；需要再单独立项。
- 不动仿真内容质量 / 分析能力 / SSE 协议 / 虚拟列表。
- 不改 P12 已锁定的既有响应形状（只追加 `name` 与新增 `/api/worlds`）。

## 5. 验收要点

- 后端：`pytest -m "not llm and not llm_effect"` 全绿；新增 `GET /api/worlds` 形状测试、persist 归一回归测试（任一路径发起后世界 `persistent=True` 且进 `/api/worlds`）、resolve_world_name 兜底测试、匿名化名不含裸 hex 测试。
- 前端：`vitest` + `tsc`；世界卡/现场/复盘可见区 `/w_[0-9a-f]{6,}/` 零命中；`ComposeScreen` 世界选区提交路径测试。
- e2e（用户代跑）：新身份发起 → `/worlds` 出现该世界（带名）；世界卡身份名可点进身份页；试验发起也留痕。

## 6. 分片建议

单片可覆盖（后端归一 + 前端接线体量适中），命名 **P14 · 信息架构与产品接线贯通**，Review-Anchor `P14-T{n}`。若实现时体量超预期，可拆"P14a 后端世界一等化 + persist 归一 / P14b 前端接线与入口贯通"，契约面（§2）不变。
