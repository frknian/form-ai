"use client";

import { tr } from "./dictionaries/tr.ts";
import { en } from "./dictionaries/en.ts";
import { useLocale, type Locale } from "./locale.ts";

const dictionaries: Record<Locale, typeof tr> = { tr, en };

export function useTranslations() {
  const locale = useLocale();
  return dictionaries[locale];
}

export type Dictionary = typeof tr;

// Zorluk ve ağrı bölgesi değerleri veritabanında/iş mantığında Türkçe kanonik
// olarak saklanır (ör. workout_sessions.difficulty CHECK kısıtı, pain.includes("diz")
// eşleştirmesi). Bu yardımcılar yalnızca GÖSTERİLEN etiketi çevirir, saklanan
// değeri değiştirmez.
export function translateDifficulty(t: Dictionary, value: string): string {
  if (value === "Kolay") return t.feedback.difficultyEasy;
  if (value === "Uygun") return t.feedback.difficultySuitable;
  if (value === "Zor") return t.feedback.difficultyHard;
  return value;
}

export function translateIntensity(t: Dictionary, value: string): string {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (normalized === "hafif") return t.activityLogger.intensityLight;
  if (normalized === "orta") return t.activityLogger.intensityMedium;
  if (normalized === "yüksek" || normalized === "yuksek") return t.activityLogger.intensityHigh;
  return value;
}

export function translateMeasurementLabel(t: Dictionary, field: "weightKg" | "waistCm" | "hipsCm" | "chestCm" | "armCm" | "thighCm"): string {
  if (field === "weightKg") return t.measurements.weightLabel;
  if (field === "waistCm") return t.measurements.waistLabel;
  if (field === "hipsCm") return t.measurements.hipsLabel;
  if (field === "chestCm") return t.measurements.chestLabel;
  if (field === "armCm") return t.measurements.armLabel;
  return t.measurements.thighLabel;
}

export function translateGender(t: Dictionary, value: string): string {
  if (value === "Kadın") return t.onboarding.genderFemale;
  if (value === "Erkek") return t.onboarding.genderMale;
  if (value === "Belirtmek istemiyorum") return t.onboarding.genderPreferNotToSay;
  return value;
}

export function translateMeal(t: Dictionary, value: string): string {
  if (value === "Kahvaltı") return t.calorieTracker.mealBreakfast;
  if (value === "Öğle yemeği") return t.calorieTracker.mealLunch;
  if (value === "Akşam yemeği") return t.calorieTracker.mealDinner;
  if (value === "Atıştırmalık") return t.calorieTracker.mealSnack;
  return value;
}

export function translateFoodSource(t: Dictionary, value: string): string {
  if (value === "Barkod") return t.calorieTracker.sourceBarcode;
  if (value === "Fotoğraf") return t.calorieTracker.sourcePhoto;
  if (value === "Manuel") return t.calorieTracker.sourceManual;
  return value;
}

export function translatePainArea(t: Dictionary, value: string): string {
  if (value === "Yok") return t.feedback.painNone;
  if (value === "Bel") return t.feedback.painLowerBack;
  if (value === "Diz") return t.feedback.painKnee;
  if (value === "Omuz") return t.feedback.painShoulder;
  if (value === "Diğer") return t.feedback.painOther;
  return value;
}
