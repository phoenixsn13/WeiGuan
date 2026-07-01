import type { RunSnapshot } from "./canonical";

// review:P3-T1
export function emptySnapshot(): RunSnapshot {
  return {
    platform: "twitter",
    seed_post_id: null,
    actors: [],
    posts: [],
    replies: [],
    reactions: [],
    follows: [],
    reports: [],
    traces: [],
  };
}

export function applyDelta(snap: RunSnapshot, delta: RunSnapshot): RunSnapshot {
  return {
    platform: delta.platform ?? snap.platform,
    seed_post_id: snap.seed_post_id ?? delta.seed_post_id ?? null,
    actors: [...snap.actors, ...delta.actors],
    posts: [...snap.posts, ...delta.posts],
    replies: [...snap.replies, ...delta.replies],
    reactions: [...snap.reactions, ...delta.reactions],
    follows: [...snap.follows, ...delta.follows],
    reports: [...snap.reports, ...delta.reports],
    traces: [...snap.traces, ...delta.traces],
  };
}
