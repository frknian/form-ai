"use client";

import { Camera, ChevronLeft, ChevronRight, ImagePlus, Plus, Sparkles, Trash2, Utensils } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { NutritionGoalsPanel } from "@/components/NutritionGoalsPanel";
import { HydrationFasting } from "@/components/HydrationFasting";
import { frequentMeals } from "@/lib/frequent-meals";
import { HOUSEHOLD_PORTION_UNITS, PRIMARY_PORTION_UNITS, fromGrams, needsAnalysis, referenceGrams, toGrams, type PortionUnit } from "@/lib/portion-unit";
import { emptyFoodNutrition, scaleFoodNutrition, type FoodMicronutrients, type FoodNutrition } from "@/lib/food-search";
import { calculateNutritionGoal, calculateWeeklyWeightTrend, inferNutritionGoal, sanitizeNutritionGoal, type NutritionGoal, type NutritionGoalType, type WeightTrend } from "@/lib/nutrition-goals";
import { clearPendingFoodPhoto, isNativeApp, listenForRestoredFoodPhoto, mobileImpact, takeFoodPhoto, usePendingFoodPhoto } from "@/lib/mobile";
import { createClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/streak";
import { authorizedFetch } from "@/lib/api-client";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";
type Meal = "Kahvaltı" | "Öğle yemeği" | "Akşam yemeği" | "Atıştırmalık";
type FoodEntry = { id: string; name: string; meal: Meal; calories: number; protein: number; carbs: number; fat: number; fiber?: number; grams?: number; micros?: FoodMicronutrients; time: string; consumedAt: string; source: "Fotoğraf" | "AI analizi"; isEstimated?: boolean; confidence?: number | null };

interface CalorieTrackerProps {
  userId?: string;
  bmr?: number;
  tdee?: number;
  weightKg?: number;
  activityFactor?: number;
  workoutDays?: number;
  profileGoal?: string;
}

const meals: Meal[] = ["Kahvaltı", "Öğle yemeği", "Akşam yemeği", "Atıştırmalık"];

function portionUnitLabel(t: ReturnType<typeof useTranslations>, unit: PortionUnit) {
  const labels: Record<PortionUnit, string> = {
    g: t.calorieTracker.portionUnitGram,
    ml: t.calorieTracker.portionUnitMl,
    teaGlass: t.calorieTracker.portionUnitTeaGlass,
    waterGlass: t.calorieTracker.portionUnitWaterGlass,
    mug: t.calorieTracker.portionUnitMug,
    plate: t.calorieTracker.portionUnitPlate,
    bowl: t.calorieTracker.portionUnitBowl,
    portion: t.calorieTracker.portionUnitPortion,
    piece: t.calorieTracker.portionUnitPiece,
  };
  return labels[unit];
}

function normalizeFoodSource(value: unknown): FoodEntry["source"] {
  return value === "Fotoğraf" || value === "Photo" ? "Fotoğraf" : "AI analizi";
}

function todayLabel(offset: number, dateLocale: string) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat(dateLocale, { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function CalorieTracker({ userId, bmr = 1600, tdee = 2100, weightKg = 70, activityFactor = 1.375, workoutDays = 3, profileGoal = "" }: CalorieTrackerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "tr-TR";
  const inferredGoal = inferNutritionGoal(profileGoal);
  const recommendedGoals = useMemo(() => Object.fromEntries((["lose", "fatLoss", "maintain", "gain"] as NutritionGoalType[]).map((goalType) => [goalType, calculateNutritionGoal({ goalType, bmr, tdee, weightKg, activityFactor, workoutDays })])) as Record<NutritionGoalType, NutritionGoal>, [activityFactor, bmr, tdee, weightKg, workoutDays]);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal>(() => calculateNutritionGoal({ goalType: inferredGoal, bmr, tdee, weightKg, activityFactor, workoutDays }));
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  // Trend en az 2 ölçüm ve 5 gün ister. İlk hafta boyunca panel yalnızca
  // "Ölçüm bekleniyor" diyordu; kullanıcının neyi beklediğini görebilmesi için
  // ilerlemeyi ayrıca taşıyoruz.
  const [trendProgress, setTrendProgress] = useState<{ count: number; daysLeft: number } | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  // Kamera dönüşünde süreç öldürülmüşse kullanıcı fotoğraf adımındaydı; oraya
  // geri getiriyoruz. Elle bir yöntem seçilirse o kazanır.
  const pendingFoodPhoto = usePendingFoodPhoto();
  const [chosenMethod, setChosenMethod] = useState<"text" | "photo" | null>(null);
  const activeMethod = chosenMethod ?? (pendingFoodPhoto ? "photo" : "text");
  const setActiveMethod = setChosenMethod;
  const [meal, setMeal] = useState<Meal>("Atıştırmalık");
  const [foodName, setFoodName] = useState("");
  const [grams, setGrams] = useState("100");
  const [portionUnit, setPortionUnit] = useState<PortionUnit>("g");
  // AI'ın analiz ettiği toplam gramaj. Porsiyon ve adet referansları bundan
  // türetilir; bilinmeden bu birimler anlamlı bir gram üretemeyeceği için
  // arayüzde de sunulmazlar.
  const [analysedGrams, setAnalysedGrams] = useState<number | null>(null);
  const [unitAmount, setUnitAmount] = useState("1");
  const [nutrition, setNutrition] = useState<FoodNutrition>(emptyFoodNutrition);
  const [aiEstimate, setAiEstimate] = useState<{ grams: number; items: string[]; confidence: "low" | "medium" | "high" } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [message, setMessage] = useState("");
  const [mealAdvice, setMealAdvice] = useState("");
  const [mealAdviceLoading, setMealAdviceLoading] = useState(false);
  const [mealAdviceSource, setMealAdviceSource] = useState<"ai" | "fallback">("fallback");
  const [adviceRevision, setAdviceRevision] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateOffset, setDateOffset] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("fit-ai-calorie-entries");
        if (saved) {
          const parsed = JSON.parse(saved) as FoodEntry[];
          if (Array.isArray(parsed)) setEntries(parsed.map((entry) => ({ ...entry, source: normalizeFoodSource(entry.source), consumedAt: entry.consumedAt || new Date().toISOString() })));
        }
      } catch { /* Bozuk yerel veri yeni ve boş bir günlükle değiştirilir. */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("fit-ai-calorie-entries", JSON.stringify(entries));
  }, [entries, storageReady]);

  useEffect(() => () => {
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  // --- Kamera dönüşünde süreç öldürülmüşse fotoğrafı kurtar ---------------
  //
  // Android, kamera öndeyken barındıran Activity'yi öldürebiliyor: WebView
  // sıfırdan yükleniyor, takeFoodPhoto'nun sözü hiç çözülmüyor ve kullanıcı
  // uygulamayı baştan açılmış buluyordu — çektiği fotoğraf kayboluyordu.
  // Capacitor bu sonucu yeniden açılışta appRestoredResult ile bir kez
  // yayınlar; aşağıdaki dinleyici onu yakalayıp analize sokar.
  const analyzeRef = useRef<(photoDataUrl: string) => Promise<void>>(async () => undefined);
  useEffect(() => listenForRestoredFoodPhoto((dataUrl) => {
    // Yöntemi sabitle: işaret birazdan temizlenecek ve seçim ona bağlı
    // kalsaydı kullanıcı analiz tam başlarken metin adımına geri atılırdı.
    setChosenMethod("photo");
    void analyzeRef.current(dataUrl);
  }), []);

  // Sonuç hiç gelmezse (vazgeçildi ya da dosya okunamadı) işaret asılı kalıp
  // beslenme sekmesini her açılışta fotoğraf adımına kilitlemesin.
  useEffect(() => {
    if (!pendingFoodPhoto) return;
    const timer = setTimeout(clearPendingFoodPhoto, 8_000);
    return () => clearTimeout(timer);
  }, [pendingFoodPhoto]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadEntries() {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase.from("food_entries").select("*").order("consumed_at", { ascending: false }).limit(100);
      if (cancelled || !data) return;
      setEntries(data.map((entry) => {
        const metadata = entry.metadata && typeof entry.metadata === "object" ? entry.metadata as Record<string, unknown> : {};
        return {
          id: String(entry.id),
          name: String(entry.name),
          meal: entry.meal as Meal,
          calories: Number(entry.calories),
          protein: Number(entry.protein_g),
          carbs: Number(entry.carbs_g),
          fat: Number(entry.fat_g),
          fiber: Number(entry.fiber_g ?? metadata.fiber ?? 0),
          grams: Number(entry.grams ?? metadata.portionGrams ?? 0) || undefined,
          micros: entry.micros && typeof entry.micros === "object"
            ? entry.micros as FoodMicronutrients
            : metadata.micros && typeof metadata.micros === "object" ? metadata.micros as FoodMicronutrients : undefined,
          time: new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(String(entry.consumed_at))),
          consumedAt: String(entry.consumed_at),
          source: normalizeFoodSource(entry.source),
          isEstimated: Boolean(entry.is_estimated),
          confidence: entry.confidence === null ? null : Number(entry.confidence),
        };
      }));
    }
    void loadEntries();
    return () => { cancelled = true; };
  }, [userId, dateLocale]);

  useEffect(() => {
    let cancelled = false;
    const fallback = recommendedGoals[inferredGoal];
    if (!userId) {
      queueMicrotask(() => { if (!cancelled) setNutritionGoal(fallback); });
      return () => { cancelled = true; };
    }
    async function loadNutritionGoal() {
      const supabase = createClient();
      if (!supabase) return;
      const [{ data: savedGoal }, { data: measurements }] = await Promise.all([
        supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("body_measurements").select("measured_at, weight_kg").eq("user_id", userId).not("weight_kg", "is", null).order("measured_at", { ascending: true }).limit(24),
      ]);
      if (cancelled) return;
      const parsed = savedGoal ? sanitizeNutritionGoal({ goalType: savedGoal.goal_type, calorieTarget: savedGoal.calorie_target, proteinGrams: savedGoal.protein_g, carbsGrams: savedGoal.carbs_g, fatGrams: savedGoal.fat_g, bmr: savedGoal.bmr, tdee: savedGoal.tdee, calorieAdjustment: savedGoal.calorie_adjustment, activityFactor: savedGoal.activity_factor, workoutDays: savedGoal.workout_days, isManual: savedGoal.is_manual }) : null;
      setNutritionGoal(parsed || fallback);
      const weights = (measurements || []).map((item) => ({ measuredAt: String(item.measured_at), weightKg: item.weight_kg === null ? null : Number(item.weight_kg) }));
      const trend = calculateWeeklyWeightTrend(weights);
      setWeightTrend(trend);
      if (trend) setTrendProgress(null);
      else {
        const valid = weights.filter((item) => typeof item.weightKg === "number");
        const first = valid[0]?.measuredAt;
        const spanDays = first ? Math.round((Date.now() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000) : 0;
        setTrendProgress({ count: valid.length, daysLeft: Math.max(0, 5 - spanDays) });
      }
    }
    void loadNutritionGoal();
    return () => { cancelled = true; };
  }, [inferredGoal, recommendedGoals, userId]);

  // Tek dokunuşla tekrar ekleme önerileri; AI kullanmaz, yalnızca kendi geçmişin.
  const regulars = useMemo(() => frequentMeals(entries, { today: localDateKey() }), [entries]);

  async function addFrequentMeal(key: string) {
    const found = regulars.find((item) => item.key === key);
    if (!found) return;
    const { name, meal: mealType, calories, protein, carbs, fat, fiber, grams, micros, source, confidence } = found.entry;
    await addEntry({ name, meal: mealType, calories, protein, carbs, fat, fiber, grams, micros, source, isEstimated: true, confidence });
    setMessage(t.frequentMeals.added(name));
  }

  const selectedDate = useMemo(() => { const date = new Date(); date.setDate(date.getDate() + dateOffset); return localDateKey(date); }, [dateOffset]);
  const dailyEntries = useMemo(() => entries.filter((entry) => localDateKey(new Date(entry.consumedAt)) === selectedDate), [entries, selectedDate]);
  const totals = useMemo(() => dailyEntries.reduce((total, entry) => ({ calories: total.calories + entry.calories, protein: total.protein + entry.protein, carbs: total.carbs + entry.carbs, fat: total.fat + entry.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [dailyEntries]);
  const remaining = Math.max(0, nutritionGoal.calorieTarget - totals.calories);
  // Hedef aşıldığında yüzde 100'de sabitlenip "kalan 0" göstermek, aşımı
  // hedefe tam ulaşmaktan ayırt edilemez hâle getiriyordu. Aşım miktarını ayrı
  // tutuyoruz ki kullanıcı ne kadar geçtiğini görebilsin.
  const overBy = Math.max(0, totals.calories - nutritionGoal.calorieTarget);
  const rawProgress = Math.round((totals.calories / Math.max(1, nutritionGoal.calorieTarget)) * 100);
  const progress = Math.min(100, rawProgress);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMealAdviceLoading(true);
      try {
        const response = await authorizedFetch("/api/nutrition/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calorieTarget: nutritionGoal.calorieTarget, proteinTarget: nutritionGoal.proteinGrams, carbsTarget: nutritionGoal.carbsGrams, fatTarget: nutritionGoal.fatGrams, totals, meals: dailyEntries.map(({ name, meal: mealName, calories, protein, carbs, fat }) => ({ name, meal: mealName, calories, protein, carbs, fat })), locale }),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({})) as { advice?: string; source?: "ai" | "fallback" };
        if (!controller.signal.aborted && result.advice) {
          setMealAdvice(result.advice);
          setMealAdviceSource(result.source === "ai" ? "ai" : "fallback");
        }
      } catch {
        if (!controller.signal.aborted) setMealAdvice(t.calorieTracker.mealAdviceUnavailable);
      } finally {
        if (!controller.signal.aborted) setMealAdviceLoading(false);
      }
    }, adviceRevision ? 0 : 650);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [adviceRevision, dailyEntries, nutritionGoal.calorieTarget, nutritionGoal.carbsGrams, nutritionGoal.fatGrams, nutritionGoal.proteinGrams, selectedDate, totals, t, locale]);

  async function addEntry(entry: Omit<FoodEntry, "id" | "time" | "consumedAt">) {
    const now = new Date();
    const temporaryId = crypto.randomUUID();
    const record = { ...entry, id: temporaryId, time: new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(now), consumedAt: now.toISOString() };
    setEntries((current) => [record, ...current]);
    if (userId) {
      const inputMethod = record.source === "Fotoğraf" ? "photo" : "natural_language";
      const response = await authorizedFetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodId: null,
          loggedDate: selectedDate,
          mealType: record.meal,
          foodName: record.name,
          portionGrams: record.grams || 100,
          calories: record.calories,
          protein: record.protein,
          carbohydrates: record.carbs,
          fat: record.fat,
          fiber: record.fiber || 0,
          inputMethod,
          confidence: record.confidence ?? (aiEstimate ? (aiEstimate.confidence === "high" ? 0.9 : aiEstimate.confidence === "medium" ? 0.7 : 0.45) : null),
          isEstimated: Boolean(record.isEstimated || aiEstimate),
          metadata: { micros: record.micros || {}, aiEstimated: Boolean(aiEstimate) },
        }),
      });
      const result = await response.json().catch(() => ({})) as { log?: { id?: string } };
      if (!response.ok) setMessage(t.calorieTracker.syncedLocallyOnly);
      else if (result.log?.id) setEntries((current) => current.map((item) => item.id === temporaryId ? { ...item, id: result.log!.id! } : item));
    }
    setFoodName(""); setGrams("100"); setNutrition(emptyFoodNutrition()); setPhotoPreview(null); setAiEstimate(null);
    setPortionUnit("g"); setAnalysedGrams(null); setUnitAmount("1");
  }

  async function submitManual() {
    if (isSubmitting || !foodName.trim()) { if (!foodName.trim()) setMessage(t.calorieTracker.fillNameAndCalories); return; }
    // Manuel kalori ve makro girişi kaldırıldı. Yazılı öğün, kaydedilmeden
    // önce mutlaka AI tarafından analiz edilir.
    if (activeMethod === "text" && !aiEstimate) {
      await estimateFromText(true);
      return;
    }
    const portionGrams = Number(grams.replace(",", "."));
    if (!Number.isFinite(portionGrams) || portionGrams <= 0 || portionGrams > 5000 || !aiEstimate || nutrition.calories <= 0) {
      setMessage(t.calorieTracker.estimateNotRecognized);
      return;
    }
    setIsSubmitting(true);
    try {
      await addEntry({ name: foodName.trim(), meal, calories: nutrition.calories, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, fiber: nutrition.fiber, grams: portionGrams, micros: nutrition.micros, source: activeMethod === "photo" ? "Fotoğraf" : "AI analizi", isEstimated: true });
      setMessage(t.calorieTracker.entryAdded);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Yemek adı + tartılmış gramajı AI ile hesaplar. İstenirse aynı işlem
  // tamamlandığında öğünü tek dokunuşla günlüğe de ekler.
  async function estimateFromText(addToLog = false) {
    const query = foodName.trim();
    if (query.length < 2) { setMessage(t.calorieTracker.fillNameAndCalories); return; }
    setEstimating(true);
    setMessage(t.calorieTracker.estimating);
    try {
      const portionGrams = Number(grams.replace(",", "."));
      if (!Number.isFinite(portionGrams) || portionGrams <= 0 || portionGrams > 5000) {
        setMessage("Gramaj 1–5000 gram arasında olmalı.");
        return;
      }
      const response = await authorizedFetch("/api/nutrition/parse-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, grams: portionGrams, locale }) });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        warnings?: string[];
        totals?: { calories: number; protein: number; carbohydrates: number; fat: number; fiber: number };
        items?: Array<{ query: string; estimatedGrams: number; confidence: number; needsConfirmation: boolean; food: unknown; nutrition: unknown }>;
      };
      if (!response.ok) { setMessage(result.error || t.calorieTracker.estimateFailed); return; }
      const items = result.items || [];
      const totals = result.totals;
      if (!items.length || !totals) { setMessage(t.calorieTracker.estimateNotRecognized); return; }
      const totalGrams = items.reduce((sum, item) => sum + item.estimatedGrams, 0);
      const averageConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
      const confidence = averageConfidence >= 0.8 && items.every((item) => !item.needsConfirmation) ? "high" : averageConfidence >= 0.55 ? "medium" : "low";
      const estimatedName = items.map((item) => item.query).join(", ");
      setGrams(String(Math.round(totalGrams)));
      setFoodName(estimatedName);
      setNutrition({ calories: totals.calories, protein: totals.protein, carbs: totals.carbohydrates, fat: totals.fat, fiber: totals.fiber, micros: {} });
      setAiEstimate({ grams: Math.round(totalGrams), items: items.map((item) => item.query), confidence });
      // Analiz edilen porsiyon "1 adet" kabul edilir; adet seçeneği buna dayanır.
      setAnalysedGrams(Math.round(totalGrams) || null);
      setUnitAmount("1");
      if (addToLog) {
        setIsSubmitting(true);
        try {
          await addEntry({
            name: estimatedName,
            meal,
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbohydrates,
            fat: totals.fat,
            fiber: totals.fiber,
            grams: Math.round(totalGrams),
            micros: {},
            source: "AI analizi",
            isEstimated: true,
            confidence: averageConfidence,
          });
          setMessage(t.calorieTracker.entryAdded);
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setMessage([confidence === "low" ? t.calorieTracker.estimateLowConfidence : t.calorieTracker.estimateReady, ...(result.warnings || [])].join(" "));
      }
    } catch {
      setMessage(t.calorieTracker.estimateFailed);
    } finally {
      setEstimating(false);
    }
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const photoDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(); reader.onerror = reject; reader.readAsDataURL(file); }).catch(() => "");
    await analyzeFoodPhoto(photoDataUrl, URL.createObjectURL(file));
  }

  analyzeRef.current = (photoDataUrl: string) => analyzeFoodPhoto(photoDataUrl);

  async function analyzeFoodPhoto(photoDataUrl: string, previewUrl = photoDataUrl) {
    if (!photoDataUrl) { setMessage(t.calorieTracker.photoUnreadable); return; }
    setPhotoPreview(previewUrl);
    setMessage(t.calorieTracker.analyzingPhoto);
    const response = await authorizedFetch("/api/nutrition/analyze-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoDataUrl }) });
    const result = await response.json().catch(() => ({})) as { error?: string; name?: string; itemNames?: string[]; grams?: number; calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; confidence?: "low" | "medium" | "high"; needsManualNutrition?: boolean; warnings?: string[]; usage?: { used: number; limit: number } };
    if (!response.ok || !result.name) { setMessage(result.error || t.calorieTracker.photoAnalysisFailed); return; }
    // Makrolar porsiyonun tamamı için geldiği için gramajı da modelin tahminine
    // eşitliyoruz; aksi halde 100 g varsayımı değerleri yanlış ölçeklerdi.
    setFoodName(result.name);
    setGrams(String(result.grams || 100));
    setNutrition({ calories: result.calories || 0, protein: result.protein || 0, carbs: result.carbs || 0, fat: result.fat || 0, fiber: result.fiber || 0, micros: {} });
    setAiEstimate({ grams: result.grams || 100, items: result.itemNames || [], confidence: result.confidence || "medium" });
    setAnalysedGrams(Math.round(result.grams || 0) || null);
    setUnitAmount("1");
    const resultMessage = result.confidence === "low" ? t.calorieTracker.photoResultLowConfidence : t.calorieTracker.photoResultMessage;
    const confidenceNotice = result.needsManualNutrition ? ` ${t.calorieTracker.photoLowConfidenceRetry}` : "";
    setMessage(`${resultMessage}${confidenceNotice} ${(result.warnings || []).join(" ")}${result.usage ? ` ${t.calorieTracker.photoDailyUsage(result.usage.used, result.usage.limit)}` : ""}`.trim());
  }

  // Girdi seçili birimde okunur; iç matematik her zaman GRAM üzerinden yürür.
  // Seçili birimin bir tanesinin kaç gram olduğu. Yemek adı da hesaba katılır:
  // "3 yumurta" analiz edildiyse 1 adet, toplamın üçte biridir.
  const unitGrams = referenceGrams(portionUnit, analysedGrams, foodName);

  function updatePortion(value: string) {
    if (portionUnit === "g") { updateGrams(value); return; }
    setUnitAmount(value);
    const nextGrams = toGrams(value, portionUnit, unitGrams);
    if (nextGrams !== null) updateGrams(String(Math.round(nextGrams)));
  }

  function switchPortionUnit(unit: PortionUnit) {
    if (unit === portionUnit) return;
    setPortionUnit(unit);
    if (unit === "g") return;
    const reference = referenceGrams(unit, analysedGrams, foodName);
    setUnitAmount(fromGrams(Number(grams.replace(",", ".")) || 0, unit, reference) || "1");
  }

  function updateGrams(value: string) {
    const next = Number(value.replace(",", "."));
    const previous = Number(grams.replace(",", "."));
    setGrams(value);
    if (aiEstimate && Number.isFinite(next) && next > 0 && next <= 5_000 && Number.isFinite(previous) && previous > 0) {
      setNutrition((current) => scaleFoodNutrition(current, (next / previous) * 100));
      setAiEstimate((current) => current ? { ...current, grams: Math.round(next) } : current);
    }
  }

  async function chooseFoodPhoto() {
    if (!isNativeApp()) { cameraInput.current?.click(); return; }
    try {
      const photoDataUrl = await takeFoodPhoto();
      if (photoDataUrl) { await mobileImpact(); await analyzeFoodPhoto(photoDataUrl); }
    } catch { setMessage(t.calorieTracker.cameraOrPhotoPermissionDenied); }
  }

  function selectMethod(method: "text" | "photo") {
    setActiveMethod(method);
    setFoodName("");
    setGrams("100");
    setNutrition(emptyFoodNutrition());
    setAiEstimate(null);
    setPortionUnit("g");
    setAnalysedGrams(null);
    setUnitAmount("1");
    setPhotoPreview(null);
    setMessage("");
  }

  async function deleteEntry(entryId: string) {
    setEntries((current) => current.filter((item) => item.id !== entryId));
    if (userId && /^[0-9a-f-]{36}$/i.test(entryId)) await authorizedFetch(`/api/nutrition/logs/${entryId}`, { method: "DELETE" });
  }

  async function saveNutritionGoal(goal: NutritionGoal) {
    const safeGoal = sanitizeNutritionGoal({ ...goal, isManual: true });
    if (!safeGoal) { setGoalMessage(t.calorieTracker.goalValuesInvalid); return; }
    setGoalSaving(true);
    setGoalMessage("");
    setNutritionGoal(safeGoal);
    if (!userId) { setGoalSaving(false); setGoalMessage(t.calorieTracker.goalUpdatedSessionOnly); return; }
    const supabase = createClient();
    const { error } = await supabase?.from("nutrition_goals").upsert({ user_id: userId, goal_type: safeGoal.goalType, calorie_target: safeGoal.calorieTarget, protein_g: safeGoal.proteinGrams, carbs_g: safeGoal.carbsGrams, fat_g: safeGoal.fatGrams, bmr: safeGoal.bmr, tdee: safeGoal.tdee, calorie_adjustment: safeGoal.calorieAdjustment, activity_factor: safeGoal.activityFactor, workout_days: safeGoal.workoutDays, is_manual: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" }) || {};
    setGoalSaving(false);
    setGoalMessage(error ? t.calorieTracker.goalUpdatedLocalNotSynced : t.calorieTracker.goalSaved);
  }

  return <div className="calorie-tracker subview">
    <div className="calorie-page-head">
      <div><div className="eyebrow">{t.calorieTracker.eyebrow}</div><h1>{t.calorieTracker.heroTitle1}<br /><em>{t.calorieTracker.heroTitle2}</em></h1><p className="lead">{t.calorieTracker.lead}</p></div>
      <div className="date-switcher"><button type="button" aria-label={t.calorieTracker.previousDay} onClick={() => setDateOffset((day) => day - 1)}><ChevronLeft size={17} /></button><div><span>{dateOffset === 0 ? t.calorieTracker.today : t.calorieTracker.dailyLabel}</span><strong>{todayLabel(dateOffset, dateLocale)}</strong></div><button type="button" aria-label={t.calorieTracker.nextDay} disabled={dateOffset >= 0} onClick={() => setDateOffset((day) => Math.min(0, day + 1))}><ChevronRight size={17} /></button></div>
    </div>

    {/* Öğün eklemek bu ekranın günlük işi; hedef paneli ise ayda bir
        dokunulan bir ayar. Hedefler üstteyken kullanıcı her gün onu geçip
        aşağı kaydırmak zorunda kalıyordu, bu yüzden sıra ters çevrildi. */}

    <section className="food-entry-panel" id="food-entry-panel">
      <div className="section-title"><div><div className="eyebrow">{t.calorieTracker.addMealEyebrow}</div><h2>{t.calorieTracker.addMealTitle}</h2></div><span className="food-entry-note"><Sparkles size={14} /> {t.calorieTracker.quickAndPractical}</span></div>
      <div className="food-methods">
        <button type="button" className={activeMethod === "photo" ? "active" : ""} onClick={() => selectMethod("photo")}><Camera /><strong>{t.calorieTracker.takePhoto}</strong><small>{t.calorieTracker.takePhotoHint}</small></button>
        <button type="button" className={activeMethod === "text" ? "active" : ""} onClick={() => selectMethod("text")}><Sparkles /><strong>{t.calorieTracker.typeToAdd}</strong><small>{t.calorieTracker.typeToAddHint}</small></button>
      </div>
      <div className="entry-workspace">
        <label>{t.calorieTracker.mealLabel}<select value={meal} onChange={(event) => setMeal(event.target.value as Meal)}>{meals.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        {activeMethod === "photo" && <div className="method-content photo-food-content"><button type="button" className="food-photo-drop" onClick={() => void chooseFoodPhoto()}>{photoPreview ? <Image src={photoPreview} alt={t.calorieTracker.photoAlt} width={640} height={480} unoptimized /> : <><ImagePlus size={26} /><strong>{t.calorieTracker.photoDropPrompt1}</strong><span>{t.calorieTracker.photoDropPrompt2}</span></>}</button><input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />{photoPreview && <button type="button" className="outline-btn" onClick={() => void chooseFoodPhoto()}>{t.calorieTracker.choosePhotoAgain}</button>}</div>}
        {(activeMethod === "text" || photoPreview) && <>
          {/* Sıra bilerek böyle: önce ne kadar yediğin (porsiyon), sonra ne
              yediğin ve analiz, en sonda ekle. Eskiden besin adı en üstteydi ve
              porsiyon araya sıkışıyordu. */}
          <div className="manual-fields">
            <label className="portion-field">{portionUnit === "g" ? t.calorieTracker.portionLabel : portionUnitLabel(t, portionUnit).toLocaleUpperCase("tr-TR")}
              <input inputMode="decimal" value={portionUnit === "g" ? grams : unitAmount} onChange={(event) => updatePortion(event.target.value)} placeholder={portionUnit === "g" ? "100" : "1"} />
              {/* Ev ölçüleri sabit gram karşılığı taşır, bu yüzden AI tahmini
                  olmadan da seçilebilir. Porsiyon ve adet ise yemeğe özgüdür;
                  tahmin yokken kilitli kalırlar, yoksa uydurma bir ağırlıkla
                  sessizce yanlış kalori kaydedilirdi. */}
              <span className="portion-unit-switch" role="group" aria-label={t.calorieTracker.portionUnitLabel}>
                {PRIMARY_PORTION_UNITS.map((unit) => <button
                  key={unit}
                  type="button"
                  aria-pressed={portionUnit === unit}
                  className={portionUnit === unit ? "active" : ""}
                  onClick={() => switchPortionUnit(unit)}
                >{portionUnitLabel(t, unit)}</button>)}
              </span>
              {/* Ev ölçüleri ikinci grupta ve gram karşılığıyla: "Tabak"ın ne
                  kadar olduğunu görmeden seçmek kullanıcıyı tahmine bırakıyordu. */}
              <span className="portion-unit-switch portion-unit-household" role="group" aria-label={t.calorieTracker.portionUnitHouseholdLabel}>
                {HOUSEHOLD_PORTION_UNITS.map((unit) => {
                  const locked = needsAnalysis(unit) && analysedGrams === null;
                  const grams = referenceGrams(unit, analysedGrams, foodName);
                  return <button
                    key={unit}
                    type="button"
                    disabled={locked}
                    title={locked ? t.calorieTracker.portionUnitNeedsAnalysis : undefined}
                    aria-pressed={portionUnit === unit}
                    className={portionUnit === unit ? "active" : ""}
                    onClick={() => switchPortionUnit(unit)}
                  >{portionUnitLabel(t, unit)}{grams !== null && !locked && <i>{Math.round(grams)} g</i>}</button>;
                })}
              </span>
              {portionUnit !== "g" && unitGrams !== null && <small className="portion-unit-hint">{t.calorieTracker.portionUnitHint(portionUnitLabel(t, portionUnit), Math.round(unitGrams))}</small>}
            </label>
            {/* Besin adı ve "AI ile analiz et" yan yana: analiz doğrudan bu
                alandaki metne uygulanır, ikisini ayırmak bağı koparıyordu. */}
            <div className="food-name-row">
              <label className="food-name">{t.calorieTracker.foodNameLabel}<input value={foodName} onChange={(event) => { setFoodName(event.target.value); setAiEstimate(null); setNutrition(emptyFoodNutrition()); }} placeholder={t.calorieTracker.foodNamePlaceholder} autoComplete="off" /></label>
              {activeMethod === "text" && <button type="button" className="ai-estimate-btn" disabled={estimating || foodName.trim().length < 2} onClick={() => void estimateFromText()}><Sparkles size={14} /> {estimating ? t.calorieTracker.estimating : t.calorieTracker.estimateWithAi}</button>}
            </div>
            {aiEstimate && <div className={`ai-estimate-card ${aiEstimate.confidence}`}><span>{t.calorieTracker.aiEstimateLabel}</span><strong>{foodName}</strong><small>{t.calorieTracker.aiEstimateGrams(aiEstimate.grams)}</small><div className="ai-nutrition-values"><b>{nutrition.calories}<small>kcal</small></b><b>{nutrition.protein}<small>{t.calorieTracker.macroProtein} (g)</small></b><b>{nutrition.carbs}<small>{t.calorieTracker.macroCarbs} (g)</small></b><b>{nutrition.fat}<small>{t.calorieTracker.macroFat} (g)</small></b><b>{nutrition.fiber}<small>{t.calorieTracker.fieldFiber} (g)</small></b></div>{aiEstimate.items.length > 1 && <small>{aiEstimate.items.join(" · ")}</small>}<p>{aiEstimate.confidence === "low" ? t.calorieTracker.aiConfidenceLow : aiEstimate.confidence === "high" ? t.calorieTracker.aiConfidenceHigh : t.calorieTracker.aiConfidenceMedium}</p></div>}
            <button type="button" className="primary-btn add-food" disabled={isSubmitting || estimating || (activeMethod === "photo" && !aiEstimate)} onClick={() => void submitManual()}><Plus size={16} /> {estimating ? t.calorieTracker.estimating : aiEstimate ? t.calorieTracker.addToLog : t.calorieTracker.analyzeAndAdd}</button>
          </div>
        </>}
        {/* Kamera dönüşünde süreç öldürüldüyse fotoğraf geri getirilirken
            kullanıcı boş bir ekranla karşılaşmasın. */}
        {(message || pendingFoodPhoto) && <p className="food-message">{message || t.calorieTracker.restoringPhoto}</p>}
      </div>
    </section>

    {/* Sık yenenler öğün eklemenin KISAYOLU; formun üstünde durunca asıl işi
        aşağı itiyordu. Formun hemen altına alındı. */}
    {regulars.length > 0 && <section className="frequent-meals">
      <div className="frequent-meals-head"><div className="eyebrow">{t.frequentMeals.eyebrow}</div><span>{t.frequentMeals.hint}</span></div>
      <div className="frequent-meals-list">{regulars.map((item) => <button type="button" key={item.key} onClick={() => void addFrequentMeal(item.key)}>
        <strong>{item.entry.name}</strong>
        <span>{item.entry.calories} kcal · {item.entry.meal}</span>
        <small>{t.frequentMeals.countLabel(item.count)}</small>
      </button>)}</div>
    </section>}

    <section className="calorie-hero">
      <div className={overBy ? "calorie-progress over" : "calorie-progress"} style={{ "--progress": `${progress}%` } as React.CSSProperties}><div><small>{t.calorieTracker.todayIntake}</small><strong>{totals.calories}<em> kcal</em></strong><span>{t.calorieTracker.percentOfGoal(rawProgress)}</span></div></div>
      <div className="calorie-hero-copy"><span>{t.calorieTracker.dailyGoal}</span><strong>{nutritionGoal.calorieTarget} kcal</strong><p>{overBy ? t.calorieTracker.overMessage(overBy) : remaining ? t.calorieTracker.remainingMessage(remaining) : t.calorieTracker.goalReached}</p><div className="macro-row"><span><i className="protein" />{t.calorieTracker.macroProtein} <b>{totals.protein}/{nutritionGoal.proteinGrams}g</b></span><span><i className="carbs" />{t.calorieTracker.macroCarbs} <b>{totals.carbs}/{nutritionGoal.carbsGrams}g</b></span><span><i className="fat" />{t.calorieTracker.macroFat} <b>{totals.fat}/{nutritionGoal.fatGrams}g</b></span></div></div>
      <div className={overBy ? "calorie-remaining over" : "calorie-remaining"}><span>{overBy ? t.calorieTracker.overLabel : t.calorieTracker.remainingLabel}</span><strong>{overBy ? `+${overBy}` : remaining}</strong><small>kcal</small></div>
    </section>

    <NutritionGoalsPanel key={`${nutritionGoal.goalType}-${nutritionGoal.calorieTarget}-${nutritionGoal.proteinGrams}-${nutritionGoal.carbsGrams}-${nutritionGoal.fatGrams}`} goal={nutritionGoal} recommendedGoals={recommendedGoals} totals={totals} trend={weightTrend} trendProgress={trendProgress} saving={goalSaving} saveMessage={goalMessage} onSave={saveNutritionGoal} />

    <HydrationFasting userId={userId} weightKg={weightKg} />

    <section className="meal-ai-advice" aria-labelledby="meal-ai-advice-title">
      <div className="meal-ai-icon" aria-hidden="true">✦</div><div><span>{t.calorieTracker.mealAdviceEyebrow}</span><h2 id="meal-ai-advice-title">{t.calorieTracker.mealAdviceTitle}</h2><p>{mealAdviceLoading ? t.calorieTracker.mealAdviceLoading : mealAdvice || t.calorieTracker.mealAdvicePreparing}</p><small>{mealAdviceSource === "ai" ? t.calorieTracker.mealAdviceAiNote : t.calorieTracker.mealAdviceFallbackNote} {t.calorieTracker.mealAdviceDisclaimer}</small></div><button type="button" disabled={mealAdviceLoading} onClick={() => setAdviceRevision((value) => value + 1)}>{mealAdviceLoading ? t.calorieTracker.refreshing : t.calorieTracker.refresh}</button>
    </section>

    <section className="food-log"><div className="section-title"><div><div className="eyebrow">{t.calorieTracker.dailySummaryEyebrow}</div><h2>{t.calorieTracker.yourMeals}</h2></div><span className="log-total"><Utensils size={14} /> {t.calorieTracker.recordCount(dailyEntries.length)}</span></div>{meals.map((mealName) => { const group = dailyEntries.filter((entry) => entry.meal === mealName); const groupCalories = group.reduce((sum, entry) => sum + entry.calories, 0); return <div className="meal-group" key={mealName}><div className="meal-group-head"><strong>{mealName}</strong><span>{groupCalories} kcal</span></div>{group.length ? group.map((entry) => <article className="food-log-item" key={entry.id}><div className="food-icon">{entry.meal === "Kahvaltı" ? "☀" : entry.meal === "Öğle yemeği" ? "◒" : entry.meal === "Akşam yemeği" ? "◐" : "✦"}</div><div><strong>{entry.name}</strong><small>{entry.time} · {entry.source}</small><span>P {entry.protein}g · K {entry.carbs}g · Y {entry.fat}g</span></div><b>{entry.calories} <small>kcal</small></b><button type="button" aria-label={t.calorieTracker.deleteEntry(entry.name)} onClick={() => void deleteEntry(entry.id)}><Trash2 size={15} /></button></article>) : <p className="empty-meal">{t.calorieTracker.noRecordsYet}</p>}</div>; })}</section>
  </div>;
}
