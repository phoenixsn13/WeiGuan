import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AppShell } from "./AppShell";
import { AppRoutes } from "./routes";

function at(path: string) {
  class FakeES {
    addEventListener() {}
    close() {}
  }
  vi.stubGlobal("EventSource", FakeES);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </MemoryRouter>,
  );
}

function mockCrowds() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: "review_crowd", name: "审核圈子", emoji: "R", blurb: "用于 shell 测试" },
      ],
    })),
  );
}

afterEach(() => vi.restoreAllMocks());
beforeEach(() => localStorage.clear());

test("shell shows brand wordmark", () => {  // review:PF0-T4-AC1
  at("/run/r_1/live");
  expect(screen.getByText("围观")).toBeInTheDocument();
});

test("root route renders gallery placeholder", async () => {  // review:PF0-T4-AC2
  mockCrowds();
  at("/");
  expect(screen.getByText(/选一个圈子/)).toBeInTheDocument();
  expect(await screen.findByText("审核圈子")).toBeInTheDocument();
});

test("live route renders live screen", () => {  // review:PF0-T4-AC3
  at("/run/r_1/live");
  expect(screen.getByText(/等待第一条/)).toBeInTheDocument();
});

test("shell navigation uses world-mind labels and links identity entry", () => {  // review:P7-T8-AC1
  at("/history");

  expect(screen.getByRole("link", { name: "发起" })).toHaveAttribute("href", "/compose");
  expect(screen.getByRole("link", { name: "世界" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "历史" })).toHaveAttribute("href", "/history");
  expect(screen.queryByRole("link", { name: "选圈子" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "历史记录" })).not.toBeInTheDocument();

  const identity = screen.getByRole("link", { name: "我" });
  expect(identity).toHaveAttribute("href", "/history");
});

test("shell identity entry uses current identity binding", () => {  // review:P7-T10-AC3
  localStorage.setItem("wg_current_person_id", "p_author");
  localStorage.setItem("wg_current_world_id", "w_1");

  at("/history");

  const identity = screen.getByRole("link", { name: "我" });
  expect(identity).toHaveAttribute("href", "/identity/p_author?world_id=w_1");
});
