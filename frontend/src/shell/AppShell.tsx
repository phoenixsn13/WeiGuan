// review:PF0-T4
import { NavLink } from "react-router-dom";

import { getCurrentIdentity } from "../api/useApiKey";
import { BellIcon, BrandGlyph } from "../components/icons";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          "flex min-h-12 items-center border-b-2 px-3 text-sm font-semibold transition",
          isActive
            ? "border-brand text-white"
            : "border-transparent text-white/80 hover:text-white",
        ].join(" ")
      }
      to={to}
    >
      {children}
    </NavLink>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <BrandGlyph className="h-8 w-8 shrink-0" />
      <span className="whitespace-nowrap text-xl font-black tracking-normal text-white">
        围观
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // review:P7-T10
  const currentIdentity = getCurrentIdentity();
  const identityHref = currentIdentity
    ? `/identity/${currentIdentity.personId}?world_id=${currentIdentity.worldId}`
    : "/history";
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950 shadow-chrome">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6">
          <BrandMark />
          {/* review:P7-T8 */}
          <nav className="hidden h-16 items-stretch gap-1 md:flex">
            <NavItem to="/compose">发起</NavItem>
            <NavItem to="/worlds">世界</NavItem>
            <NavItem to="/history">历史</NavItem>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 sm:flex">
              <span className="h-2 w-2 rounded-full bg-sentiment-positive" />
              只在你发起时推演
            </div>
            <NavLink
              aria-label="通知"
              className="hidden h-9 w-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white md:grid"
              to="/history"
            >
              <BellIcon className="h-5 w-5" />
            </NavLink>
            <NavLink
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white transition hover:bg-white/15"
              to={identityHref}
            >
              我
            </NavLink>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6 lg:py-5">
        {children}
      </main>
    </div>
  );
}
