import type { Platform, RunSnapshot } from "../model/canonical";
import { emptySnapshot } from "../model/accumulate";
import type { PosterViewModel } from "./poster";
import { posterView } from "./poster";
import type { PersonView, WorldEvent } from "../api/client";

export type PlatformColumn = { platform: Platform; view: PosterViewModel };
export type BridgeEdge = {
  fromPlatform: Platform;
  toPlatform: Platform;
  postRef: number;
  tick: number;
};

export interface MultiPlatformView {
  clockTick: number;
  columns: PlatformColumn[];
  bridges: BridgeEdge[];
}

const platformOrder: Record<Platform, number> = {
  twitter: 0,
  reddit: 1,
};

function payloadNumber(payload: Record<string, unknown>, key: string, fallback = 0): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function payloadString(payload: Record<string, unknown>, key: string, fallback = ""): string {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
}

const DATASET_PREFIX = /^.{1,3}\d{1,3}_/u;

export function cleanDisplayName(value?: string | null): string | null {
  const label = value?.trim();
  if (!label) return null;
  return label.replace(DATASET_PREFIX, "");
}

function personNameForAccount(accountId: string, personViews: PersonView[]): string | null {
  for (const view of personViews) {
    const account = view.person.accounts.find((item) => item.account_id === accountId);
    if (account) return cleanDisplayName(view.person.display_name);
  }
  return null;
}

function aliasForAccount(accountId: string | null | undefined, actorId?: number): string {
  const cleaned = accountId?.trim();
  if (cleaned) return `围观者·${cleaned.slice(-4)}`;
  return `围观者·${actorId ?? "未知"}`;
}

export function resolveWorldDisplayName({
  payloadName,
  accountId,
  personViews = [],
  actorId,
}: {
  payloadName?: unknown;
  accountId?: string | null;
  personViews?: PersonView[];
  actorId?: number;
}): string {
  if (typeof payloadName === "string") {
    const cleaned = cleanDisplayName(payloadName);
    if (cleaned) return cleaned;
  }
  if (accountId) {
    const personName = personNameForAccount(accountId, personViews);
    if (personName) return personName;
  }
  return aliasForAccount(accountId, actorId);
}

export function mergeEvents(existing: WorldEvent[], incoming: WorldEvent[]): WorldEvent[] {  // review:P13-T3
  const byId = new Map<string, WorldEvent>();
  for (const event of existing) {
    byId.set(event.event_id, event);
  }
  for (const event of incoming) {
    if (!byId.has(event.event_id)) {
      byId.set(event.event_id, event);
    }
  }
  return Array.from(byId.values()).sort((a, b) => (
    a.tick - b.tick
    || a.created_at.localeCompare(b.created_at)
    || a.event_id.localeCompare(b.event_id)
  ));
}

function ensureSnapshot(map: Map<Platform, RunSnapshot>, platform: Platform): RunSnapshot {
  const existing = map.get(platform);
  if (existing) return existing;
  const snap = { ...emptySnapshot(), platform };
  map.set(platform, snap);
  return snap;
}

function ensureActor(
  snap: RunSnapshot,
  event: WorldEvent,
  actorId: number,
  personViews: PersonView[],
) {
  if (snap.actors.some((actor) => actor.user_id === actorId)) return;
  const name = resolveWorldDisplayName({
    payloadName: event.payload.author_display_name,
    accountId: event.actor_account_id,
    personViews,
    actorId,
  });
  snap.actors.push({
    user_id: actorId,
    name,
    user_name: name,
    num_followers: 0,
    num_followings: 0,
  });
}

// review:P9-T6
export function multiPlatformView(events: WorldEvent[], personViews: PersonView[] = []): MultiPlatformView {
  const snapshots = new Map<Platform, RunSnapshot>();
  const bridges: BridgeEdge[] = [];

  const ordered = [...events].sort((a, b) => a.tick - b.tick || a.event_id.localeCompare(b.event_id));
  for (const event of ordered) {
    const snap = ensureSnapshot(snapshots, event.platform);
    if (event.kind === "bridge_inject") {
      const source = payloadString(event.payload, "source_platform") as Platform;
      const postRef = payloadNumber(event.payload, "source_post_id", 0);
      if ((source === "twitter" || source === "reddit") && postRef > 0) {
        bridges.push({
          fromPlatform: source,
          toPlatform: event.platform,
          postRef,
          tick: event.tick,
        });
      }
      continue;
    }

    if (event.kind === "seed" || event.kind === "post") {
      const authorId = payloadNumber(event.payload, "author_id", 1);
      const postId = payloadNumber(event.payload, "post_id", snap.posts.length + 1);
      ensureActor(snap, event, authorId, personViews);
      snap.posts.push({
        post_id: postId,
        author_id: authorId,
        kind: payloadString(event.payload, "kind", "original") === "quote" ? "quote" : "original",
        content: payloadString(event.payload, "content"),
        quote_content: payloadString(event.payload, "quote_content", "") || null,
        original_post_id: payloadNumber(event.payload, "original_post_id", 0) || null,
        created_at: event.created_at,
        num_likes: payloadNumber(event.payload, "num_likes"),
        num_dislikes: payloadNumber(event.payload, "num_dislikes"),
        num_shares: payloadNumber(event.payload, "num_shares"),
        num_reports: payloadNumber(event.payload, "num_reports"),
      });
      if (event.kind === "seed" && snap.seed_post_id == null) {
        snap.seed_post_id = postId;
      }
    }

    if (event.kind === "reply") {
      const authorId = payloadNumber(event.payload, "author_id", 1);
      ensureActor(snap, event, authorId, personViews);
      snap.replies.push({
        comment_id: payloadNumber(event.payload, "comment_id", snap.replies.length + 1),
        post_id: payloadNumber(event.payload, "post_id", snap.seed_post_id ?? 1),
        author_id: authorId,
        content: payloadString(event.payload, "content"),
        created_at: event.created_at,
        num_likes: payloadNumber(event.payload, "num_likes"),
        num_dislikes: payloadNumber(event.payload, "num_dislikes"),
      });
    }
  }

  return {
    clockTick: events.reduce((max, event) => Math.max(max, event.tick), 0),
    columns: Array.from(snapshots.entries())
      .sort(([a], [b]) => platformOrder[a] - platformOrder[b])
      .map(([platform, snap]) => ({
        platform,
        view: posterView(snap),
      })),
    bridges,
  };
}
