// review:PF0-T4
import { Link } from "react-router-dom";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 whitespace-nowrap font-display text-xl">围观</span>
          <span className="hidden truncate text-xs text-ink/50 md:inline">
            把你的内容，先扔给一群人围观一下
          </span>
        </div>
        <nav className="flex shrink-0 items-center gap-3 text-xs text-ink/60 sm:text-sm">
          <Link className="whitespace-nowrap hover:text-accent" to="/">
            选圈子
          </Link>
          <Link className="whitespace-nowrap hover:text-accent" to="/history">
            历史记录
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
