# P15 发起会话收束验收文档

日期：2026-07-07

## 范围

P15 只处理发起会话的产品口径收束：`run` 保留为技术执行单元，`launch` 作为用户能看到的发起会话。任一发起路径都必须落真 Launch；历史、世界摘要、发起后跳转都以 Launch 为主入口。

## 核心结论

- 单平台 `POST /api/runs` 仍返回 `run_id`，并追加返回新铸造的 `launch_id`。
- 单平台 `launch_id` 使用 `launch_` 前缀，不再复用 `run_id`。
- `/api/launches` 只读取持久 Launch，不再读时把 `/api/runs` 合成为假 Launch。
- `/api/worlds` 的 `latest` 只来自 Launch。
- 启动期会幂等回填历史单 run 到 Launch；已被任意 Launch 覆盖的 run 不重复回填。
- 前端历史页只读 `/api/launches`，不再双读 `/api/runs`。
- 单平台发起后进入 `/world/{world_id}/live?launch={launch_id}`。
- 多平台发起后进入 `/world/{world_id}/live?launch={launch_id}&run_id=...&run_id=...`。

## 审核路径

| 路径 | 验收点 | 预期 |
| --- | --- | --- |
| 单平台发起 | `POST /api/runs` | 返回 `run_id` 和 `launch_id`，`launch_id` 形如 `launch_xxx` |
| 单平台历史 | `GET /api/launches` | 能找到该 `launch_id`；`run_id` 不作为 `launch_id` 出现；`kind=single` |
| 多平台发起 | `POST /api/multi-runs` | 返回 `world_id`、`run_ids`、`launch_id` |
| 多平台现场 | 前端跳转 | URL 同时携带 `launch` 和各平台 `run_id` |
| 历史页 | `/history` | 只调用 `/api/launches` 和 `/api/worlds/{id}/persons`，不调用 `/api/runs` |
| 世界页 | `/api/worlds` | `latest.launch_id` 来自持久 Launch |

## 自动化覆盖

| Task | 测试锚点 | 覆盖内容 |
| --- | --- | --- |
| P15-T1 | `# review:P15-T1` | 单平台发起补建持久 Launch |
| P15-T2 | `# review:P15-T2` | `/api/launches` 单源读；单/多 `kind` 正确；退役 run 合成 |
| P15-T3 | `# review:P15-T3` | 启动期幂等回填历史单 run |
| P15-T4 | `# review:P15-T4` | History 页只读 Launch |
| P15-T5 | `# review:P15-T5` | 多平台跳转携带 Launch |

## 关键代码锚点

- `backend/weiguan/api/routes.py`：`create_run` 补建 Launch、`list_launches` 单源读取、`_multi_launch_summary` 推导 `kind`。
- `backend/weiguan/world/backfill.py`：启动期历史单 run 回填。
- `frontend/src/api/client.ts`：`fetchLaunches` 不再兼容 run 数组；`createRun/createMultiRun` 类型要求 `launch_id`。
- `frontend/src/screens/HistoryScreen.tsx`：历史页只消费 Launch。
- `frontend/src/screens/ComposeScreen.tsx`：发起后跳转携带 `launch`。

## 审核命令

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q

cd ../frontend
npx vitest run
npx tsc -b

cd ../backend
rg -n "_single_launch_summary" weiguan/

cd ../frontend
rg -n "fetchRuns" src/screens/HistoryScreen.tsx
```

`rg` 两条命令预期都是零命中；`rg` 因零命中返回 exit code 1 属正常。

## 设计者复核重点

1. 不再把 `run_id` 当作产品会话 ID 暴露给历史页。
2. 历史页和世界页的会话来源一致，不存在 run 与 launch 两套列表互相补洞。
3. 单平台和多平台用户路径都能回到同一个 `launch`。
4. 旧文档中 `launch_id == run_id`、历史页读 `/api/runs` 的描述已过时，应以后续完整 manual 为准。

