import type { Actor } from "../../model/canonical";

// review:P3-T3
export function XAvatar({
  actor,
  onClick,
}: {
  actor: Actor;
  onClick?: (actor: Actor) => void;
}) {
  const label = (actor.name || actor.user_name || "?").slice(0, 1);
  return (
    <button
      aria-label={`用户 ${actor.user_name ?? actor.user_id}`}
      onClick={() => onClick?.(actor)}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"
    >
      {label}
    </button>
  );
}
