import type { Actor } from "../../model/canonical";

const DATASET_PREFIX = /^[\u4e00-\u9fa5A-Za-z]{1,8}\d{2}_/;

export function cleanProfileLabel(value?: string | null): string | null {
  const label = value?.trim();
  if (!label) return null;
  return label.replace(DATASET_PREFIX, "");
}

export function displayName(actor: Actor): string {
  return (
    cleanProfileLabel(actor.name) ??
    cleanProfileLabel(actor.user_name) ??
    `用户${actor.user_id}`
  );
}

export function displayHandle(actor: Actor): string | null {
  const handle = cleanProfileLabel(actor.user_name);
  if (!handle || /^\d+$/.test(handle)) return null;
  return handle;
}
