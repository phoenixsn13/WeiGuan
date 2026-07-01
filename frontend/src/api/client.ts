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
  key: string;
  model: string;
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
      "X-LLM-Key": creds.key,
      "X-LLM-Model": creds.model,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? "create run failed");
  }
  return response.json();
}
