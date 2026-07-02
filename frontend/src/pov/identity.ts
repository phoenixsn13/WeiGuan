import type { PersonView, RunSummary } from "../api/client";

export const TEMPORARY_PERSON_ID = "temporary_identity";

export type IdentityGroup = { person: PersonView; runs: RunSummary[] };
export type StancePoint = { run_id: string; label: string; dominant: string; score: number };
export type InfluencePoint = { run_id: string; label: string; value: number };

function runTime(run: RunSummary): number {
  const timestamp = run.created_at ? Date.parse(run.created_at) : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortRunsByTime(runs: RunSummary[]): RunSummary[] {
  return [...runs].sort((left, right) => {
    const byTime = runTime(right) - runTime(left);
    return byTime || left.run_id.localeCompare(right.run_id);
  });
}

function identityRuns(person: PersonView, runs: RunSummary[]): RunSummary[] {
  const lookup = new Map(runs.map((run) => [run.run_id, run]));
  return [...person.run_ids]
    .map((runId) => lookup.get(runId))
    .filter((run): run is RunSummary => Boolean(run))
    .sort((left, right) => {
      const byTime = runTime(left) - runTime(right);
      return byTime || left.run_id.localeCompare(right.run_id);
    });
}

function temporaryPerson(): PersonView {
  return {
    person: {
      person_id: TEMPORARY_PERSON_ID,
      display_name: "临时身份",
      persona_kind: "ordinary",
      accounts: [],
    },
    stance: { stance_counts: {}, dominant: "other" },
    total_influence: 0,
    run_ids: [],
    standing_timeline: [],
  };
}

// review:P7-T6
export function groupRunsByIdentity(
  persons: PersonView[],
  runs: RunSummary[],
): IdentityGroup[] {
  const remaining = new Map(runs.map((run) => [run.run_id, run]));
  const groups: IdentityGroup[] = [];

  for (const person of persons) {
    const groupedRuns = sortRunsByTime(
      person.run_ids
        .map((runId) => remaining.get(runId))
        .filter((run): run is RunSummary => Boolean(run)),
    );
    if (groupedRuns.length === 0) {
      continue;
    }
    groupedRuns.forEach((run) => remaining.delete(run.run_id));
    groups.push({ person, runs: groupedRuns });
  }

  const temporaryRuns = sortRunsByTime([...remaining.values()]);
  if (temporaryRuns.length > 0) {
    groups.push({ person: temporaryPerson(), runs: temporaryRuns });
  }

  return groups.sort((left, right) => {
    const byTime = runTime(right.runs[0]) - runTime(left.runs[0]);
    return byTime || left.person.person.person_id.localeCompare(right.person.person.person_id);
  });
}

// review:P7-T7
export function stanceDriftSeries(
  person: PersonView,
  runs: RunSummary[],
): StancePoint[] {  // review:P7-T10
  const orderedRuns = identityRuns(person, runs);
  const runIndex = new Map(orderedRuns.map((run, index) => [run.run_id, index]));
  return person.standing_timeline
    .filter((point) => runIndex.has(point.run_id))
    .sort((left, right) => (runIndex.get(left.run_id) ?? 0) - (runIndex.get(right.run_id) ?? 0))
    .map((point) => ({
      run_id: point.run_id,
      label: `第 ${(runIndex.get(point.run_id) ?? 0) + 1} 次`,
      dominant: point.stance_dominant,
      score: point.stance_score,
    }));
}

export function influenceSeries(
  person: PersonView,
  runs: RunSummary[],
): InfluencePoint[] {  // review:P7-T10
  const orderedRuns = identityRuns(person, runs);
  if (orderedRuns.length === 0 || person.standing_timeline.length === 0) {
    return [];
  }
  const runIndex = new Map(orderedRuns.map((run, index) => [run.run_id, index]));
  return person.standing_timeline
    .filter((point) => runIndex.has(point.run_id))
    .sort((left, right) => (runIndex.get(left.run_id) ?? 0) - (runIndex.get(right.run_id) ?? 0))
    .map((point) => ({
      run_id: point.run_id,
      label: `第 ${(runIndex.get(point.run_id) ?? 0) + 1} 次`,
      value: point.influence,
    }));
}
