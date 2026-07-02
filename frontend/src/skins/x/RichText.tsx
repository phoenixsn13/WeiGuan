const TOKEN = /(@[\u4e00-\u9fa5A-Za-z0-9_\-]{1,24}|#[^#\s]{1,24})/g;

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("@") || part.startsWith("#") ? (
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
