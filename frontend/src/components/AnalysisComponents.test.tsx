import { render, screen } from "@testing-library/react";

import { CascadeTree } from "./CascadeTree";
import { InfluenceBoard } from "./InfluenceBoard";
import { SentimentTimeline } from "./SentimentTimeline";
import { StanceDistribution } from "./StanceDistribution";

test("analysis components render deterministic social metrics", () => {  // review:P8-T7
  render(
    <>
      <CascadeTree
        nodes={[
          { post_id: 1, author_id: 10, depth: 0, children: [2] },
          { post_id: 2, author_id: 20, depth: 1, children: [] },
        ]}
      />
      <StanceDistribution
        points={[{ tick: "1", stance_counts: { question: 2, analysis: 1 } }]}
        polarization={0.67}
      />
      <InfluenceBoard
        ranking={[{ actor_id: 20, in_degree: 5, centrality: 0.6, kcore: 2 }]}
      />
      <SentimentTimeline
        curve={[{ tick: "1", volume: 3, sentiment: "negative" }]}
        reversals={[{ tick: "1", from: "positive", to: "negative" }]}
      />
    </>,
  );

  expect(screen.getByText("原帖 @10")).toBeInTheDocument();
  expect(screen.getByText("负向 2")).toBeInTheDocument();
  expect(screen.getByText("@20")).toBeInTheDocument();
  expect(screen.getByText("第 1 拍")).toBeInTheDocument();
  expect(screen.getByText(/正向 → 负向/)).toBeInTheDocument();
});
