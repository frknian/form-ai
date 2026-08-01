"use client";

import { useSyncExternalStore } from "react";
import { notifyPreferenceChange } from "./preference-sync.ts";
import type { WeightUnit } from "./units";

const WEIGHT_UNIT_KEY = "fitai:weight-unit";

function readWeightUnit(): WeightUnit {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(WEIGHT_UNIT_KEY) === "lb" ? "lb" : "kg";
  } catch {
    return "kg";
  }
}

const listeners = new Set<() => void>();

export function setStoredWeightUnit(unit: WeightUnit) {
  try {
    localStorage.setItem(WEIGHT_UNIT_KEY, unit);
  } catch {
    // yerel depolama kapalıysa sessizce geç
  }
  listeners.forEach((listener) => listener());
  notifyPreferenceChange();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (typeof window !== "undefined") window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") window.removeEventListener("storage", callback);
  };
}

// Tüm bileşenlerde senkron kalan ağırlık birimi tercihi (localStorage tabanlı).
export function useWeightUnit(): WeightUnit {
  return useSyncExternalStore(subscribe, readWeightUnit, () => "kg");
}

// Hedef kilo. Profil tablosunda böyle bir alan yok; ağırlık birimiyle aynı
// yerel depoda tutulur ve oradan hesaba eşitlenir (components/PreferenceSync).
const TARGET_WEIGHT_KEY = "fitai:target-weight-kg";

function readTargetWeightRaw(): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(TARGET_WEIGHT_KEY) : null;
  } catch {
    return null;
  }
}

export function setStoredTargetWeightKg(weightKg: number | null) {
  try {
    if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) localStorage.removeItem(TARGET_WEIGHT_KEY);
    else localStorage.setItem(TARGET_WEIGHT_KEY, String(weightKg));
  } catch {
    // yerel depolama kapalıysa sessizce geç
  }
  listeners.forEach((listener) => listener());
  notifyPreferenceChange();
}

// Hedef planı cevapları (hedef kilo, haftalık gün, seans süresi, tempo).
// Ağırlık birimiyle aynı depoda: PreferenceSync bu anahtarı da hesaba
// eşitlediği için plan telefonda kurulup web'de görülebiliyor.
const GOAL_PLAN_KEY = "hedefit:goal-plan";

function readGoalPlanRaw(): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(GOAL_PLAN_KEY) : null;
  } catch {
    return null;
  }
}

export function setStoredGoalPlan(answers: unknown | null) {
  try {
    if (answers === null) localStorage.removeItem(GOAL_PLAN_KEY);
    else localStorage.setItem(GOAL_PLAN_KEY, JSON.stringify(answers));
  } catch {
    // yerel depolama kapalıysa plan yalnızca bu oturumda geçerli olur
  }
  listeners.forEach((listener) => listener());
  notifyPreferenceChange();
}

/** Ham JSON; çağıran normalizeAnswers ile doğrular. */
export function useStoredGoalPlan(): unknown | null {
  const raw = useSyncExternalStore(subscribe, readGoalPlanRaw, () => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Özel programlar ve program ilerleme günlüğü. İkisi de küçük JSON'lar;
// ayrı tablo açmak yerine tercih katmanında tutulur ve PreferenceSync ile
// cihazlar arasında eşitlenir.
function jsonPreference(key: string) {
  const read = () => {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const write = (value: unknown | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // yerel depolama kapalıysa değişiklik yalnız bu oturumda geçerli olur
    }
    listeners.forEach((listener) => listener());
    notifyPreferenceChange();
  };
  return { read, write };
}

const customProgramsStore = jsonPreference("hedefit:custom-programs");
const programLogStore = jsonPreference("hedefit:program-log");

export function setStoredCustomPrograms(programs: unknown) {
  customProgramsStore.write(programs);
}

export function useStoredCustomPrograms(): unknown {
  const raw = useSyncExternalStore(subscribe, customProgramsStore.read, () => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Program günlüğü sınırsız büyümesin: en yeni 200 kayıt tutulur. */
export function appendProgramLog(entry: { programKey: string; completedAt: string }) {
  let current: unknown[] = [];
  try {
    const raw = programLogStore.read();
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) current = parsed;
  } catch {
    current = [];
  }
  programLogStore.write([...current, entry].slice(-200));
}

export function useStoredProgramLog(): { programKey: string; completedAt: string }[] {
  const raw = useSyncExternalStore(subscribe, programLogStore.read, () => null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.programKey === "string") : [];
  } catch {
    return [];
  }
}

export function useTargetWeightKg(): number | null {
  const raw = useSyncExternalStore(subscribe, readTargetWeightRaw, () => null);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
