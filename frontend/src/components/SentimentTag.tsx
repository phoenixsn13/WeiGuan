import { sentimentColor, type Sentiment } from "../design/tokens";

// review:PF0-T3
type Props = {
  kind: Sentiment;
  label: string;
};

export function SentimentTag({ kind, label }: Props) {
  const isGradient = kind === "contested";
  const style = isGradient
    ? {
        background: sentimentColor(kind),
        WebkitBackgroundClip: "text",
        color: "transparent" as const,
      }
    : { color: sentimentColor(kind) };

  return (
    <span className="text-xs font-body" style={style}>
      {label}
    </span>
  );
}
