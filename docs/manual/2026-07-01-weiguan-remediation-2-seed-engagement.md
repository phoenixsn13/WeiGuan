# 围观 — 整改意见 2：真围观有效性（种子互动 + 追问接地）

> 日期：2026-07-01　审核人：设计/审核者　执行人：codex
> 前置：整改 1（依赖声明 + 真跑 4 个 LLM 用例）已完成，`run_llm_smoke.sh` 4 passed。
> 本轮结论：**"能调用模型并产生内容"已证明，但"产品核心体验成立"未证明**。真 run 产出 14 条帖、0 评论、0 点赞/转发；后续 agent 各发各的，没围绕 seed；`interview()` 重建 env/db、和刚才那场围观无关。本文档把"有效围观"的验收标准**冻结成硬指标**，并给出带锚点的整改项。
>
> **规则**：沿用 `2026-07-01-weiguan-conventions-and-contracts.md` §1 锚点机制。改实现保留原锚点、新增能力用新锚点；commit 带 `Review-Anchor:` trailer；**不许改弱断言绕过**；真跑遇到与代码不符的真实行为，改实现不改断言。逐项做完在末尾"回填区"记录并粘命令输出。

---

## 一、审核结论（3 处已在代码层确认的缺陷）

| # | 缺陷 | 代码证据 | 后果 |
|---|------|----------|------|
| D1 | **种子帖对人群不可见** | `oasis_engine._make_env` 用 `oasis.make(platform=DefaultPlatformType.TWITTER)`；`env.py:76-85` 把 TWITTER 硬编成 `recsys_type="twhin-bert"`，需下载 `Twitter/twhin-bert-base`。该模型加载失败（`recsys.py:96` 抛 `Failed to load the model`），推荐表建不起来 → agent feed 空 → 看不到 seed → 只会自说自话发帖。`list index out of range` 是坏推荐矩阵的下游症状。 | 0 评论/互动；"围观"没发生。 |
| D2 | **真跑验收断言太弱** | `test_oasis_engine_llm.py:31` `later = replies + posts; assert later >= 1`。14 条独立帖 + 0 评论也能过。断言的是"有没有内容"，不是"有没有围观 seed"。 | 缺陷 D1 被绿灯掩盖。 |
| D3 | **追问不接地、且毁档** | `interview()` 调 `_make_env()` → `_make_env` 里 `os.remove(db_path)` **删掉刚跑完的 run.db**，再 `reset()` 新签一批**空记忆** agent，只做一次 INTERVIEW。被访者从没见过 seed、没发过那条评论，回答是凭 profile 现编；`snapshot` 入参完全没用上；run 历史被抹掉。 | 追问和"这场围观""这个人的这条反应"无关。 |

> 复用点：`weiguan/analysis/retro.py::compute_metrics(snapshot)` 已经给出**全部针对 seed 的计数** `totals={likes,dislikes,replies,reposts,quotes,reports}`。下面所有验收指标都基于它，**不要另写一套种子计数**。

---

## 二、验收标准冻结（回答用户六问，作为设计补充，权威）

### 定义（统一口径）
对某个 run 的最终 `snapshot`：
```python
t = compute_metrics(snapshot).totals
seed_comments      = t["replies"]
seed_interactions  = t["replies"] + t["likes"] + t["dislikes"] + t["reposts"] + t["quotes"] + t["reports"]
engaged_actors     = {评论/点赞/踩/转发/举报过 seed 的不同 actor_id}      # 需在 metrics 里加导出，见 P2-T8
crowd_size         = 参与 run 的 agent 数（不含 seed 作者 agent0）
engagement_rate    = len(engaged_actors) / crowd_size
```

### Q1 「有效围观」最低验收
- **必须有针对 seed 的评论**：`seed_comments >= 1`（这是"围观"的不可再降级内核——有人对**你这条**说话）。
- **必须有互动变化**：seed 的评论数必须从 step1 的 0 变为 >0；即 run 结束后 `seed_interactions >= 1` 且其中至少 1 条是评论。
- **允许 agent 独立发帖**：允许，真人群也会自说自话。但**不得压倒围观**——见效果级门槛（Q4）：只发独立帖、从不碰 seed 的 actor 占比 ≤ 50%。
- **点赞/转发/举报**：**不单独强制下限**（评论已是更强信号），但计入 `seed_interactions`。

### Q2 P2-T6 断言是否太弱 —— **是，必须改**
把 `assert later >= 1`（数任意帖）换成**针对 seed 的断言**：
- 链路级（3 agent smoke）：`seed_comments >= 1` **且** `seed_interactions >= 2`。
- 并断言"后续 delta 至少含一个针对 seed 的 `CREATE_COMMENT`/`LIKE_POST`/`REPOST`/`REPORT`"（证明互动是**流式**发生、不是初始态）。

### Q3 `twhin-bert-base` 加载失败怎么办 —— **决定：降级 + 失败要响**（非静默）
理由：twhin-bert 是重模型，CPU 上慢，50–150 agent 的"直播感"消费应用不该背它。因此：
- **不再用 `DefaultPlatformType.TWITTER`**（它强制 twhin-bert）。改为自建 `Platform(...)`，用**轻推荐**并**保证 seed 可见**。
- **降级行为定义**（二选一，实现者可选更稳的）：
  1. `recsys_type="twitter"`（`paraphrase-MiniLM-L6-v2`，轻）+ 让所有人群 agent **关注 seed 作者(agent0)**，靠 Twitter 推荐的 `following_post_count` 保证 seed 进 feed；或
  2. 显式**置顶 seed**：每步把 `seed_post_id` 注入每个 agent 的推荐列表。
- **失败要响**：推荐模型/推荐表若加载或构建失败，**必须抛异常终止 run**，不许静默继续产出"14 条独立帖"。禁止吞异常。
- **验收即证明**：Q1/Q2 的 seed 互动指标通过，就等于证明了 seed 可见——不需要单独查 feed。另加一条单测：模拟推荐加载失败时 run **抛错**而非静默返回。
- （若用户坚持"装 twhin-bert 走真推荐"，则改为**硬依赖**：声明+预下载模型，加载失败判真链路失败。默认采用降级方案。）

### Q4 agent 数 / 成本
- **保留 3-agent 作为"链路验收"**（`@pytest.mark.llm`，便宜、证明各动作路径接通），但断言升级为 Q2 的 seed 口径。
- **新增"效果验收"**：默认 **20 agent**（可 `WEIGUAN_EFFECT_AGENTS` 调，硬上限 50，不做 150——太贵），steps=6，单独 marker `@pytest.mark.llm_effect`，**默认不跑**，手动/夜间跑。
  - 门槛：`engagement_rate >= 0.4`、`seed_comments >= 3`、"只发独立帖从不碰 seed"的 actor ≤ 50%。
- **成本/耗时上限**：效果测试 LLM 调用数 ≤ `agents*(steps+1)` ≈ 140；DeepSeek 上墙钟目标 ≤ 5 分钟；超时/超额可减 steps，但**不得改 mock、不得降门槛**。

### Q5 INTERVIEW 产品语义（冻结）
- **必须基于同一次 run 的 env/db/snapshot**：追问复用刚跑完的那份 `run.db`/agent 记忆，**严禁重建、严禁删档**。
- **必须针对真的对 seed 有过反应的 actor**：只有 `engaged_actors` 里的人可被追问。
- **prompt 必须包含**：seed 帖原文 + 该 actor 对 seed 的评论/动作 + 该 actor 人设 + 用户的追问。
- **没有评论人时**：前端把追问入口置灰/提示"还没人评论，暂不能追问"；后端对未参与 actor 的追问按契约 §2.4 返回 **404 `run or actor not found`**，**不得现编答案**。

---

## 三、整改计划（带 Review-Anchor）

### 分类
- **设计补充（本文件 §二 即为权威）**：另需把 §二 摘要同步进 `specs/2026-07-01-weiguan-design.md`（新增"围观有效性验收"小节）与 `plans/plan-2`、`plan-5` 的 AC 表。锚点 `DS-围观-Effectiveness`。
- **Codex 实现未达标，需整改**：D1（种子可见性/降级）、D3（追问接地）。
- **测试新增/修改**：D2（断言升级）+ 效果测试 + 追问接地测试。

### P2-T7　种子可见 + 推荐降级 + 失败要响（改实现）
**文件**：`weiguan/engine/oasis_engine.py`
- 用自建 `Platform` 取代 `DefaultPlatformType.TWITTER`，按 §二·Q3 降级方案保证 seed 进每个 agent 的 feed。
- 推荐模型/推荐表构建失败 → 抛异常终止（不吞）。
- 保留 `# review:P2-T6`，新增能力打 `# review:P2-T7`。
- **AC**（`# review:P2-T7-AC1`，可无 LLM，用小 stub/单测）：模拟推荐加载失败时 `run()` 抛异常，不静默产出帖子。

### P2-T8　真跑验收升级到 seed 口径（改测试 + 小改 metrics）
**文件**：`weiguan/analysis/retro.py`（加导出）、`tests/engine/test_oasis_engine_llm.py`、`conftest`/`pyproject`（加 `llm_effect` marker）
- 在 `retro.py` 加纯函数 `seed_engaged_actor_ids(snapshot) -> set[int]` 与 `seed_interaction_count(snapshot) -> int`（复用 compute_metrics 口径）。锚点 `# review:P2-T8`。
- 改 `test_real_run_produces_llm_content`（`# review:P2-T6-AC1` 保留锚点，升级断言）：
  ```python
  from weiguan.analysis.retro import seed_interaction_count, compute_metrics
  snap = eng.last_snapshot
  assert compute_metrics(snap).totals["replies"] >= 1          # 有人评论了你这条
  assert seed_interaction_count(snap) >= 2
  # 后续步里至少一个针对 seed 的互动 delta（评论/赞/转发/举报）
  assert any(seed_interaction_count(d.snapshot) > 0 for d in deltas[1:])
  ```
- 新增 `test_real_run_effect`（`# review:P2-T8-AC1`，`@pytest.mark.llm_effect`，默认不跑）：20 agent，断言 `engagement_rate>=0.4`、`replies>=3`、独立帖 actor ≤ 50%。需要一个 ~20 行的 20-agent profile fixture（`tests/fixtures/small_twitter_profile.csv`）。

### P5-T6　追问接地到同一次 run（改实现 + 测试）
**文件**：`weiguan/engine/oasis_engine.py`、`weiguan/api/routes.py`、`tests/engine/test_oasis_engine_llm.py`、`tests/api/test_interview_snapshot.py`
- `interview()` **复用 run 的 env/db**（run 结束不 close 或可从同一 db 恢复 agent 记忆），**绝不 `os.remove` 刚跑完的 run.db**、绝不重建空 agent。锚点 `# review:P5-T6`。
- prompt 拼入：seed 原文 + 该 actor 对 seed 的评论/动作（从 snapshot 取）+ 人设 + 追问。
- 路由层：`actor_id ∉ seed_engaged_actor_ids(snapshot)` → 返回契约 §2.4 的 404，不落到引擎现编。
- **AC**：
  - `# review:P5-T6-AC1`（`@pytest.mark.llm`）：run→interview 一个**评论过 seed** 的 actor，答非空；且 interview 后 `run.db` 仍在、`snapshot` 仍可查（证明没毁档）。
  - `# review:P5-T6-AC2`（无 LLM，用 FakeEngine/路由层）：对未参与 actor 追问 → 404。

---

## 四、真实 LLM 验收命令与完成标准

```bash
cd backend
# 链路级（升级后的 4+ 个 llm 用例，含 seed 互动断言）
WEIGUAN_TEST_LLM_KEY=<key> WEIGUAN_TEST_LLM_BASE_URL=<deepseek_url> \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "llm and not llm_effect" -v
# 效果级（手动，成本较高）
WEIGUAN_TEST_LLM_KEY=<key> ... python -m pytest -m llm_effect -v
# 回归
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
cd ../frontend && npx vitest run && npx tsc -b
```

**完成标准**
- `pytest -m "llm and not llm_effect"` 全 passed，且 `test_real_run_produces_llm_content` 走的是升级后的 seed 断言（不是 `later>=1`）。
- `pytest -m llm_effect` 至少跑通一次，满足 §二·Q4 门槛（把输出粘回填区）。
- `interview` 接地测试 P5-T6-AC1/AC2 通过。
- 全部非 LLM 回归 + 前端 vitest/tsc 仍绿。
- 每项一个 commit，带 `Review-Anchor:`（P2-T7 / P2-T8 / P5-T6）。

---

## 五、回填区（codex 执行后填写）

- [ ] **P2-T7 种子可见/降级**：采用降级方案 ____（关注 seed 作者 / 置顶 seed）；推荐失败抛错单测 `P2-T7-AC1` 通过。改动文件与原因：`____`
- [ ] **P2-T8 断言升级**：`retro.py` 新增 `seed_engaged_actor_ids`/`seed_interaction_count`；`test_real_run_produces_llm_content` 升级为 seed 断言。链路级真跑输出：
      ```
      （粘 pytest -m "llm and not llm_effect" -v 尾部）
      ```
- [ ] **P2-T8-AC1 效果验收**：20 agent，`engagement_rate=__`、`replies=__`、独立帖 actor 占比 `__%`。输出：
      ```
      （粘 pytest -m llm_effect -v 尾部）
      ```
- [ ] **P5-T6 追问接地**：interview 复用同一 run.db、不毁档；AC1（有评论人，答非空且档在）/AC2（无参与 actor→404）通过。
- [ ] **回归**：not-llm `__ passed` / frontend vitest `__ passed` / tsc `exit 0`。

> 全绿并粘好真跑输出后交回设计/审核者做二次核验（`grep -rn "review:P2-T7\|review:P2-T8\|review:P5-T6"` 对照本文件 + 复跑上述命令 + 抽查一场真 run 的 run.db 确认 seed 有评论/互动）。
