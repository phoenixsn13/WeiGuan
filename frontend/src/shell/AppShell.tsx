// review:PF0-T4
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="flex items-center justify-between border-b border-ink/10 px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl">围观</span>
          <span className="text-xs text-ink/50">
            把你的内容，先扔给一群人围观一下
          </span>
        </div>
        <button className="text-xs text-ink/50 hover:text-brand" aria-label="主题切换">
          ◐
        </button>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
