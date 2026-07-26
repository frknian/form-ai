"use client";

import { useSyncExternalStore } from "react";
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
