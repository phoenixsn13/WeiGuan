# 围观（Weiguan）

围观是一个“发布前评论区”工具：先把一段内容交给一组模拟受众看，让他们像真实微博用户一样评论、点赞、转发，再用回放和复盘看讨论如何发酵。

当前项目是本地优先的原型系统，后端使用 FastAPI、OASIS 与 OpenAI-compatible LLM，前端使用 React/Vite，把 OASIS 的推演结果包装成接近微博的信息流体验。

## 核心能力

- 选圈子：选择科技、饭圈、财经吐槽、育儿妈妈、硬核玩家等受众，也可以输入自定义受众描述。
- 发起围观：像发微博一样输入正文，选择 6、10、15 轮或 1-1000 轮自定义轮次。
- 第一人称评论区：以“我看到的”视角查看评论、转发、通知和实时进度。
- 历史回放：重启服务后仍可读取已保存的推演记录，只做数据库回放，不重新推演。
- 发酵复盘：从时间线、关键事件、数据趋势和讨论情绪看内容传播过程。
- 追问与建议：对真实参与过 seed 的 actor 追问，并基于推演结果生成发布建议。
- BYOK 与 `.env` 默认值：前端可传入临时 LLM 配置；不填时使用后端 `.env`。
- 成本安全：限制 OASIS 侧 LLM 并发、输出长度、上下文可见窗口和预算阈值，避免无界 token 消耗。

## 架构概览

```text
用户输入/受众/轮次
        |
        v
FastAPI 路由层
        |
        v
RoutingEngine / RunStore
        |
        v
OasisEngine  ->  OASIS SQLite(run.db)
        |
        v
Canonical Snapshot / Delta / Metrics
        |
        +--> SSE 实时流 -> React 第一人称评论区
        +--> Retro 复盘 -> 时间线、情绪、建议
        +--> Interview 追问 -> 同一次 run 的真实评论上下文
```

后端只把 OASIS 的输出转换成稳定的领域模型；前端只消费 run 状态和快照，不负责推进推演逻辑。

## 目录结构

```text
backend/
  weiguan/
    api/          FastAPI 路由、SSE、请求/响应模型
    engine/       OASIS 调用、上下文控制、run 生命周期
    adapter/      OASIS SQLite 到围观领域模型的适配
    canonical/    稳定快照、增量、指标口径
    analysis/     复盘、建议、LLM 客户端配置
  tests/          后端单元、API、LLM smoke 测试

frontend/
  src/
    api/          前端 API 客户端
    model/        前端领域类型和展示适配
    screens/      选圈子、直播、历史、复盘页面
    pov/          第一人称视角组件
    skins/        社交平台皮肤

docs/
  superpowers/
    specs/        产品与交互设计稿
    plans/        分阶段实现计划和契约
  manual/         手工验证、整改、成本分析和评审记录

oasis -> /home/sunrise/git-repository/oasis
```

## 环境要求

- Python 3.10。项目要求使用 `pyenv` 和 `virtualenvwrapper` 管理虚拟环境，不使用系统 Python。
- Node.js 与 npm。
- OASIS 相关依赖见 `backend/requirements-engine.txt`。
- OpenAI-compatible LLM 服务。DeepSeek、vLLM 等都可以，只要兼容 `/v1/chat/completions`。

## 安装

后端：

```bash
mkvirtualenv -p /home/sunrise/.pyenv/versions/3.10.20/bin/python my-oasis-backend
cd backend
pip install -e ".[dev]"
pip install -r requirements-engine.txt
```

如果虚拟环境已经存在，直接使用：

```bash
workon my-oasis-backend
cd backend
pip install -e ".[dev]"
pip install -r requirements-engine.txt
```

前端：

```bash
cd frontend
npm install
```

## 配置 `.env`

复制示例文件：

```bash
cd backend
cp .env.example .env
```

DeepSeek 示例：

```dotenv
WEIGUAN_LLM_KEY=sk-...
WEIGUAN_LLM_BASE_URL=https://api.deepseek.com
WEIGUAN_LLM_MODEL=deepseek-v4-pro
WEIGUAN_LLM_REASONING_EFFORT=
WEIGUAN_LLM_THINKING=

WEIGUAN_LLM_MAX_AGENTS=4
WEIGUAN_LLM_MAX_STEPS=
WEIGUAN_LLM_ERROR_THRESHOLD=1
WEIGUAN_LLM_MAX_RETRIES=0
WEIGUAN_LLM_MAX_TOKENS=256
WEIGUAN_LLM_COST_BUDGET_RMB=5

WEIGUAN_OASIS_MAX_REC_POST_LEN=10
WEIGUAN_OASIS_REFRESH_REC_POST_COUNT=5
WEIGUAN_OASIS_FOLLOWING_POST_COUNT=3
WEIGUAN_OASIS_LLM_SEMAPHORE=4
WEIGUAN_ATTENTION_COMMENT_BUDGET=12
```

本地 vLLM 示例：

```dotenv
WEIGUAN_LLM_KEY=EMPTY
WEIGUAN_LLM_BASE_URL=http://127.0.0.1:8001/v1
WEIGUAN_LLM_MODEL=zbnsec-default
WEIGUAN_LLM_REASONING_EFFORT=
WEIGUAN_LLM_THINKING=
```

说明：

- `WEIGUAN_LLM_BASE_URL` 对 vLLM 通常必须包含 `/v1`。
- `WEIGUAN_LLM_MAX_STEPS=` 留空表示不做硬性的轮次截断；成本控制仍由并发、上下文窗口、输出长度和预算熔断负责。
- 前端 BYOK 表单不填时，使用后端 `.env` 默认值。
- 不要提交真实 key。`backend/.env.deepseek`、`backend/.env` 这类本地密钥文件必须留在本机。

## 启动

后端：

```bash
cd backend
WEIGUAN_WORKDIR=/tmp/weiguan-e2e \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python \
  -m uvicorn weiguan.api.main:app --host 0.0.0.0 --port 8000
```

前端：

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 9000
```

浏览器访问：

```text
http://127.0.0.1:9000
```

如果从局域网访问，把 `127.0.0.1` 换成服务器 IP。

## 验证

非 LLM 后端回归：

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python \
  -m pytest -m "not llm and not llm_effect" -q
```

前端回归：

```bash
cd frontend
npx vitest run
npx tsc -b
```

LLM 连通性测试：

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python \
  -m pytest -m llm_connectivity -v
```

真实 LLM smoke 测试会消耗费用，只在明确需要时运行：

```bash
cd backend
WEIGUAN_TEST_LLM_KEY=<key> \
WEIGUAN_TEST_LLM_BASE_URL=https://api.deepseek.com \
WEIGUAN_TEST_LLM_MODEL=deepseek-v4-pro \
WEIGUAN_TEST_LLM_REASONING_EFFORT=high \
WEIGUAN_TEST_LLM_THINKING=enabled \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python \
  -m pytest -m "llm and not llm_effect" -v
```

效果测试更贵，默认不跑：

```bash
cd backend
WEIGUAN_TEST_LLM_KEY=<key> \
WEIGUAN_TEST_LLM_BASE_URL=<url> \
WEIGUAN_TEST_LLM_MODEL=<model> \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python \
  -m pytest -m llm_effect -v
```

## 成本安全原则

- 不在未确认 key、base URL、model、预算前运行 `llm` 或 `llm_effect` 测试。
- `WEIGUAN_OASIS_LLM_SEMAPHORE` 控制 OASIS 侧并发。
- `WEIGUAN_LLM_MAX_TOKENS` 控制单次输出上限。
- `WEIGUAN_ATTENTION_COMMENT_BUDGET` 控制每个 agent 可见评论窗口，避免把全量历史每轮都塞进 prompt。
- `WEIGUAN_LLM_COST_BUDGET_RMB` 是预算熔断阈值。
- 长轮次推演应依赖“固定窗口 + 相关评论 + 平台统计面板”的上下文策略，而不是累计式拼接全历史。

## 常见问题

模型不存在：

- 检查 `WEIGUAN_LLM_BASE_URL` 是否包含 `/v1`。
- 检查 `WEIGUAN_LLM_MODEL` 是否和服务端 `/models` 返回一致。
- 检查前端 BYOK 表单是否残留了旧 model。

模型只返回 reasoning、正文为空：

- 对 reasoning 模型，先把 `WEIGUAN_LLM_REASONING_EFFORT` 和 `WEIGUAN_LLM_THINKING` 留空。
- 或提高 `WEIGUAN_LLM_MAX_TOKENS`，避免 reasoning 把输出预算耗尽。

历史记录重启后丢失：

- 确认后端启动时 `WEIGUAN_WORKDIR` 指向稳定目录。
- 历史索引和每次 run 的 `run.db` 都保存在该目录下。

前端接口失败：

- 确认后端在 `8000` 端口运行。
- Vite 会把 `/api` 代理到 `http://127.0.0.1:8000`。

## 文档入口

- [文档导航](docs/README.md)
- [产品与交互设计](docs/superpowers/specs/2026-07-01-weiguan-design.md)
- [社交视角 UI 设计](docs/superpowers/specs/2026-07-01-weiguan-social-pov-ui-design.md)
- [契约与约定](docs/superpowers/plans/2026-07-01-weiguan-conventions-and-contracts.md)
- [成本安全设计](docs/manual/2026-07-01-weiguan-cost-safety-design.md)
- [上下文成本估算](docs/manual/assets/context-cost/context-cost-comparison.md)

## 开发约定

- 后端测试使用 `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python`。
- 修改行为前先写或更新测试；涉及 LLM 的测试默认交给用户带 key 执行。
- 保留既有 `# review:` 锚点，新能力按任务要求补新锚点。
- 不提交中间推演产物、真实 API key、`.env` 私密文件。
- 前端变更完成后运行 `npx vitest run` 和 `npx tsc -b`。
