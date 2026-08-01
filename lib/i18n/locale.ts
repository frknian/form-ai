"use client";

import { useSyncExternalStore } from "react";
import { notifyPreferenceChange } from "../preference-sync.ts";

export type Locale = "tr" | "en";

const LOCALE_KEY = "hedefit:locale";
const listeners = new Set<() => void>();

function detectDefaultLocale(): Locale {
  try {
    const lang = typeof navigator !== "undefined" ? navigator.language : "tr";
    return lang.toLocaleLowerCase("en-US").startsWith("en") ? "en" : "tr";
  } catch {
    return "tr";
  }
}

function readLocale(): Locale {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_KEY) || localStorage.getItem("fitai:locale") : null;
    return stored === "en" || stored === "tr" ? stored : detectDefaultLocale();
  } catch {
    return "tr";
  }
}

export function setStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // yerel depolama kapalıysa sessizce geç
  }
  // <html lang> hemen güncellenmezse CSS text-transform:uppercase Türkçe
  // büyük harf kurallarını uygulamaya devam eder (ör. İngilizce "i" → "İ").
  if (typeof document !== "undefined") document.documentElement.lang = locale;
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

// Tüm bileşenlerde senkron kalan dil tercihi (localStorage tabanlı, tarayıcı diline göre varsayılan).
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, () => "tr");
}
