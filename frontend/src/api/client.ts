// review:P4-T4  消费契约 §2.2
import type { RunSnapshot } from "../model/canonical";
import { saveCurrentIdentity } from "./useApiKey";

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
  world_id?: string;
  poster_persona?: PersonaKind;
  poster_person_id?: string;
  person_memory_budget?: number;
}

export interface Creds {
  key?: string;
  model?: string;
  baseUrl?: string;
  reasoningEffort?: string;
  thinking?: string;
}

export interface RunSummary {
  run_id: string;
  world_id?: string;
  poster_person_id?: string;
  poster_persona?: PersonaKind;
  content: string;
  steps: number;
  platform: "twitter" | "reddit";
  status: "created" | "running" | "done" | "error" | string;
  current_step?: number;
  created_at?: string;
  totals: Record<string, number>;
}

export type PersonaKind = "ordinary" | "verified" | "kol";

export interface Account {
  account_id: string;
  person_id: string;
  platform: "twitter" | "reddit";
  handle: string;
  avatar_seed: string;
  num_followers: number;
  influence_score: number;
}

export interface Person {
  person_id: string;
  display_name: string;
  persona_kind: PersonaKind;
  accounts: Account[];
}

export interface StandingPoint {
  run_id: string;
  influence: number;
  followers: number;
  stance_dominant: string;
  stance_score: number;
}

export interface PersonView {
  person: Person;
  stance: { stance_counts: Record<string, number>; dominant: string };
  total_influence: number;
  run_ids: string[];
  standing_timeline: StandingPoint[];
}

export interface IdentitySummary {
  world_id: string;
  person_id: string;
  display_name: string;
  persona_kind: PersonaKind;
  total_influence: number;
  run_count: number;
}

export interface CreatePersonBody {
  world_id?: string;
  display_name: string;
  persona_kind: PersonaKind;
  platform: "twitter" | "reddit";
  handle: string;
}

export interface PreviewCostParams {
  steps: number;
  llm_max_agents: number;
  attention_comment_budget: number;
  person_memory_budget: number;
}

export interface PreviewCost {
  estimated_rmb: number;
  budgeted_agents: number;
  decision_steps: number;
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

export async function fetchRuns(): Promise<RunSummary[]> {
  const response = await fetch("/api/runs");
  if (!response.ok) {
    throw new Error("failed to load runs");
  }
  return response.json();
}

export async function fetchRunSummary(runId: string): Promise<RunSummary> {
  const response = await fetch(`/api/runs/${runId}`);
  if (!response.ok) {
    throw new Error("failed to load run");
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

export async function createPerson(
  body: CreatePersonBody,
): Promise<{ world_id: string; person: Person }> {
  const response = await fetch("/api/persons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? "create person failed");
  }
  const data = await response.json();
  // review:P7-T10
  if (data?.person?.person_id && data?.world_id) {
    saveCurrentIdentity(data.person.person_id, data.world_id);
  }
  return data;
}

export async function getIdentities(): Promise<IdentitySummary[]> {  // review:P7-T12
  const response = await fetch("/api/identities");
  if (!response.ok) {
    throw new Error("failed to load identities");
  }
  const data = await response.json();
  return data.identities ?? [];
}

export async function listPersons(worldId: string): Promise<PersonView[]> {
  const response = await fetch(`/api/worlds/${worldId}/persons`);
  if (!response.ok) {
    throw new Error("failed to load persons");
  }
  const data = await response.json();
  return data.persons;
}

export async function fetchPerson(personId: string, worldId: string): Promise<PersonView> {
  const query = new URLSearchParams({ world_id: worldId });
  const response = await fetch(`/api/persons/${personId}?${query.toString()}`);
  if (!response.ok) {
    throw new Error("failed to load person");
  }
  return response.json();
}

export async function previewCost(params: PreviewCostParams): Promise<PreviewCost> {
  const query = new URLSearchParams({
    steps: String(params.steps),
    llm_max_agents: String(params.llm_max_agents),
    attention_comment_budget: String(params.attention_comment_budget),
    person_memory_budget: String(params.person_memory_budget),
  });
  const response = await fetch(`/api/runs/preview-cost?${query.toString()}`);
  if (!response.ok) {
    throw new Error("failed to preview cost");
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

export interface CascadeNode {
  post_id: number;
  author_id: number;
  depth: number;
  children: number[];
}

export interface DiffusionMetrics {
  tree: CascadeNode[];
  max_depth: number;
  breadth: number;
  cascade_size: number;
  key_rebroadcasters: number[];
}

export interface OpinionMetrics {
  stance_by_tick: Array<{ tick: string; stance_counts: Record<string, number> }>;
  convergence_trend: "converging" | "diverging" | "stable" | string;
  polarization_index: number;
  homophily: number;
  cross_stance_ratio: number;
  echo_chamber_risk: "low" | "medium" | "high" | string;
}

export interface InfluenceMetrics {
  ranking: Array<{
    actor_id: number;
    in_degree: number;
    centrality: number;
    structural_influence?: number;
    kcore: number;
  }>;
  top_leaders: number[];
  iterations?: number;
}

export interface TemporalMetrics {
  fermentation_curve: Array<{
    tick: string;
    volume: number;
    sentiment: "positive" | "negative" | "neutral" | string;
  }>;
  peak_tick: number;
  half_life_ticks: number;
  sentiment_reversals: Array<{ tick: string; from: string; to: string }>;
}

export interface AnalysisProjection {
  diffusion: DiffusionMetrics;
  opinion: OpinionMetrics;
  influence: InfluenceMetrics;
  temporal: TemporalMetrics;
}

function isInsights(value: unknown): value is Insights {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { verdict?: unknown; suggestions?: unknown };
  return (
    typeof candidate.verdict === "string" &&
    Array.isArray(candidate.suggestions) &&
    candidate.suggestions.every((suggestion) => typeof suggestion === "string")
  );
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

export async function getAnalysis(runId: string): Promise<AnalysisProjection> {  // review:P8-T7
  const response = await fetch(`/api/runs/${runId}/analysis`);
  if (!response.ok) {
    throw new Error("failed to load analysis");
  }
  return response.json();
}

export async function fetchRunSnapshot(runId: string): Promise<RunSnapshot> {
  const response = await fetch(`/api/runs/${runId}/snapshot`);
  if (!response.ok) {
    throw new Error("failed to load snapshot");
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

export async function fetchSavedInsights(runId: string): Promise<Insights | null> {
  const response = await fetch(`/api/runs/${runId}/insights`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("failed to load insights");
  }
  const data = await response.json();
  return isInsights(data) ? data : null;
}
