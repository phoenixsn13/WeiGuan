import type { PersonView, RunSummary } from "../api/client";
import { groupRunsByIdentity, TEMPORARY_PERSON_ID } from "./identity";

function person(person_id: string, display_name: string, run_ids: string[]): PersonView {
  return {
    person: {
      person_id,
      display_name,
      persona_kind: "verified",
      accounts: [
        {
          account_id: `acct_${person_id}`,
          person_id,
          platform: "twitter",
          handle: display_name,
          avatar_seed: person_id,
          num_followers: 2000,
          influence_score: 10,
        },
      ],
    },
    stance: { stance_counts: {}, dominant: "other" },
    total_influence: 10,
    run_ids,
  };
}

function run(run_id: string, created_at: string): RunSummary {
  return {
    run_id,
    content: `内容 ${run_id}`,
    steps: 10,
    platform: "twitter",
    status: "done",
    created_at,
    totals: { replies: 1 },
  };
}

test("groups multiple runs by the same identity in time order", () => {  // review:P7-T6-AC1
  const groups = groupRunsByIdentity(
    [person("p_1", "财经大号", ["r_old", "r_new"])],
    [
      run("r_old", "2026-07-01T08:00:00Z"),
      run("r_new", "2026-07-02T08:00:00Z"),
    ],
  );

  expect(groups).toHaveLength(1);
  expect(groups[0].person.person.display_name).toBe("财经大号");
  expect(groups[0].runs.map((item) => item.run_id)).toEqual(["r_new", "r_old"]);
});

test("puts runs without a PersonView into a temporary identity group", () => {  // review:P7-T6-AC2
  const groups = groupRunsByIdentity([], [run("r_anon", "2026-07-01T08:00:00Z")]);

  expect(groups).toHaveLength(1);
  expect(groups[0].person.person.person_id).toBe(TEMPORARY_PERSON_ID);
  expect(groups[0].person.person.display_name).toBe("临时身份");
  expect(groups[0].runs[0].run_id).toBe("r_anon");
});

test("returns deterministic identity group order by latest run", () => {  // review:P7-T6-AC3
  const runs = [
    run("r_a", "2026-07-01T08:00:00Z"),
    run("r_b", "2026-07-03T08:00:00Z"),
    run("r_c", "2026-07-02T08:00:00Z"),
  ];

  const groups = groupRunsByIdentity(
    [
      person("p_a", "A", ["r_a"]),
      person("p_b", "B", ["r_b"]),
      person("p_c", "C", ["r_c"]),
    ],
    runs,
  );

  expect(groups.map((group) => group.person.person.person_id)).toEqual([
    "p_b",
    "p_c",
    "p_a",
  ]);
});
