import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { createRun, previewCost, type PersonaKind, type PreviewCost } from "../api/client";
import { saveCurrentIdentity, useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";

const ROUNDS = [
  { value: 6, label: "快速围观", hint: "看第一波反应" },
  { value: 10, label: "标准", hint: "适合多数内容" },
  { value: 15, label: "深度发酵", hint: "观察讨论分化" },
];

const MAX_CUSTOM_STEPS = 1000;
const DEFAULT_MEMORY_BUDGET = 4;
const DEFAULT_VISIBLE_PEOPLE = 8;
const DEFAULT_COMMENT_BUDGET = 12;

const PERSONAS: Array<{
  value: PersonaKind;
  label: string;
  hint: string;
  standing: string;
}> = [
  { value: "ordinary", label: "普通人", hint: "普通网友视角", standing: "约 20 粉丝" },
  { value: "verified", label: "大V", hint: "自带基础扩散", standing: "约 2,000 粉丝" },
  { value: "kol", label: "KOL", hint: "头部意见领袖", standing: "约 50,000 粉丝" },
];

function clampSteps(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(MAX_CUSTOM_STEPS, Math.round(value)));
}

// review:P4-T6
export default function ComposeScreen() {
  const audience =
    (useLocation().state as { audience?: { crowd_id?: string; custom?: string } } | null)
      ?.audience ?? { crowd_id: "tech_devs" };
  const {
    key,
    model,
    baseUrl,
    reasoningEffort,
    thinking,
    setKey,
    setModel,
    setBaseUrl,
    setReasoningEffort,
    setThinking,
  } = useApiKey();
  const [content, setContent] = useState("");
  const [steps, setSteps] = useState(10);
  const [customSteps, setCustomSteps] = useState(30);
  const [customMode, setCustomMode] = useState(false);
  const [posterPersona, setPosterPersona] = useState<PersonaKind>("ordinary");
  const [identityMode, setIdentityMode] = useState<"new" | "continue">("new");
  const [posterPersonId, setPosterPersonId] = useState("");
  const [cost, setCost] = useState<PreviewCost | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const selectedSteps = customMode ? clampSteps(customSteps) : steps;

  useEffect(() => {
    let active = true;
    previewCost({
      steps: selectedSteps,
      llm_max_agents: DEFAULT_VISIBLE_PEOPLE,
      attention_comment_budget: DEFAULT_COMMENT_BUDGET,
      person_memory_budget: DEFAULT_MEMORY_BUDGET,
    })
      .then((nextCost) => {
        if (
          active &&
          typeof nextCost.estimated_rmb === "number" &&
          typeof nextCost.budgeted_agents === "number" &&
          typeof nextCost.decision_steps === "number"
        ) {
          setCost(nextCost);
        }
      })
      .catch(() => {
        if (active) setCost(null);
      });
    return () => {
      active = false;
    };
  }, [selectedSteps]);

  async function startRun() {
    setError("");
    try {
      const continuingPersonId =
        identityMode === "continue" ? posterPersonId.trim() : "";
      const { run_id } = await createRun(
        {
          audience,
          content,
          steps: selectedSteps,
          platform: "twitter",
          poster_persona: posterPersona,
          poster_person_id: continuingPersonId || undefined,
          person_memory_budget: DEFAULT_MEMORY_BUDGET,
        },
        { key, model, baseUrl, reasoningEffort, thinking },
      );
      if (continuingPersonId) {
        saveCurrentIdentity(continuingPersonId, localStorage.getItem("wg_current_world_id") ?? "");
      }
      navigate(`/run/${run_id}/live`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-card border border-line bg-white p-6 shadow-spotlight">
        <h1 className="text-3xl font-black tracking-normal">写点什么</h1>
        <p className="mt-2 text-sm text-slate-500">像发微博一样输入正文，发出后看评论如何逐步出现。</p>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="有什么新鲜事？"
          rows={7}
          className="mt-5 w-full resize-none rounded-card border border-line p-4 text-[16px] leading-7 focus:border-accent focus:outline-none"
        />
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-950">发帖身份</div>
              <p className="mt-1 text-sm text-slate-500">
                选择这条内容最初出现时的身份基础，会影响后续可见度和扩散强度。
              </p>
            </div>
            {cost && (
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                已预估费用
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {PERSONAS.map((persona) => (
              <label
                key={persona.value}
                className={[
                  "cursor-pointer rounded-card border p-3 text-sm",
                  posterPersona === persona.value
                    ? "border-brand bg-amber-50 text-slate-950"
                    : "border-line text-slate-600",
                ].join(" ")}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-bold">{persona.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{persona.hint}</span>
                  </span>
                  <input
                    type="radio"
                    name="poster_persona"
                    checked={posterPersona === persona.value}
                    onChange={() => setPosterPersona(persona.value)}
                  />
                </span>
                <span className="mt-2 block text-xs text-slate-400">{persona.standing}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <label
              className={[
                "cursor-pointer rounded-card border p-3",
                identityMode === "new" ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">新身份</span>
                <input
                  type="radio"
                  name="identity_mode"
                  checked={identityMode === "new"}
                  onChange={() => setIdentityMode("new")}
                />
              </span>
              <span className="mt-1 block text-xs text-slate-400">从这次内容开始建立身份</span>
            </label>
            <label
              className={[
                "cursor-pointer rounded-card border p-3",
                identityMode === "continue" ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">继续身份</span>
                <input
                  type="radio"
                  name="identity_mode"
                  checked={identityMode === "continue"}
                  onChange={() => setIdentityMode("continue")}
                />
              </span>
              <span className="mt-1 block text-xs text-slate-400">沿用已经保存的人物身份</span>
            </label>
          </div>
          {identityMode === "continue" && (
            <label className="mt-3 grid max-w-sm gap-2 text-sm font-semibold text-slate-700">
              身份 ID
              <input
                value={posterPersonId}
                onChange={(event) => setPosterPersonId(event.target.value)}
                placeholder="例如 p_author"
                className="rounded-card border border-line px-3 py-2 text-base text-slate-950 focus:border-accent focus:outline-none"
              />
            </label>
          )}
        </div>
        <div className="mt-4 rounded-card border border-line bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-950">讨论轮次</div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                第 1 步发布原帖；之后每一轮让一批用户基于当前评论区继续点赞、评论或转发。
                轮次越多，越接近一条长微博持续发酵的过程。
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              当前 {selectedSteps} 轮
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          {ROUNDS.map((round) => (
            <label
              key={round.value}
              className={[
                "flex min-h-16 cursor-pointer items-center justify-between rounded-card border px-3",
                !customMode && steps === round.value ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span>
                <span className="block font-semibold">{round.label}</span>
                <span className="mt-1 block text-xs text-slate-400">{round.value} 轮 · {round.hint}</span>
              </span>
              <input
                type="radio"
                name="steps"
                checked={!customMode && steps === round.value}
                onChange={() => {
                  setCustomMode(false);
                  setSteps(round.value);
                }}
              />
            </label>
          ))}
          <label
            className={[
              "flex min-h-16 cursor-pointer items-center justify-between rounded-card border px-3",
              customMode ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
            ].join(" ")}
          >
            <span>
              <span className="block font-semibold">自定义轮次</span>
              <span className="mt-1 block text-xs text-slate-400">1-1000 轮</span>
            </span>
            <input
              type="radio"
              name="steps"
              checked={customMode}
              onChange={() => setCustomMode(true)}
            />
          </label>
        </div>
        {customMode && (
          <div className="mt-3 rounded-card border border-line bg-white p-4">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              自定义轮次数
              <input
                type="number"
                min={1}
                max={MAX_CUSTOM_STEPS}
                value={customSteps}
                onChange={(event) => setCustomSteps(clampSteps(Number(event.target.value)))}
                className="max-w-48 rounded-card border border-line px-3 py-2 text-base text-slate-950 focus:border-accent focus:outline-none"
              />
            </label>
            {selectedSteps > 100 && (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                长跑会生成更多数据库记录和回放事件。评论区只保留窗口化展示，历史页会优先看摘要和热词。
              </p>
            )}
          </div>
        )}
        {cost && (
          <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"> {/* review:P7-T10 */}
            <div>
              预计约 ¥{cost.estimated_rmb.toFixed(2)}；本次约 {cost.budgeted_agents} 个可见人物，
              {cost.decision_steps} 个决策步。
            </div>
            <div className="mt-1">
              自有算力不额外计费；付费 API 按 token 估算约 ¥{cost.estimated_rmb.toFixed(2)}。
            </div>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-sentiment-negative">{error}</div>}
        <div className="mt-5">
          <Button onClick={startRun}>开始围观</Button>
        </div>
      </section>

      <aside className="rounded-card border border-line bg-white p-5 shadow-sm">
        <h2 className="font-bold">发布前设置</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          不填前端字段时会使用后端 `.env` 默认值。
        </p>
        <details className="mt-4 min-w-0 rounded-card border border-line bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">BYOK 设置</summary>
          <div className="mt-3 grid min-w-0 gap-3">
            {/* review:PA-T3 */}
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              API Key
              <input
                value={key}
                placeholder="填入你的 LLM API Key"
                onChange={(event) => setKey(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Base URL
              <input
                value={baseUrl}
                placeholder="https://api.deepseek.com"
                onChange={(event) => setBaseUrl(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Model
              <input
                value={model}
                placeholder="deepseek-v4-pro"
                onChange={(event) => setModel(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Reasoning
              <input
                value={reasoningEffort}
                placeholder="high"
                onChange={(event) => setReasoningEffort(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-ink/60">
              Thinking
              <input
                value={thinking}
                placeholder="enabled"
                onChange={(event) => setThinking(event.target.value)}
                className="min-w-0 rounded-card border border-line p-2 text-sm text-ink"
              />
            </label>
          </div>
        </details>
      </aside>
    </div>
  );
}
