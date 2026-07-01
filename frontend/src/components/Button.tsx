// review:PF0-T3
type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
};

export function Button({ children, onClick, variant = "primary" }: Props) {
  const base = "rounded-card px-4 py-2 font-body text-sm transition";
  const style =
    variant === "primary"
      ? "bg-brand text-ink hover:brightness-105"
      : "bg-transparent text-ink border border-ink/15 hover:border-brand";
  return (
    <button className={`${base} ${style}`} onClick={onClick}>
      {children}
    </button>
  );
}
