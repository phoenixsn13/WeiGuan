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
    <div>
      <h1 className="mb-4 font-display text-2xl">写点什么</h1>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="有什么新鲜事？"
        rows={4}
        className="w-full rounded-card border border-ink/15 p-3 text-[15px]"
      />
      <div className="mt-4 flex gap-4 text-sm">
        {ROUNDS.map((round) => (
          <label key={round.value} className="flex items-center gap-1">
            <input
              type="radio"
              name="steps"
              checked={steps === round.value}
              onChange={() => setSteps(round.value)}
            />
            {round.label}（{round.value}步）
          </label>
        ))}
      </div>
      <details className="mt-4 rounded-card border border-ink/10 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium">BYOK 设置</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {/* review:PA-T3 */}
          <label className="grid gap-1 text-xs text-ink/60">
            API Key
            <input
              value={key}
              placeholder="填入你的 LLM API Key"
              onChange={(event) => setKey(event.target.value)}
              className="rounded-card border border-ink/15 p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Base URL
            <input
              value={baseUrl}
              placeholder="https://api.deepseek.com"
              onChange={(event) => setBaseUrl(event.target.value)}
              className="rounded-card border border-ink/15 p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Model
            <input
              value={model}
              placeholder="deepseek-v4-pro"
              onChange={(event) => setModel(event.target.value)}
              className="rounded-card border border-ink/15 p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Reasoning
            <input
              value={reasoningEffort}
              placeholder="high"
              onChange={(event) => setReasoningEffort(event.target.value)}
              className="rounded-card border border-ink/15 p-2 text-sm text-ink"
            />
          </label>
          <label className="grid gap-1 text-xs text-ink/60">
            Thinking
            <input
              value={thinking}
              placeholder="enabled"
              onChange={(event) => setThinking(event.target.value)}
              className="rounded-card border border-ink/15 p-2 text-sm text-ink"
            />
          </label>
        </div>
      </details>
      {error && <div className="mt-3 text-sm text-sentiment-negative">{error}</div>}
      <div className="mt-4">
        <Button onClick={startRun}>开始围观 ▶</Button>
      </div>
    </div>
  );
}
