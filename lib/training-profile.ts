export function extractSessionMinutes(value: unknown, fallback = 30) {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLocaleLowerCase("tr-TR").replace(",", ".");
  const hours = normalized.match(/(\d+(?:\.\d+)?)\s*(?:saat|hour)/i);
  if (hours) return Math.min(180, Math.max(10, Math.round(Number(hours[1]) * 60)));
  const minutes = normalized.match(/(\d{1,3})\s*(?:dakika|dk\b|minute|min\b)/i)
    || normalized.match(/(?:dakika|dk\b|minute|min\b)\s*(\d{1,3})/i);
  if (minutes) return Math.min(180, Math.max(10, Number(minutes[1])));
  const plausible = [...normalized.matchAll(/\d{1,3}/g)].map((match) => Number(match[0])).find((number) => number >= 10 && number <= 180);
  return plausible ?? fallback;
}
