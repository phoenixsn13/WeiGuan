# 围观 — 整改意见（给 codex 逐项处理）

> 日期：2026-07-01　审核人：设计/审核者　执行人：codex
> 背景：Plan 1–5 + F0 已实现，锚点齐全，`pytest -m "not llm"` 34 passed、`vitest` 39 passed、`tsc -b` 通过。
> 但**审核发现两处未闭合**：①你最强调的"真实 LLM 打通"从未被真跑验证（4 个 `-m llm` 用例全程 skip，且运行依赖未装/未声明）；②一个 F0 老测试的 act 警告。
> **规则**：沿用 `docs/superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md` §1 的审核锚点；改实现时**保留原锚点**、提交带 `Review-Anchor:` trailer；**不许改弱测试来绕过**；真跑遇到与计划代码不符的真实 API 行为，**改实现让真链路跑通**（不是改断言）。逐项做完在本文件末尾"回填"区记录结果并粘贴命令输出。

---

## R1（阻断）声明并安装 OASIS/LLM 运行依赖

**问题**：`backend/pyproject.toml` 只声明了 `openai`，**没有声明 OASIS 真引擎依赖的 `camel-oasis`（camel-ai）**；且当前 venv 里 `openai` 未安装、`camel` 不可导入。导致真引擎与自定义人群/洞察三条 LLM 链路在本环境根本无法运行。

**动作**：
1. 在 `backend/pyproject.toml` 增加一个可选依赖组，把重依赖与核心分离（核心/非 LLM 测试仍免装）：
   ```toml
   [project.optional-dependencies]
   dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "httpx>=0.27,<0.28"]
   engine = ["camel-oasis"]   # OASIS 真引擎（含 camel-ai）；真跑 LLM 用例前安装
   ```
   > `openai` 保留在核心 `dependencies`（自定义人群/洞察都用它，属常规依赖）。
2. 安装（用户已同意提供 key 与放行安装）：
   ```bash
   /home/sunrise/.virtualenvs/my-oasis-backend/bin/pip install openai camel-oasis
   ```

**验证**：
```bash
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -c "import openai, camel; print('deps ok')"
```
**完成标准**：打印 `deps ok`。

---

## R2（阻断）真跑并通过 4 个 LLM 硬验收用例

**问题**：`pytest -m llm` 当前 **4 skipped**，"OASIS+LLM 真能产出内容"从未被证明。这是本批的硬要求。

**动作**：用真实 key 真跑（key 由用户提供，放进会话环境变量）：
```bash
cd backend && WEIGUAN_TEST_LLM_KEY=<用户提供的key> \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m llm -v
```
覆盖的四个用例（锚点不变）：
- `P2-T6-AC1` `test_real_run_produces_llm_content`
- `P2-T6-AC2` `test_real_interview_returns_nonempty`
- `P4-T3-AC1` `test_generates_valid_profile_csv`
- `P5-T2-AC1` `test_insights_returns_verdict_and_suggestions`

**真跑常见需就地修正的点（若报错，改实现、保留锚点）**：
- `ModelFactory.create` 是否接受 `api_key=` —— 不接受则走已写的 `except TypeError` 分支（环境变量），确认真的回退成功。
- `generate_twitter_agent_graph` 的 profile 列/参数是否与 `tiny_twitter_profile.csv` 匹配（真跑才会暴露）。
- INTERVIEW 结果解析：确认 `trace.info` 里确有 `response` 字段（真实 schema），否则调整 `oasis_engine.interview` 的解析键。
- `custom_profile`/`insights` 的 LLM 返回若非纯 JSON，确认清洗逻辑能兜住（已有 ```json 围栏处理）。

**完成标准**：该命令 **4 passed**（把完整输出粘到回填区）。若某用例因成本/额度需缩小规模，可减小真跑步数/人数，但**不得改成 mock、不得 skip**。

---

## R3（次要）修 `shell.test.tsx` 的 act() 警告

**问题**：Plan 4 把 `GalleryScreen` 从占位屏换成会 `fetchCrowds()` 的真组件，但 F0 老用例 `shell.test.tsx > "root route renders gallery placeholder"`（锚点 `PF0-T4-AC2`）未 mock fetch → 触发未包裹的异步 setState 警告，并发出一次真网络请求。

**动作**：在该测试文件的 `/` 场景为 fetch 打桩（保留锚点 `// review:PF0-T4-AC2`）：
```tsx
// 在渲染 "/" 前
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
// 测试后
// afterEach(() => vi.restoreAllMocks());
```
断言仍验证画廊标题（如 `选一个圈子`）存在即可。

**验证**：
```bash
cd frontend && npx vitest run src/shell/shell.test.tsx 2>&1 | grep -i "act(" || echo "no act warning"
```
**完成标准**：输出 `no act warning`，且 `npx vitest run` 仍全绿。

---

## 全量回归（三项做完后跑一遍）
```bash
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm" -q     # 期望全绿
cd backend && WEIGUAN_TEST_LLM_KEY=<key> .../python -m pytest -m llm -v                              # 期望 4 passed
cd frontend && npx vitest run                                                                        # 期望全绿
cd frontend && npx tsc -b                                                                            # 期望 exit 0
```
提交：每项一个 commit，带 `Review-Anchor:`（R1/R2 用 `P2-T6`/`P4-T3`/`P5-T2`；R3 用 `PF0-T4`）。

---

## 回填区（codex 执行后填写）

- [ ] **R1 依赖**：pyproject 增补 engine 组 + 安装成功。`import openai, camel` 结果：`____`
- [ ] **R2 真跑 LLM**：`pytest -m llm` 结果：`__ passed`。若改了实现，列出改动文件与原因：`____`
      粘贴命令输出：
      ```
      （在此粘贴 pytest -m llm -v 的尾部输出）
      ```
- [ ] **R3 act 警告**：修复后 `no act warning`，vitest 全绿：`____`
- [ ] **全量回归**：backend not-llm `__ passed` / llm `4 passed` / frontend `__ passed` / tsc `exit 0`

> 全部打勾并粘好 R2 输出后，交回设计/审核者做二次核验（`grep -rn "review:" ` 对照各计划审核索引表 + 复跑上述命令）。
