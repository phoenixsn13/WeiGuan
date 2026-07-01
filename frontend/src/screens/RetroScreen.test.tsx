import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RetroScreen from "./RetroScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function mount() {
  render(
    <MemoryRouter initialEntries={["/run/r_1/retro"]}>
      <Routes>
        <Route path="/run/:id/retro" element={<RetroScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("renders sentiment from retro metrics", async () => {  // review:P5-T5-AC1
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        sentiment: { positive: 5, negative: 2, neutral: 3 },
        spread_by_step: [1, 3, 2],
        totals: { reposts: 1, reports: 1 },
      }),
    })),
  );
  mount();
  expect(await screen.findByText(/正向/)).toBeInTheDocument();
  expect(screen.getByText(/50%/)).toBeInTheDocument();
});

test("generate insights shows verdict and suggestions", async () => {  // review:P5-T5-AC2
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sentiment: { positive: 1, negative: 0, neutral: 0 },
        spread_by_step: [1],
        totals: {},
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdict: "偏正向但有暗线",
        suggestions: ["加冷启动实测", "盯硬核用户"],
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  mount();
  await screen.findByText(/正向/);
  fireEvent.click(screen.getByText(/生成建议/));
  expect(await screen.findByText("偏正向但有暗线")).toBeInTheDocument();
  expect(screen.getByText("加冷启动实测")).toBeInTheDocument();
});
