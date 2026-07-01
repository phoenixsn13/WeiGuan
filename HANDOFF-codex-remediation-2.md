# 给 codex 的后续工作提示词（整改 2：真围观有效性）

> 直接把下面「提示词」整段发给 codex。你的角色不变：**实现者**，照设计执行、不改设计、不改弱断言绕过。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/manual/2026-07-01-weiguan-remediation-2-seed-engagement.md`（含附录 A/B/C）逐项整改「围观」的真 OASIS/LLM 链路。设计已定稿，**照做、不改设计、不改断言绕过**；每项 TDD（先写失败测试再实现），每个 Task 一个 commit 带 `Review-Anchor:` trailer，保留既有 `# review:` 锚点、新能力打新锚点。

背景问题（已在代码层确认，别再复查根因，直接修）：
- 真 run 产出 14 帖、0 评论/互动——因为 `oasis.make(DefaultPlatformType.TWITTER)` 强制 `recsys_type="twhin-bert"`，模型加载失败→feed 空→agent 看不到 seed。
- 真跑断言 `assert later >= 1` 太弱，数任意帖，掩盖了上面的问题。
- `interview()` 会 `os.remove(run.db)` 毁掉刚跑完的现场并重建空记忆 agent，追问和真实评论无关。

按顺序做这三个 Task：

**P2-T7　种子可见 + 推荐降级 + 失败要响**（`weiguan/engine/oasis_engine.py`）
- 照**附录 A**：`_make_env` 弃用 `DefaultPlatformType.TWITTER`，自建 `Platform(recsys_type="random", max_rec_post_len=500, refresh_rec_post_count=500, following_post_count=5)` 传入 `oasis.make(platform=<Platform>)`。目标：seed 恒在每个 agent 的 feed，且零模型下载。
- 推荐/模型构建异常必须向上抛、终止 run，禁止静默继续。
- `# review:P2-T7-AC1`（无需 LLM）：构造推荐构建失败场景，断言 `run()` 抛异常而非静默产出帖子。

**P2-T8　验收升级到 seed 口径**（`weiguan/analysis/retro.py` + `tests/engine/test_oasis_engine_llm.py` + marker）
- `retro.py` 加两个纯函数（复用 `compute_metrics` 口径）：`seed_engaged_actor_ids(snapshot)->set[int]`、`seed_interaction_count(snapshot)->int`。打 `# review:P2-T8`。
- 升级 `test_real_run_produces_llm_content`（**保留锚点 `# review:P2-T6-AC1`**）：断言 `compute_metrics(snap).totals["replies"]>=1`、`seed_interaction_count(snap)>=2`、且 `any(seed_interaction_count(d.snapshot)>0 for d in deltas[1:])`。删掉旧的 `later>=1`。
- 新增效果测试 `test_real_run_effect`（`# review:P2-T8-AC1`，新 marker `@pytest.mark.llm_effect`，默认不跑）：用**附录 C** 的 20-agent fixture，断言 `engagement_rate>=0.4`、`replies>=3`、只发独立帖从不碰 seed 的 actor ≤50%。在 `pyproject.toml` 注册 `llm_effect` marker。
- 造 `tests/fixtures/small_twitter_profile.csv`：列名同 `tiny_twitter_profile.csv`，20 行，agent0 `following_agentid_list=[]`，其余 19 行 `=[0]`，人设正/负/中立均衡（见附录 C）。

**P5-T6　追问接地到同一次 run**（`weiguan/engine/oasis_engine.py` + `weiguan/api/routes.py` + 测试）
- 照**附录 B**：`interview()` **不删 run.db、不重建人群**；推荐用直连 LLM 生成（同 `insights.py` 风格），prompt 拼入 seed 原文 + 该 actor 对 seed 的真实评论/动作 + 人设 + 追问。打 `# review:P5-T6`。
- 路由层：`actor_id ∉ seed_engaged_actor_ids(snapshot)` → 返回契约 §2.4 的 404，不落引擎。
- `# review:P5-T6-AC1`（`@pytest.mark.llm`）：run→对评论过 seed 的 actor 追问，答非空，且断言追问后 run.db 仍在、`compute_metrics` 仍可算。
- `# review:P5-T6-AC2`（无 LLM）：对未参与 actor 追问 → 404。

验收命令（key/base_url 用户提供）：
```bash
cd backend
WEIGUAN_TEST_LLM_KEY=<key> WEIGUAN_TEST_LLM_BASE_URL=<url> \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "llm and not llm_effect" -v   # 全 passed，含升级后的 seed 断言
WEIGUAN_TEST_LLM_KEY=<key> ... python -m pytest -m llm_effect -v                                     # 满足 Q4 门槛
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q  # 回归全绿
cd ../frontend && npx vitest run && npx tsc -b                                                        # 全绿 / exit 0
```

完成标准：三条真跑命令达标、非 LLM 回归+前端全绿；`test_real_run_produces_llm_content` 走的是 seed 断言而非 `later>=1`；每项一个 commit 带 `Review-Anchor:`。做完把每项结果与真跑输出粘进整改文档末尾「回填区」，交回审核者二次核验。

有卡点回 `docs/manual/2026-07-01-weiguan-remediation-2-seed-engagement.md` 对应附录；契约相关回 `docs/superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md`。不要靠猜。
