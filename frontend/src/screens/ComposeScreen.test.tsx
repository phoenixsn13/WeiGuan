import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ComposeScreen from "./ComposeScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function mount() {
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: "/compose", state: { audience: { crowd_id: "tech_devs" } } },
      ]}
    >
      <Routes>
        <Route path="/compose" element={<ComposeScreen />} />
        <Route path="/run/:id/live" element={<div>进行时页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("submits content and navigates to live", async () => {  // review:P4-T6-AC1
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ run_id: "r_9" }),
  }));
  vi.stubGlobal("fetch", spy);
  mount();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "构建砍到3秒" },
  });
  fireEvent.click(screen.getByText(/开始围观/));
  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  const [, init] = spy.mock.calls[0] as unknown as [unknown, RequestInit];
  const body = JSON.parse(init.body as string);
  expect(body.content).toBe("构建砍到3秒");
  expect(body.steps).toBe(10);
});

test("shows error when create fails", async () => {  // review:P4-T6-AC2
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ detail: "missing X-LLM-Key" }),
    })),
  );
  localStorage.clear();
  mount();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), {
    target: { value: "hi" },
  });
  fireEvent.click(screen.getByText(/开始围观/));
  expect(await screen.findByText(/missing X-LLM-Key/)).toBeInTheDocument();
});
