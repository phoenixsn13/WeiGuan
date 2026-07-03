import type { IdentitySummary, PersonView, RunSummary } from "../api/client";
import { groupWorldCards } from "./worlds";

const identities: IdentitySummary[] = [
  {
    world_id: "w_1",
    person_id: "p_author",
    display_name: "财经观察员",
    persona_kind: "kol",
    total_influence: 56,
    run_count: 2,
  },
  {
    world_id: "w_1",
    person_id: "p_reader",
    display_name: "港股夜猫",
    persona_kind: "ordinary",
    total_influence: 12,
    run_count: 1,
  },
  {
    world_id: "w_2",
    person_id: "p_tech",
    display_name: "技术博主",
    persona_kind: "verified",
    total_influence: 80,
    run_count: 1,
  },
];

const runs: RunSummary[] = [
  {
    run_id: "r_old",
    world_id: "w_1",
    poster_person_id: "p_author",
    content: "旧内容",
    steps: 10,
    platform: "twitter",
    status: "done",
    created_at: "2026-07-01T08:00:00Z",
    totals: { replies: 3, reposts: 1, likes: 2 },
  },
  {
    run_id: "r_new",
    world_id: "w_1",
    poster_person_id: "p_author",
    content: "AI 政策会改变商业模式吗",
    steps: 15,
    platform: "reddit",
    status: "running",
    created_at: "2026-07-02T08:00:00Z",
    totals: { replies: 7, reposts: 2, likes: 5 },
  },
  {
    run_id: "r_tech",
    world_id: "w_2",
    poster_person_id: "p_tech",
    content: "工程效率讨论",
    steps: 6,
    platform: "twitter",
    status: "done",
    created_at: "2026-07-03T08:00:00Z",
    totals: { replies: 5, reposts: 0, likes: 1 },
  },
];

const persons: PersonView[] = [
  {
    person: {
      person_id: "p_author",
      display_name: "财经观察员",
      persona_kind: "kol",
      accounts: [
        {
          account_id: "a_tw",
          person_id: "p_author",
          platform: "twitter",
          handle: "finance",
          avatar_seed: "p_author",
          num_followers: 100,
          influence_score: 20,
        },
        {
          account_id: "a_rd",
          person_id: "p_author",
          platform: "reddit",
          handle: "finance_rd",
          avatar_seed: "p_author",
          num_followers: 30,
          influence_score: 8,
        },
      ],
    },
    stance: { stance_counts: {}, dominant: "other" },
    total_influence: 56,
    run_ids: ["r_old", "r_new"],
    standing_timeline: [],
  },
];

test("groups persistent identities into world overview cards", () => {  // review:P11-T6-AC1
  const cards = groupWorldCards(identities, runs, { w_1: persons, w_2: [] });

  expect(cards).toHaveLength(2);
  expect(cards[0]).toMatchObject({
    worldId: "w_2",
    primaryIdentityName: "技术博主",
    identityCount: 1,
    runCount: 1,
    totalInfluence: 80,
    platformCount: 1,
    latestRunContent: "工程效率讨论",
  });
  expect(cards[1]).toMatchObject({
    worldId: "w_1",
    primaryIdentityName: "财经观察员",
    identityCount: 2,
    runCount: 3,
    totalInfluence: 68,
    platformCount: 2,
    latestRunContent: "AI 政策会改变商业模式吗",
    totals: { replies: 10, reposts: 3, likes: 7 },
  });
});
