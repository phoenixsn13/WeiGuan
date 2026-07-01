import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import HistoryScreen from "./HistoryScreen";

afterEach(() => vi.restoreAllMocks());

function LocationProbe() {
  const location = useLocation();
  return <div>{`评论区${location.search}`}</div>;
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/run/:id/live" element={<LocationProbe />} />
        <Route path="/run/:id/retro" element={<div>回放页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("renders historical runs and opens live view", async () => {  // review:UI-P1-AC3
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          run_id: "r_1",
          content: "构建砍到3秒",
          steps: 6,
          platform: "twitter",
          status: "done",
          totals: { replies: 3, reposts: 1, likes: 8 },
        },
      ],
    })),
  );

  mount();

  expect(await screen.findByText("历史记录")).toBeInTheDocument();
  expect(screen.getByText("构建砍到3秒")).toBeInTheDocument();
  fireEvent.click(screen.getByText("看评论区"));
  expect(screen.getByText("评论区?replay=1")).toBeInTheDocument();
});

test("opens replay from historical run", async () => {  // review:UI-P1-AC4
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          run_id: "r_1",
          content: "构建砍到3秒",
          steps: 6,
          platform: "twitter",
          status: "done",
          totals: { replies: 3, reposts: 1, likes: 8 },
        },
      ],
    })),
  );

  mount();

  fireEvent.click(await screen.findByText("看回放"));
  expect(screen.getByText("回放页")).toBeInTheDocument();
});
