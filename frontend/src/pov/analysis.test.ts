import { describe, expect, test } from "vitest";

import { analysisTabs, insightCards, phaseCards } from "./analysis";
import type { AnalysisProjection } from "../api/client";

const projection: AnalysisProjection = {
  diffusion: {
    tree: [
      { post_id: 1, author_id: 10, depth: 0, children: [2] },
      { post_id: 2, author_id: 20, depth: 1, children: [3] },
      { post_id: 3, author_id: 30, depth: 2, children: [] },
    ],
    max_depth: 2,
    breadth: 1,
    cascade_size: 2,
    key_rebroadcasters: [20],
  },
  opinion: {
    stance_by_tick: [{ tick: "1", stance_counts: { question: 2, analysis: 1 } }],
    convergence_trend: "diverging",
    polarization_index: 0.82,
    homophily: 0.9,
    cross_stance_ratio: 0.1,
    echo_chamber_risk: "high",
  },
  influence: {
    ranking: [
      { actor_id: 20, in_degree: 5, centrality: 0.6, structural_influence: 0.6, kcore: 2 },
    ],
    top_leaders: [20],
    iterations: 18,
  },
  temporal: {
    fermentation_curve: [
      { tick: "1", volume: 2, sentiment: "positive" },
      { tick: "2", volume: 5, sentiment: "negative" },
      { tick: "3", volume: 2, sentiment: "negative" },
    ],
    peak_tick: 2,
    half_life_ticks: 1,
    sentiment_reversals: [{ tick: "2", from: "positive", to: "negative" }],
  },
};

describe("analysis view model", () => {
  test("insightCards translates metrics into creator-readable cards", () => {  // review:P8-T7
    const cards = insightCards(projection);
    const body = cards.map((card) => `${card.title} ${card.body}`).join("\n");

    expect(body).toContain("关键传播节点");
    expect(body).toContain("@20");
    expect(body).toContain("立场拐点");
    expect(body).toContain("第 2 拍");
    expect(body).toContain("走向极化");
    expect(body).toContain("半衰期约 1 拍");
  });

  test("phaseCards and tabs are deterministic", () => {  // review:P8-T7
    expect(analysisTabs.map((tab) => tab.label)).toEqual([
      "传播树",
      "立场分化",
      "影响力榜",
      "情绪时间线",
      "数据趋势",
    ]);
    expect(phaseCards(projection)[0].title).toBe("传播树深度 2 层");
  });
});
