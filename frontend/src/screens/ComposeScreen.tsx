import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { createRun } from "../api/client";
import { useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";

const ROUNDS = [
  { value: 6, label: "快速围观" },
  { value: 10, label: "标准" },
  { value: 15, label: "深度发酵" },
];

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
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function startRun() {
    setError("");
    try {
      const { run_id } = await createRun(
        { audience, content, steps, platform: "twitter" },
        { key, model, baseUrl, reasoningEffort, thinking },
      );
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
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {ROUNDS.map((round) => (
            <label
              key={round.value}
              className={[
                "flex min-h-12 cursor-pointer items-center justify-between rounded-card border px-3 font-semibold",
                steps === round.value ? "border-accent bg-blue-50 text-accent" : "border-line text-slate-600",
              ].join(" ")}
            >
              <span>{round.label}</span>
              <input
                type="radio"
                name="steps"
                checked={steps === round.value}
                onChange={() => setSteps(round.value)}
              />
            </label>
          ))}
        </div>
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
        <details className="mt-4 rounded-card border border-line bg-slate-50 p-3 text-sm">
        <summary className="cursor-pointer font-medium">BYOK 设置</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {/* review:PA-T3 */}
          <label className="grid gap-1 text-xs text-ink/60">
            API Key
            <input
              value={key}
              placeholder="填入你的 LLM API Key"
              onChange={(event) => setKey(event.target.value)}
              className="rounded-card border border-line p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Base URL
            <input
              value={baseUrl}
              placeholder="https://api.deepseek.com"
              onChange={(event) => setBaseUrl(event.target.value)}
              className="rounded-card border border-line p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Model
            <input
              value={model}
              placeholder="deepseek-v4-pro"
              onChange={(event) => setModel(event.target.value)}
              className="rounded-card border border-line p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Reasoning
            <input
              value={reasoningEffort}
              placeholder="high"
              onChange={(event) => setReasoningEffort(event.target.value)}
              className="rounded-card border border-line p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Thinking
            <input
              value={thinking}
              placeholder="enabled"
              onChange={(event) => setThinking(event.target.value)}
              className="rounded-card border border-line p-2 text-sm text-ink"
            />
          </label>
        </div>
      </details>
      </aside>
    </div>
  );
}
