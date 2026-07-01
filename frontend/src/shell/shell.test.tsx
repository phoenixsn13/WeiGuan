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

test("shell shows brand wordmark", () => {  // review:PF0-T4-AC1
  at("/");
  expect(screen.getByText("围观")).toBeInTheDocument();
});

test("root route renders gallery placeholder", () => {  // review:PF0-T4-AC2
  at("/");
  expect(screen.getByText(/选一个圈子/)).toBeInTheDocument();
});

test("live route renders live screen", () => {  // review:PF0-T4-AC3
  at("/run/r_1/live");
  expect(screen.getByText(/等待第一条/)).toBeInTheDocument();
});
