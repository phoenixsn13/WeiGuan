import type { PersonView, RunSummary } from "../api/client";

export const TEMPORARY_PERSON_ID = "temporary_identity";

export type IdentityGroup = { person: PersonView; runs: RunSummary[] };

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
