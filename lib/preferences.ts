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

export function useTargetWeightKg(): number | null {
  const raw = useSyncExternalStore(subscribe, readTargetWeightRaw, () => null);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
