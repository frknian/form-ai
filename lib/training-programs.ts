// Antrenman ekranındaki program sistemi.
//
// Önceden ekranda iki ayrı şey vardı: üstte "hazır programlar" kartları, altta
// "günün antrenmanı" listesi. İkisi farklı hareketler gösterip aynı şeyi
// anlatıyor gibi duruyordu. Artık tek bir kavram var: PROGRAM.
//
//   • smart    — profil testinden yapay zekânın ürettiği program
//   • fullBody — tüm vücut; salon/ev ayrımı var
//   • split    — bölgesel; salon/ev ayrımı var
//   • custom   — kullanıcının hareket kütüphanesinden kendi kurduğu (3 slot)
//
// Salon/ev ayrımı ekipman profiline çevrilir: salonda salon kataloğu, evde
// kullanıcının GERÇEKTEN sahip olduğu ekipman (yoksa vücut ağırlığı).

import { detectUserEquipmentProfile, type EquipmentProfile } from "./ready-programs.ts";

export type ProgramKind = "smart" | "fullBody" | "split" | "custom";
export type TrainingPlace = "home" | "gym";

/** Kullanıcının kurabileceği program sayısı. */
export const CUSTOM_PROGRAM_SLOTS = 3;

export type CustomProgram = {
  /** Slot kimliği: "custom-1" … "custom-3". Sıra sabit kalsın diye slot bazlı. */
  id: string;
  name: string;
  /** Katalogdaki hareket adları. İsimle saklanır; katalog kimlikleri değişebilir. */
  exerciseNames: string[];
  updatedAt: string;
};

export function customSlotId(index: number): string {
  return `custom-${index + 1}`;
}

/** Salon/ev seçimini ekipman profiline çevirir. */
export function placeToProfile(place: TrainingPlace, equipmentText: string): EquipmentProfile {
  return place === "gym" ? "gym" : detectUserEquipmentProfile(false, equipmentText);
}

/**
 * Kaydedilmiş özel programları doğrular.
 *
 * Bozuk ya da eski biçimli kayıt uygulamayı çökertmemeli; tanınmayan her şey
 * atılır, slot sayısı tavanla sınırlanır.
 */
export function normalizeCustomPrograms(raw: unknown): CustomProgram[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const programs: CustomProgram[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const id = typeof value.id === "string" ? value.id : "";
    const name = typeof value.name === "string" ? value.name.trim().slice(0, 60) : "";
    const exerciseNames = Array.isArray(value.exerciseNames)
      ? [...new Set(value.exerciseNames.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== ""))].slice(0, 12)
      : [];
    if (!id || seen.has(id) || !exerciseNames.length) continue;
    seen.add(id);
    programs.push({
      id,
      name: name || id,
      exerciseNames,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    });
    if (programs.length >= CUSTOM_PROGRAM_SLOTS) break;
  }
  return programs;
}

/** Slotu ekler ya da aynı kimlikteki kaydı değiştirir. */
export function upsertCustomProgram(programs: CustomProgram[], next: CustomProgram): CustomProgram[] {
  const existing = programs.findIndex((program) => program.id === next.id);
  if (existing >= 0) {
    const copy = programs.slice();
    copy[existing] = next;
    return copy;
  }
  return [...programs, next].slice(0, CUSTOM_PROGRAM_SLOTS);
}

export function removeCustomProgram(programs: CustomProgram[], id: string): CustomProgram[] {
  return programs.filter((program) => program.id !== id);
}

/** Boş olan ilk slotun kimliği; hepsi doluysa null. */
export function nextFreeSlot(programs: CustomProgram[]): string | null {
  for (let index = 0; index < CUSTOM_PROGRAM_SLOTS; index += 1) {
    const id = customSlotId(index);
    if (!programs.some((program) => program.id === id)) return id;
  }
  return null;
}

// --- İlerleme takibi --------------------------------------------------------

export type ProgramProgress = {
  /** Bu programla tamamlanan seans sayısı. */
  sessions: number;
  lastCompletedAt: string | null;
};

export type ProgramLogEntry = { programKey: string; completedAt: string };

/**
 * Program anahtarı: aynı programın salon ve ev sürümü ayrı ilerler, çünkü
 * hareketleri ve yükleri farklıdır.
 */
export function programKey(kind: ProgramKind, place?: TrainingPlace, customId?: string): string {
  if (kind === "custom") return `custom:${customId ?? ""}`;
  if (kind === "smart") return "smart";
  return `${kind}:${place ?? "home"}`;
}

/** Kayıtlardan program başına seans sayısı ve son tarih. */
export function summarizeProgramProgress(entries: ProgramLogEntry[]): Record<string, ProgramProgress> {
  const summary: Record<string, ProgramProgress> = {};
  for (const entry of entries) {
    if (!entry?.programKey) continue;
    const current = summary[entry.programKey] ?? { sessions: 0, lastCompletedAt: null };
    current.sessions += 1;
    if (!current.lastCompletedAt || entry.completedAt > current.lastCompletedAt) current.lastCompletedAt = entry.completedAt;
    summary[entry.programKey] = current;
  }
  return summary;
}
