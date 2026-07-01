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
  const hue = (actor.user_id * 47) % 360;
  return (
    <button
      aria-label={`用户 ${actor.user_name ?? actor.user_id}`}
      onClick={() => onClick?.(actor)}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white text-sm font-semibold text-white shadow-sm transition hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-accent/40"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 62% 44%), hsl(${(hue + 34) % 360} 72% 30%))`,
      }}
    >
      {label}
    </button>
  );
}
