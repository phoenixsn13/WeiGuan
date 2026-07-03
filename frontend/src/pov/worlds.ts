import type { IdentitySummary, PersonView, RunSummary } from "../api/client";

export interface WorldCardView {
  worldId: string;
  primaryIdentityName: string;
  identityCount: number;
  runCount: number;
  totalInfluence: number;
  platformCount: number;
  latestRunContent: string;
  latestRunId?: string;
  latestCreatedAt?: string;
  totals: { replies: number; reposts: number; likes: number };
  status: string;
}

function runTime(run: RunSummary): number {
  const parsed = run.created_at ? Date.parse(run.created_at) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function total(runs: RunSummary[], key: string): number {
  return runs.reduce((sum, run) => sum + (run.totals[key] ?? 0), 0);
}

function platformCount(worldId: string, runs: RunSummary[], persons: PersonView[]): number {
  const platforms = new Set<string>();
  for (const person of persons) {
    person.person.accounts.forEach((account) => platforms.add(account.platform));
  }
  runs.filter((run) => run.world_id === worldId).forEach((run) => platforms.add(run.platform));
  return Math.max(1, platforms.size);
}

// review:P11-T6
export function groupWorldCards(
  identities: IdentitySummary[],
  runs: RunSummary[],
  personsByWorld: Record<string, PersonView[]>,
): WorldCardView[] {
  const ids = [...new Set(identities.map((identity) => identity.world_id))];

  return ids
    .map((worldId) => {
      const worldIdentities = identities.filter((identity) => identity.world_id === worldId);
      const worldRuns = runs
        .filter((run) => run.world_id === worldId)
        .sort((left, right) => runTime(right) - runTime(left) || left.run_id.localeCompare(right.run_id));
      const latest = worldRuns[0];
      const primary = [...worldIdentities].sort(
        (left, right) => right.total_influence - left.total_influence || left.display_name.localeCompare(right.display_name),
      )[0];

      return {
        worldId,
        primaryIdentityName: primary?.display_name ?? "未命名世界",
        identityCount: worldIdentities.length,
        runCount: worldIdentities.reduce((sum, identity) => sum + identity.run_count, 0),
        totalInfluence: worldIdentities.reduce((sum, identity) => sum + identity.total_influence, 0),
        platformCount: platformCount(worldId, runs, personsByWorld[worldId] ?? []),
        latestRunContent: latest?.content ?? "还没有内容",
        latestRunId: latest?.run_id,
        latestCreatedAt: latest?.created_at,
        totals: {
          replies: total(worldRuns, "replies"),
          reposts: total(worldRuns, "reposts"),
          likes: total(worldRuns, "likes"),
        },
        status: latest?.status ?? "created",
      };
    })
    .sort((left, right) => {
      const leftTime = left.latestCreatedAt ? Date.parse(left.latestCreatedAt) : 0;
      const rightTime = right.latestCreatedAt ? Date.parse(right.latestCreatedAt) : 0;
      const byTime = (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      return byTime || right.totalInfluence - left.totalInfluence || left.worldId.localeCompare(right.worldId);
    });
}
