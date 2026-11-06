/** Mask a value for logs and the status report while keeping its shape recognisable. */
export function redact(value: string, { keep = 1 }: { keep?: number } = {}): string {
  if (value.length === 0) return "";
  if (value.length <= 2) return "•".repeat(value.length);
  const head = value.slice(0, keep);
  return `${head}${"•".repeat(Math.min(value.length - keep, 12))}`;
}

export const SECRET_PLACEHOLDER = "••••••••";
