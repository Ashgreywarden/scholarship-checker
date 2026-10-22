export function formatDate(value: string | null): string {
  if (!value) return "Date not confirmed";

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Date not confirmed";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Only http(s) links are ever rendered as links.
export function officialUrl(value: string | null): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
