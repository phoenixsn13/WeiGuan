// review:P4-T4  消费契约 §2.2
export interface Crowd {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
}

export interface CreateRunBody {
  audience: { crowd_id?: string; custom?: string };
  content: string;
  steps: number;
  platform: "twitter" | "reddit";
}

export interface Creds {
  key?: string;
  model?: string;
  baseUrl?: string;
  reasoningEffort?: string;
  thinking?: string;
}

function llmHeaders(creds: Creds): Record<string, string> {
  const headers: Record<string, string> = {};
  if (creds.key) headers["X-LLM-Key"] = creds.key;
  if (creds.model) headers["X-LLM-Model"] = creds.model;
  if (creds.baseUrl) headers["X-LLM-Base-Url"] = creds.baseUrl;
  if (creds.reasoningEffort) headers["X-LLM-Reasoning-Effort"] = creds.reasoningEffort;
  if (creds.thinking) headers["X-LLM-Thinking"] = creds.thinking;
  return headers;
}

export async function fetchCrowds(): Promise<Crowd[]> {
  const response = await fetch("/api/crowds");
  if (!response.ok) {
    throw new Error("failed to load crowds");
  }
  return response.json();
}

export async function createRun(
  body: CreateRunBody,
  creds: Creds,
): Promise<{ run_id: string }> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...llmHeaders(creds),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? "create run failed");
  }
  return response.json();
}

// review:P5-T3
export interface RetroMetrics {
  sentiment: { positive: number; negative: number; neutral: number };
  spread_by_step: number[];
  totals: Record<string, number>;
}

export interface Insights {
  verdict: string;
  suggestions: string[];
}

export async function interviewActor(
  runId: string,
  actorId: number,
  question: string,
  creds: Creds,
): Promise<{ answer: string }> {
  const response = await fetch(`/api/runs/${runId}/interview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...llmHeaders(creds),
    },
    body: JSON.stringify({ actor_id: actorId, question }),
  });
  if (!response.ok) {
    throw new Error("interview failed");
  }
  return response.json();
}

export async function fetchRetro(runId: string): Promise<RetroMetrics> {
  const response = await fetch(`/api/runs/${runId}/retro`);
  if (!response.ok) {
    throw new Error("failed to load retro");
  }
  return response.json();
}

export async function fetchInsights(runId: string, creds: Creds): Promise<Insights> {
  const response = await fetch(`/api/runs/${runId}/insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...llmHeaders(creds),
    },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error("failed to load insights");
  }
  return response.json();
}
