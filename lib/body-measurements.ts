export const circumferenceFields = ["waistCm", "hipsCm", "chestCm", "armCm", "thighCm"] as const;

export type CircumferenceField = typeof circumferenceFields[number];
export type MeasurementField = "weightKg" | CircumferenceField;
export type MeasurementRange = "7d" | "30d" | "90d" | "all";

export interface BodyMeasurement {
  id: string;
  measuredAt: string;
  weightKg: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  note: string | null;
}

export interface MeasurementSummary {
  latest: number;
  difference: number;
  percentage: number | null;
}

const rangeDays: Record<Exclude<MeasurementRange, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export const measurementLabels: Record<MeasurementField, string> = {
  weightKg: "Kilo",
  waistCm: "Bel",
  hipsCm: "Kalça",
  chestCm: "Göğüs",
  armCm: "Kol",
  thighCm: "Bacak",
};

export function sortMeasurements(records: BodyMeasurement[]) {
  return [...records].sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
}

export function filterMeasurements(records: BodyMeasurement[], range: MeasurementRange, referenceTime = Date.now()) {
  const sorted = sortMeasurements(records);
  if (range === "all") return sorted;
  const start = referenceTime - rangeDays[range] * 24 * 60 * 60 * 1000;
  return sorted.filter((record) => new Date(`${record.measuredAt}T23:59:59`).getTime() >= start);
}

export function getMeasurementSummary(records: BodyMeasurement[], field: MeasurementField): MeasurementSummary | null {
  const values = sortMeasurements(records)
    .map((record) => record[field])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  const first = values[0];
  const latest = values[values.length - 1];
  const difference = latest - first;
  return {
    latest,
    difference,
    percentage: first === 0 ? null : (difference / first) * 100,
  };
}

export function chartDomain(values: number[]) {
  if (!values.length) return { min: 0, max: 1 };
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum;
  const padding = spread === 0 ? Math.max(1, maximum * 0.03) : spread * 0.15;
  return { min: Math.max(0, minimum - padding), max: maximum + padding };
}

export function formatMeasurementValue(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}
