export type SportMetricKey = "distanceKm" | "elevationM" | "laps" | "rounds" | "sets" | "goals" | "points";

export type SportMetric = {
  key: SportMetricKey;
  label: string;
  unit: string;
  step?: string;
};

export type SportDefinition = {
  key: string;
  name: string;
  icon: string;
  guide: string;
  metrics: SportMetric[];
};

export const sportCatalog: SportDefinition[] = [
  { key: "running", name: "Koşu", icon: "KO", guide: "Açık hava veya koşu bandı koşusu", metrics: [{ key: "distanceKm", label: "Mesafe", unit: "km", step: "0.1" }] },
  { key: "cycling", name: "Bisiklet", icon: "Bİ", guide: "Yol, dağ veya sabit bisiklet", metrics: [{ key: "distanceKm", label: "Mesafe", unit: "km", step: "0.1" }, { key: "elevationM", label: "Tırmanış", unit: "m" }] },
  { key: "swimming", name: "Yüzme", icon: "YÜ", guide: "Havuz veya açık su antrenmanı", metrics: [{ key: "distanceKm", label: "Mesafe", unit: "km", step: "0.05" }, { key: "laps", label: "Havuz turu", unit: "tur" }] },
  { key: "football", name: "Futbol", icon: "FU", guide: "Maç, halı saha veya teknik çalışma", metrics: [{ key: "goals", label: "Gol", unit: "adet" }] },
  { key: "basketball", name: "Basketbol", icon: "BA", guide: "Maç veya şut/teknik antrenmanı", metrics: [{ key: "points", label: "Sayı", unit: "puan" }] },
  { key: "volleyball", name: "Voleybol", icon: "VO", guide: "Salon veya plaj voleybolu", metrics: [{ key: "sets", label: "Oynanan set", unit: "set" }] },
  { key: "tennis", name: "Tenis", icon: "TE", guide: "Tekler, çiftler veya kort çalışması", metrics: [{ key: "sets", label: "Oynanan set", unit: "set" }] },
  { key: "yoga", name: "Yoga", icon: "YO", guide: "Akış, mobilite veya nefes seansı", metrics: [] },
  { key: "pilates", name: "Pilates", icon: "Pİ", guide: "Mat veya reformer seansı", metrics: [] },
  { key: "boxing", name: "Boks", icon: "BO", guide: "Torba, gölge boksu veya sparring", metrics: [{ key: "rounds", label: "Raunt", unit: "raunt" }] },
  { key: "dance", name: "Dans", icon: "DA", guide: "Ders, prova veya serbest dans", metrics: [] },
  { key: "hiking", name: "Doğa yürüyüşü", icon: "DY", guide: "Parkur veya uzun mesafe yürüyüşü", metrics: [{ key: "distanceKm", label: "Mesafe", unit: "km", step: "0.1" }, { key: "elevationM", label: "Tırmanış", unit: "m" }] },
  { key: "rowing", name: "Kürek", icon: "KÜ", guide: "Su veya kürek ergometresi", metrics: [{ key: "distanceKm", label: "Mesafe", unit: "km", step: "0.1" }] },
  { key: "skiing", name: "Kayak", icon: "KA", guide: "Alp, kuzey veya salon kayağı", metrics: [{ key: "distanceKm", label: "Mesafe", unit: "km", step: "0.1" }, { key: "elevationM", label: "İniş/tırmanış", unit: "m" }] },
  { key: "table-tennis", name: "Masa tenisi", icon: "MT", guide: "Maç veya teknik çalışma", metrics: [{ key: "sets", label: "Oynanan set", unit: "set" }] },
];

export const activityIntensityOptions = ["Hafif", "Orta", "Yüksek"] as const;

export const coreActivityCatalog: SportDefinition[] = [
  { key: "walking", name: "Yürüyüş", icon: "YÜ", guide: "Günlük veya tempolu yürüyüş", metrics: [] },
  ...sportCatalog.filter((sport) => ["running", "cycling", "swimming"].includes(sport.key)),
];

export function sportByKey(key: string) {
  return sportCatalog.find((sport) => sport.key === key) || null;
}

export function validActivityDuration(value: string | number) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 1 && duration <= 1440;
}
