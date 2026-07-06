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

export interface CreateMultiRunBody {
  audience: { crowd_id?: string; custom?: string };
  content: string;
  steps: number;
  persona: PersonaKind;
  platforms: Array<"twitter" | "reddit">;
  world_id?: string;
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
export type LaunchKind = "single" | "multi";

export interface LaunchSummary {
  launch_id: string;
  kind: LaunchKind | string;
  world_id?: string;
  content: string;
  steps: number;
  platforms: Array<"twitter" | "reddit">;
  run_ids: string[];
  status: "created" | "running" | "done" | "error" | string;
  clock_tick?: number;
  poster_person_id?: string | null;
  poster_persona?: PersonaKind;
  error?: string | null;
  created_at?: string;
}

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

export type WorldEventKind =
  | "seed"
  | "post"
  | "reply"
  | "reaction"
  | "follow"
  | "report"
  | "bridge_inject";

export interface WorldEvent {
  event_id: string;
  world_id: string;
  tick: number;
  created_at: string;
  platform: "twitter" | "reddit";
  actor_account_id?: string | null;
  kind: WorldEventKind;
  payload: Record<string, unknown>;
  run_id?: string | null;
}

export interface WorldEventsPage {
  frames: WorldEvent[];
  next_after: number;
  clock_tick: number;
  launch_status: "running" | "done" | "error" | string | null;
}

export interface PlatformRunSpec {
  platform: "twitter" | "reddit";
  poster_account_id: string;
  config: CreateRunBody & { llm_key?: string; llm_model?: string };
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

function launchFromRun(run: RunSummary): LaunchSummary {
  return {
    launch_id: run.run_id,
    kind: "single",
    world_id: run.world_id,
    content: run.content,
    steps: run.steps,
    platforms: [run.platform],
    run_ids: [run.run_id],
    status: run.status,
    clock_tick: run.current_step,
    poster_person_id: run.poster_person_id,
    poster_persona: run.poster_persona,
    created_at: run.created_at,
  };
}

export async function fetchLaunches(): Promise<LaunchSummary[]> {  // review:P13-T4
  const response = await fetch("/api/launches");
  if (!response.ok) {
    throw new Error("failed to load launches");
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data.map((run) => launchFromRun(run));
  }
  return Array.isArray(data.launches) ? data.launches : [];
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

export async function createMultiRun(
  body: CreateMultiRunBody,
  creds: Creds,
): Promise<{ world_id: string; run_ids: string[] }> {  // review:P11-T5
  const response = await fetch("/api/multi-runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...llmHeaders(creds),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? "create multi run failed");
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

export async function orchestrateWorld(  // review:P9-T6
  worldId: string,
  specs: PlatformRunSpec[],
): Promise<{ events: Array<Record<string, unknown>>; frames: WorldEvent[] }> {
  const response = await fetch(`/api/worlds/${worldId}/orchestrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ specs }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? "orchestrate world failed");
  }
  return response.json();
}

export async function getWorldEvents(
  worldId: string,
  runIds: string[] = [],
  after?: number,
): Promise<WorldEventsPage> {  // review:P11-T4
  const query = new URLSearchParams();
  for (const runId of runIds) {
    query.append("run_id", runId);
  }
  if (after !== undefined) {
    query.set("after", String(after));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`/api/worlds/${worldId}/events${suffix}`);
  if (!response.ok) {
    throw new Error("failed to load world events");
  }
  const data = await response.json();
  const frames = Array.isArray(data.frames) ? data.frames : [];
  return {
    frames,
    next_after: typeof data.next_after === "number" ? data.next_after : 0,
    clock_tick: typeof data.clock_tick === "number" ? data.clock_tick : 0,
    launch_status: typeof data.launch_status === "string" ? data.launch_status : null,
  };
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

export interface FlavorPhase {
  phase: string;
  tick_range: [number, number];
  volume: number;
  dominant_sentiment: string;
  representative_utterances: string[];
}

export interface PlatformFlavor {
  platform: "twitter" | "reddit" | string;
  persona_mix: Record<string, number>;
  spread_shape: string;
  phases: FlavorPhase[];
  volume: number;
}

export interface FlavorDigest {
  world_id?: string | null;
  run_ids: string[];
  platforms: PlatformFlavor[];
  cross_platform_notes: string[];
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

export async function fetchFlavor(runId: string, worldId?: string): Promise<FlavorDigest> {  // review:P13-T6
  const query = new URLSearchParams();
  if (worldId) {
    query.set("world_id", worldId);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`/api/runs/${runId}/flavor${suffix}`);
  if (!response.ok) {
    throw new Error("failed to load flavor");
  }
  return response.json();
}

export interface SnapshotWindow {
  tail?: number;
  replies_offset?: number;
  replies_limit?: number;
  totals?: Record<string, number>;
}

export type WindowedRunSnapshot = RunSnapshot & { window?: SnapshotWindow };

export interface FetchRunSnapshotOptions {
  tail?: number;
  repliesOffset?: number;
  repliesLimit?: number;
}

export async function fetchRunSnapshot(
  runId: string,
  options: FetchRunSnapshotOptions = {},
): Promise<WindowedRunSnapshot> {
  const query = new URLSearchParams();
  if (options.tail !== undefined) {
    query.set("tail", String(options.tail));
  }
  if (options.repliesOffset !== undefined) {
    query.set("replies_offset", String(options.repliesOffset));
  }
  if (options.repliesLimit !== undefined) {
    query.set("replies_limit", String(options.repliesLimit));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`/api/runs/${runId}/snapshot${suffix}`);
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
