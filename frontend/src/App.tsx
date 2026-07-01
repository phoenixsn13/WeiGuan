import { BrowserRouter } from "react-router-dom";

import { AppShell } from "./shell/AppShell";
import { AppRoutes } from "./shell/routes";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  );
}
