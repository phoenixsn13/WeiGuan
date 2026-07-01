# 围观 OASIS/LLM 成本问题排查笔记

日期：2026-07-01

这份文档记录排查过程中的事实、公式和中间判断。它保留了阶段性结论，供后续设计和复盘追溯。

## 触发问题

DeepSeek 控制台显示 `deepseek-v4-pro` 当日用量：

- API 请求次数：719
- 总 tokens：46,297,315
- 输入（命中缓存）：14,159,232
- 输入（未命中缓存）：31,824,521
- 输出：313,562

按 DeepSeek v4-pro 价格估算，主要成本来自未命中缓存输入 token。用户反馈当日约 97 元人民币消耗，与上述 token 规模基本对齐。因此问题不是“账单异常”，而是实际输入 token 规模异常。

## 当前 OASIS 调用链

OASIS `LLMAction()` 的核心路径：

```text
OasisEnv.step(actions)
  -> agent.perform_action_by_llm()
     -> agent.env.to_text_prompt()
        -> SocialAction.refresh()
           -> Platform.refresh()
              -> rec table 取推荐帖子
              -> following posts
              -> _add_comments_to_posts()
     -> ChatAgent.astep(user_msg)
```

每个 LLM 请求包含：

```text
system persona
+ CAMEL memory/context
+ tool schemas
+ "Please perform social media actions..."
+ env_prompt
```

其中 `env_prompt` 包含当前 refresh 返回的 posts，以及每个 post 的所有 comments。

## 关键发现

1. OASIS 的 post 可见数量有参数控制：
   - `max_rec_post_len`
   - `refresh_rec_post_count`
   - `following_post_count`

2. OASIS 的 comment 可见数量没有窗口参数。

3. 当 seed 被许多 agent 互动后，seed 下评论会在后续 refresh 中反复进入每个 agent 的 prompt。

4. 之前为了 seed 可见性设置了：

```text
max_rec_post_len=500
refresh_rec_post_count=500
following_post_count=5
```

这会把 agent 的局部视角扩大成接近全局 dump，是成本失控的主要实现原因之一。

## 原始成本公式

定义：

```text
A_t = 第 t 轮激活 LLM 的 agent 数
S   = LLM 轮数
Wp  = 每次可见 post 数，约 min(R, rec_size) + F
C_t = 每个可见 post 在 t 时刻累计 comment 数
B   = system persona + tool schema + 固定说明
M_t = memory/history 成本
Lp  = 单个 post token 成本
Lc  = 单个 comment token 成本
O_t = 输出/推理 token
```

单请求输入：

```text
I_t ~= B + M_t + Wp * Lp + Wp * C_t * Lc
```

总输入：

```text
Total ~= sum_t A_t * I_t
```

如果每轮新增评论与激活人数成正比：

```text
C_t ~= g * A * t
```

则评论项：

```text
sum_t A * Wp * g * A * t * Lc = O(A^2 * S^2)
```

这解释了为什么人数和轮次同时上升时，成本不是简单线性增长。

## 人类注意力假设

社交媒体用户不会读取上百楼中的每一楼，也不会把所有历史评论完整纳入思考。合理建模应区分：

- 业务层/平台层：保留全量历史，用于分析、追踪、报表、管理面板。
- agent 层：只获得该 agent 此刻合理会注意到的有限上下文。

因此成本控制不应是“压缩全量历史给 agent”，而应是“构造有限注意力视角”。

## 注意力预算算法草案

每个 agent 每轮看到：

```text
self_memory:
  自己之前表达过的立场/动作摘要

seed_post:
  原帖

discussion_panel:
  评论总数、立场分布、遗漏数量等确定性统计

visible_comments:
  direct/self context
  recent comments
  salient comments
  stance-diverse samples
```

评论选择打分：

```text
score =
  w_self   * is_by_actor
+ w_recent * created_at
+ w_social * log(1 + likes)
+ w_bucket * stance diversity
```

硬上限：

```text
comment_budget = 12
comment_chars = 160
```

处理后：

```text
Wc_t = min(comment_budget, useful_comments_t)
```

成本回到：

```text
Total <= A * S * fixed_context_size
```

## 离线 dry-run

已用历史 `/tmp/weiguan-e2e/runs/*/run.db` 离线重放，不调用 LLM。

产物：

- `docs/manual/assets/context-cost/context-cost-comparison.md`
- `docs/manual/assets/context-cost/context-cost-comparison.json`
- `docs/manual/assets/context-cost/context-cost-comparison.svg`

聚合结果：

```text
DeepSeek 实际总 tokens:      46,297,315
旧算法估算 tokens:           42,538,328
旧算法 vs 实际误差:          -8.12%
注意力预算估算 tokens:        1,338,304
估算减少:                    96.85%
```

## 待完善点

- 当前注意力算法是规则版，不依赖 LLM。
- stance 分类是关键词启发式，后续可替换为更稳的轻量分类器。
- 当前实现提供可复用 `AttentionContext` 和离线估算，并在 `OasisEngine.run()` 的 `env.reset()` 后为非 seed agent 安装 bounded `to_text_prompt()`。
- OASIS 参数已从 500/500 调整为预算化小窗口；真实 `LLMAction()` 路径会先 refresh OASIS 可见内容，再由业务层投影为有限注意力上下文。
