const TOKEN = /(@[\u4e00-\u9fa5A-Za-z0-9_\-]{1,24}|#[^#\s]{1,24})/g;
const INTERNAL_NUMERIC_MENTION = /^@用户\d+$/;

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        (part.startsWith("@") && !INTERNAL_NUMERIC_MENTION.test(part)) || part.startsWith("#") ? (
          <span key={`${part}-${index}`} className="font-medium text-accent">
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}
