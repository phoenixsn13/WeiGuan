# 围观 OASIS/LLM 成本安全设计

日期：2026-07-01

## 目标

围观需要把 OASIS 作为社交仿真的基础设施使用，但不能把 OASIS quickstart 级的全量 observation 直接暴露到线上 LLM 调用中。单次普通真实 run 的默认硬预算为 5 元人民币。

本设计目标：

- 保留 OASIS 的 platform、DB、agent profile、action 和推荐机制。
- 修正 OASIS 调用参数，避免扩大 agent 视角。
- 在业务层建立固定上界的 agent 注意力上下文。
- 提供离线估算、报告和测试，能解释历史成本和预估未来成本。
- 默认不依赖真实 LLM 测试。

## 非目标

- 不在本阶段重写 OASIS。
- 不在本阶段实现 LLM 总结型压缩。
- 不在本阶段引入新 tokenizer 依赖；估算采用保守字符比例。
- 不把产品分析所需的全量历史塞进 agent prompt。

## 核心原则

### Agent 不是全知视角

人类用户不会阅读每一条历史评论。agent 每轮只应看到：

- 原帖；
- 与自己有关的评论；
- 少量最近/显著/多样化评论；
- 平台确定性统计面板；
- 自己历史立场摘要。

### 全量历史属于业务层

业务层和 OASIS DB 保留完整历史，用于：

- 传播路径；
- 互动统计；
- 追问资格；
- retro 分析；
- 管理面板；
- 成本审计。

### OASIS 参数代表社交平台可见性

`refresh_rec_post_count`、`max_rec_post_len`、`following_post_count` 是 agent 视角参数，不是产品分析参数。seed 可见性通过 rec pinning 解决，不通过扩大 refresh 窗口解决。

## 成本模型

旧模型：

```text
I_t ~= B + M_t + Wp * Lp + Wp * C_t * Lc
Total ~= sum_t A_t * I_t
```

当评论累计数 `C_t` 随激活人数和轮次增长时：

```text
Total_comment ~= O(A^2 * S^2)
```

新模型：

```text
I_t <= B + Mmax + seed_panel + Wcmax * Lcmax
Total <= A * S * Imax
```

其中：

```text
A = 实际激活 agent 数
S = LLM 决策轮数
Wcmax = attention_comment_budget
B = system/tool 固定开销
```

处理后历史评论总数只影响统计面板中的计数和候选选择，不直接线性进入 prompt。

## 默认参数

RunConfig 默认值：

```text
llm_cost_budget_rmb = 5.0
llm_max_agents = 8
llm_max_steps = 2
llm_max_retries = 0
llm_max_tokens = 512

oasis_max_rec_post_len = 10
oasis_refresh_rec_post_count = 5
oasis_following_post_count = 3
oasis_llm_semaphore = 4

attention_comment_budget = 12
```

`.env` 可覆盖：

```text
WEIGUAN_LLM_COST_BUDGET_RMB=5
WEIGUAN_OASIS_MAX_REC_POST_LEN=10
WEIGUAN_OASIS_REFRESH_REC_POST_COUNT=5
WEIGUAN_OASIS_FOLLOWING_POST_COUNT=3
WEIGUAN_OASIS_LLM_SEMAPHORE=4
WEIGUAN_ATTENTION_COMMENT_BUDGET=12
```

## 注意力上下文算法

模块：`weiguan.analysis.attention_context`

输入：

```text
posts: list[dict]
actor_id: int
AttentionContextConfig
```

输出：

```text
AttentionContext:
  self_memory
  seed_post
  discussion_panel
  visible_comments
```

选择顺序：

1. direct/self：actor 自己评论；
2. recent：最近评论；
3. salient：按点赞、时间、是否本人打分；
4. stance samples：question/skeptic/analysis/meme/other 分桶抽样；
5. 去重并截断到 `comment_budget`。

当前 stance 分类为关键词启发式，保持 LLM 无关和可测试。

## OASIS 调用策略

当前实现：

- `_make_env()` 使用自建 `Platform(recsys_type="random")`，避免 `DefaultPlatformType.TWITTER` 触发 twhin-bert 下载。
- 平台窗口从 500/500 收缩到配置化小窗口。
- `oasis.make()` 传入 `semaphore=config.oasis_llm_semaphore`。
- seed 通过 `_pin_seed_to_rec()` 写入 rec 表，保证可见性。
- `llm_max_agents` 和 `llm_max_steps` 仍作为第一层硬限制。
- `OasisEngine._install_attention_context()` 在 `env.reset()` 后为非 seed agent 替换 `agent.env.to_text_prompt()`，让真实 `LLMAction()` 使用有限注意力上下文，而不是 OASIS 默认全量 comments observation。

后续增强：

- 记录每次 response usage，按 run 聚合估算人民币成本。
- 达到软预算停止扩展新 agent，达到硬预算熔断。

## 离线估算与审计

模块：

- `weiguan.analysis.context_cost_estimator`
- `scripts/analyze_context_costs.py`

输入：

```text
/tmp/weiguan-e2e/runs/*/run.db
```

输出：

```text
docs/manual/assets/context-cost/context-cost-comparison.md
docs/manual/assets/context-cost/context-cost-comparison.json
docs/manual/assets/context-cost/context-cost-comparison.svg
```

历史结果：

```text
DeepSeek 实际总 tokens:      46,297,315
旧算法估算 tokens:           42,538,328
旧算法 vs 实际误差:          -8.12%
注意力预算估算 tokens:        1,338,304
估算减少:                    96.85%
```

## 测试策略

无 LLM 测试：

- `test_attention_context.py`：验证注意力预算固定 comment 数，并保留 self/recent/salient 信息。
- `test_context_cost_estimator.py`：验证查库估算、旧算法大于新算法、实际 usage 对比字段存在。
- `test_oasis_engine_config.py`：验证 OASIS 小窗口和 semaphore 被传入。
- `test_config.py`：验证成本安全默认值。
- `test_llm_defaults.py`：验证 `.env` 成本安全字段。

LLM 测试：

- 不自动运行；
- 用户提供 key 时执行；
- 后续需要采集 usage 并写入报告。

## 验收标准

- 非 LLM 回归测试通过。
- dry-run 报告可复现生成。
- OASIS 不再默认使用 500/500 feed 窗口。
- 单次默认真实 run 的保守估算落在 5 元人民币预算内。
- 后续真实 LLM run 必须能输出 usage 审计。

## 风险

- 当前 bounded `to_text_prompt()` 仍先调用 OASIS `refresh()` 获取完整可见 posts，因此 DB 查询和 trace 仍保留全量可见内容；只是 LLM prompt 不再使用全量 comments。
- 如果后续代码绕过 `OasisEngine.run()` 直接调用 OASIS agent，则不会自动安装注意力上下文。
- DeepSeek cache 命中率不可保证，预算应按全 miss 保守估算。
