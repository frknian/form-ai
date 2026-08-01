"use client";

import { useSyncExternalStore } from "react";
import { notifyPreferenceChange } from "./preference-sync.ts";

// Ana ekrandaki kısayollar. Her biri bir görünüme gider ve gerekiyorsa o
// görünümdeki belirli bir bölüme kaydırır — kullanıcı "hazır programlar"a
// bastığında sayfanın altındaki bölümü kendisi aramasın.
//
// Seçim localStorage'da tutulur ve oturum açıkken hesaba eşitlenir
// (components/PreferenceSync.tsx), böylece her cihazda aynı kısayollar çıkar.

export type AppView = "plan" | "workout" | "progress" | "library" | "nutrition" | "calendar" | "profile";

export type QuickAction = {
  id: string;
  view: AppView;
  /** Görünüm açıldıktan sonra kaydırılacak öğenin id'si. */
  anchor?: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "startWorkout", view: "workout", anchor: "workout-plan-list" },
  { id: "readyPrograms", view: "workout", anchor: "ready-programs" },
  { id: "addMeal", view: "nutrition", anchor: "food-entry-panel" },
  { id: "water", view: "nutrition", anchor: "hydration-card" },
  { id: "progress", view: "progress" },
  { id: "calendar", view: "calendar" },
  { id: "library", view: "library" },
];

export const DEFAULT_QUICK_ACTION_IDS = ["startWorkout", "addMeal", "water", "calendar"];
const MAX_VISIBLE = 6;
const STORAGE_KEY = "hedefit:quick-actions";

const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Saklanan seçimi doğrular: bilinmeyen kimlikler atılır, boşsa varsayılana döner. */
export function parseQuickActionIds(raw: string | null): string[] {
  const known = new Set(QUICK_ACTIONS.map((action) => action.id));
  if (!raw) return DEFAULT_QUICK_ACTION_IDS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_QUICK_ACTION_IDS;
  }
  if (!Array.isArray(parsed)) return DEFAULT_QUICK_ACTION_IDS;
  const ids = [...new Set(parsed.filter((id): id is string => typeof id === "string" && known.has(id)))];
  return ids.length ? ids.slice(0, MAX_VISIBLE) : DEFAULT_QUICK_ACTION_IDS;
}

export function setStoredQuickActionIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_VISIBLE)));
  } catch {
    // yerel depolama kapalıysa seçim yalnızca bu oturumda geçerli olur
  }
  listeners.forEach((listener) => listener());
  notifyPreferenceChange();
}

/** Kısayolu açıp kapatır; en az bir tanesi açık kalır. */
export function toggleQuickActionId(current: string[], id: string): string[] {
  if (current.includes(id)) {
    const next = current.filter((value) => value !== id);
    return next.length ? next : current;
  }
  if (current.length >= MAX_VISIBLE) return current;
  return [...current, id];
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (typeof window !== "undefined") window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") window.removeEventListener("storage", callback);
  };
}

export function useQuickActionIds(): string[] {
  // Sunucu anlık görüntüsü sabit varsayılandır; localStorage yalnız istemcide
  // okunabildiği için doğrudan okumak hydration uyuşmazlığı yaratırdı.
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return parseQuickActionIds(raw);
}
