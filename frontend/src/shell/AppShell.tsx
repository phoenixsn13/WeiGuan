// review:PF0-T4
import { NavLink } from "react-router-dom";

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
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-slate-950">
        <span className="h-3 w-3 rounded-full border-[3px] border-slate-950" />
      </span>
      <span className="whitespace-nowrap text-xl font-black tracking-normal text-white">
        围观
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950 shadow-chrome">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6">
          <BrandMark />
          <nav className="hidden h-16 items-stretch gap-1 md:flex">
            <NavItem to="/">选圈子</NavItem>
            <NavItem to="/history">历史记录</NavItem>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 sm:flex">
              <span className="h-2 w-2 rounded-full bg-sentiment-positive" />
              只在你发起时推演
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white">
              我
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6 lg:py-5">
        {children}
      </main>
    </div>
  );
}
