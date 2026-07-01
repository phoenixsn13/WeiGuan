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

## 五、回填区（已由审核者二次核验，2026-07-01）

- [x] **P2-T7 种子可见/降级**：采用**降级方案 = random Platform（`recsys_type="random"`, `max_rec_post_len/refresh_rec_post_count=500`, `following_post_count=5`）+ 每步创建后置顶 seed（`_pin_seed_to_rec`）+ 可见性硬校验（`_assert_seed_visible` 查 `rec` 表，seed 缺失即抛错）**。`oasis_engine.py` 已不再用 `DefaultPlatformType.TWITTER`（`oasis_engine.py:116-129`）。失败抛错单测 `P2-T7-AC1`（`test_run_raises_when_seed_visibility_check_fails`）通过。提交 `e40abc2` / `34613fc`。
- [x] **P2-T8 断言升级**：`retro.py` 新增 `seed_engaged_actor_ids`/`seed_interaction_count`（`retro.py:73/86`，复用 `compute_metrics` 口径）；`test_real_run_produces_llm_content` 已删 `later>=1`，改为 seed 断言（`replies>=1`、`seed_interaction_count>=2`、后续步含针对 seed 的互动 delta）。提交 `07faafb` / `03753ed`。链路级真跑（用户执行，DeepSeek）：
      ```
      5 passed, 48 deselected, 10 warnings
      test_insights_returns_verdict_and_suggestions PASSED
      test_generates_valid_profile_csv PASSED
      test_real_run_produces_llm_content PASSED
      test_real_interview_returns_nonempty PASSED
      test_real_interview_is_grounded_in_same_run PASSED
      ```
- [x] **P2-T8-AC1 效果验收**：20 agent，`engagement_rate=1.0`（19/19，不含 seed 作者）、`seed replies=51`、独立帖 actor 占比 `0%`，均超门槛（≥0.4 / ≥3 / ≤50%）。抽查 run.db：posts 16 / comments 63 / likes 77 / reposts 10；seed 口径 replies 51、likes 18、reposts 10；日志无 twhin 加载失败、无 `list index out of range`、无 Traceback。用户执行输出：
      ```
      1 passed, 54 deselected, 21 warnings in 151.97s
      ```
- [x] **P5-T6 追问接地**：`interview()` 不再调 `_make_env`、不删 run.db、不重建人群；改为基于 `snapshot`（seed 原文 + 该 actor 真实评论/动作 + persona）直连 LLM（`oasis_engine.py:204-267`）。路由层对未参与 seed 的 actor 返 404（`routes.py:138-139`）。AC1（`test_real_interview_is_grounded_in_same_run`，用户真跑 PASSED，断言答非空 + `_db_path` 不变 + run.db 仍可查）/AC2（`test_interview_rejects_actor_without_seed_engagement`，无 LLM，404）通过。提交 `f9c10e7`。
- [x] **回归**：backend not-llm/not-effect `49 passed, 6 deselected` / frontend vitest `39 tests passed`（14 文件）/ tsc `exit 0`。（附带 `c427d3d` 修复 insights schema 解析健壮性，`Review-Anchor: P5-T2`。）

> **审核结论：整改 2 全部闭合。** 二次核验方式：`grep -rn "review:P2-T7|review:P2-T8|review:P5-T6"` 对照本文件锚点（均命中）+ 逐条读实现代码 + 采信用户真跑输出（LLM key 测试不由审核者执行）。真 run.db 抽查证明产品核心体验成立：人群围绕 seed 产生 51 条评论、真实分歧、可追问具体反应者。

---

## 附录 A　种子可见性 —— 具体设计（P2-T7 照此实现）

**根因**：`oasis.make(DefaultPlatformType.TWITTER)` 在 `oasis/oasis/environment/env.py:76-85` 把 `recsys_type` 硬编成 `"twhin-bert"`，必须联网下载 `Twitter/twhin-bert-base`；下载/加载失败→推荐表坏→feed 空。

**改法**：`_make_env` 里**不再传 `DefaultPlatformType.TWITTER`**，改为自建 `Platform` 实例传进 `oasis.make(platform=<Platform 实例>)`（`env.py:103-112` 支持传 `Platform`）。构造参数（**双重保证 seed 可见、且零模型下载**）：

```python
from oasis.social_platform.platform import Platform
from oasis.social_platform.channel import Channel

channel = Channel()
platform = Platform(
    db_path=db_path,
    channel=channel,
    recsys_type="random",          # rec_sys_random：帖子数 ≤ max_rec_post_len 时“每人拿到全部帖子”，无需任何模型
    max_rec_post_len=500,          # 取够大：run 里总帖数 << 500，保证不裁剪掉 seed
    refresh_rec_post_count=500,    # refresh() 仅当 rec 列表长度 ≥ 此值才随机下采样；取大→不下采样→seed 必在 feed
    following_post_count=5,        # 兜底：非 Reddit 的 feed 永远并入“关注对象的帖子”(platform.py:280-304)
)
env = oasis.make(agent_graph=graph, platform=platform, database_path=db_path)
```

- **第一重保证**（random + 大 cap）：`recsys.py:154-157` 与 `platform.py:276` —— 帖子数不超过 cap 时人人拿到全部帖、且 refresh 不下采样，seed 恒在 feed。
- **第二重保证**（following 并入）：见附录 C，profile 里让每个人群 agent `following_agentid_list=[0]`（关注 seed 作者 agent0）。`platform.py:280-304` 会把关注者的帖子**无条件并进** feed。两重任一成立，seed 就可见。
- **失败要响**：若你仍保留任何走模型的分支，模型/推荐表构建异常必须**向上抛**、终止 run（当前是被平台 task 静默吞掉）。禁止“加载失败但继续产出独立帖”。
- **AC `P2-T7-AC1`（无需 LLM）**：构造一个会让推荐构建抛错的场景（如注入坏 recsys），断言 `run()` 抛异常而非静默产出帖子。

> 说明：`max_rec_post_len` 拉大会让每个 agent 的上下文含全部帖子，20 agent×6 步 ≤ ~140 帖，成本可接受；这正是“人人围观同一条”的产品语义。

---

## 附录 B　追问接地 —— 具体设计（P5-T6 照此实现）

**硬要求（三条，缺一不可）**：
1. **不毁档、不重建人群**：`interview()` 里**删除 `os.remove(run.db)` 这类操作**，绝不 `_make_env` 新签一批空记忆 agent。run 结束后 `run.db` 必须仍可查。
2. **接地到真实评论**：从传入的 `snapshot` 取该 `actor_id` 对 seed 的**真实评论文本/动作**与人设，拼进追问 prompt。
3. **受众门控**：`actor_id ∉ seed_engaged_actor_ids(snapshot)` → 路由层直接返回契约 §2.4 的 `404 {"error":"run or actor not found"}`，不落引擎现编。

**推荐实现（v1，简单且稳）—— 直连 LLM 生成，不再起 OASIS env**：
和 `analysis/insights.py`、`engine/custom_profile.py` 一样用 OpenAI 客户端直调，prompt 形如：
```
你是{该 actor 的 user_char/description 人设}。
你在一个社交平台上看到这条内容：{seed 帖原文}
你对它的公开反应是：{该 actor 对 seed 的评论原文 / 点赞·转发等动作}
现在有人追问你：{question}
请以第一人称、贴合上述人设与你已表达的立场作答，2-4 句。
```
—— 天然满足三条要求，不碰 run.db，无并发/长生命周期 env 负担。

**可选升级（保真度更高，非本轮必须）**：run 结束**不 close** env、`self._env` 留活，`interview()` 复用同一 live agent（其记忆已含 seed 与自身动作）调 OASIS `INTERVIEW`。代价是要管理 env 生命周期与清理，v1 不强制。

**AC**：
- `P5-T6-AC1`（`@pytest.mark.llm`）：run → 对一个**评论过 seed** 的 actor 追问，答非空；且断言追问后 `run.db` 仍存在、`compute_metrics(snapshot)` 仍可算（证明没毁档）。
- `P5-T6-AC2`（无 LLM）：对未参与 seed 的 `actor_id` 追问 → 路由返回 404。

---

## 附录 C　20-agent 效果 fixture 规格（P2-T8-AC1 用）

新增 `backend/tests/fixtures/small_twitter_profile.csv`，**列名与 `tiny_twitter_profile.csv` 完全一致**：
```
,user_id,name,username,following_agentid_list,previous_tweets,user_char,description
```
生成规则（codex 造 20 行）：
- 共 **20 行**，`index` 0–19，`user_id` 取 20 个互不相同的整数，`name=user_{i}`、`username=user{i}`。
- **`following_agentid_list`**：agent0（seed 作者）留 `[]`；**其余 19 行一律 `[0]`**（关注 seed 作者，激活附录 A 第二重可见性保证）。
- `previous_tweets` 一律 `[]`。
- `user_char` / `description`：给**多样但和话题相关**的人设，覆盖正/负/中立倾向，便于产生真实分歧。例如围绕“构建速度/工程效率”话题：
  - `0`：`Founder shipping a dev-tools startup; obsessed with build performance.`
  - `1`：`Skeptical senior SRE; has seen too many “too good to be true” benchmarks.`
  - `2`：`Junior dev, easily excited by shiny new tooling.`
  - …（其余 17 行照此风格铺开，正/负/中立大致均衡）
- 该 fixture **只服务 `@pytest.mark.llm_effect`**，非 LLM 回归不加载它。

> 造完后效果测试用它跑 20 agent；门槛见 §二·Q4：`engagement_rate>=0.4`、`seed replies>=3`、只发独立帖从不碰 seed 的 actor ≤ 50%。
