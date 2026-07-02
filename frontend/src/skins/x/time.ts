function numericTime(value?: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parsedTime(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function socialLabelFromMinutes(minutes: number): string {
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}小时前`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}天前`;
  return `${Math.floor(minutes / (60 * 24 * 7))}周前`;
}

export function relativeSocialTime(value?: string | null, nowValue?: string | null): string {
  const numeric = numericTime(value);
  const numericNow = numericTime(nowValue);
  if (numeric != null && numericNow != null) {
    return socialLabelFromMinutes(Math.max(0, Math.floor(numericNow - numeric)));
  }

  const parsed = parsedTime(value);
  if (parsed == null) return "刚刚";
  const parsedNow = parsedTime(nowValue) ?? Date.now();
  return socialLabelFromMinutes(Math.max(0, Math.floor((parsedNow - parsed) / 60000)));
}

export function latestSocialTime(values: Array<string | null | undefined>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  if (present.length === 0) return null;

  const numericValues = present.map(numericTime);
  if (numericValues.every((value): value is number => value != null)) {
    return String(Math.max(...numericValues));
  }

  let latestValue = present[0];
  let latestRank = parsedTime(latestValue) ?? Number.NEGATIVE_INFINITY;
  for (const value of present.slice(1)) {
    const rank = parsedTime(value) ?? Number.NEGATIVE_INFINITY;
    if (rank >= latestRank) {
      latestValue = value;
      latestRank = rank;
    }
  }
  return latestValue;
}
