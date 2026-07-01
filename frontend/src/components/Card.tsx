// review:PF0-T3
type Props = {
  children: React.ReactNode;
  interactive?: boolean;
};

export function Card({ children, interactive }: Props) {
  const base = "rounded-card border border-ink/10 bg-white p-4 transition";
  const hover = interactive ? "hover:shadow-spotlight hover:-translate-y-0.5" : "";
  return (
    <div data-testid="wg-card" className={`${base} ${hover}`}>
      {children}
    </div>
  );
}
