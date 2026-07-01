import { useState } from "react";

import { interviewActor } from "../api/client";
import { useApiKey } from "../api/useApiKey";
import type { Actor } from "../model/canonical";

// review:P5-T4
export function InterviewDrawer({
  runId,
  actor,
  onClose,
}: {
  runId: string;
  actor: Actor | null;
  onClose: () => void;
}) {
  const { key, model } = useApiKey();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<{ question: string; answer: string }[]>([]);
  const [loading, setLoading] = useState(false);

  if (!actor) return null;

  async function ask() {
    if (!question.trim() || loading || !actor) return;
    const current = question;
    setLoading(true);
    try {
      const { answer } = await interviewActor(runId, actor.user_id, current, {
        key,
        model,
      });
      setTurns((items) => [...items, { question: current, answer }]);
      setQuestion("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/50" />
      <aside
        onClick={(event) => event.stopPropagation()}
        className="absolute right-0 top-0 h-full w-80 animate-[slidein_.2s_ease] overflow-y-auto bg-white p-4 shadow-spotlight"
      >
        <div className="font-display text-lg">{actor.name}</div>
        <div className="text-xs text-ink/50">
          @{actor.user_name} · {actor.bio}
        </div>
        <div className="mt-4 space-y-3">
          {turns.map((turn, index) => (
            <div key={index}>
              <div className="text-sm text-accent">你：{turn.question}</div>
              <div className="text-sm">
                {actor.name}：{turn.answer}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="继续问…"
            className="flex-1 rounded-card border border-ink/15 p-2 text-sm"
          />
          <button onClick={ask} className="rounded-card bg-brand px-3 text-sm">
            问
          </button>
        </div>
      </aside>
    </div>
  );
}
