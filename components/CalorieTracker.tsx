"use client";

import { Barcode, Camera, ChevronLeft, ChevronRight, ImagePlus, Plus, Search, Sparkles, Trash2, Utensils } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { NutritionGoalsPanel } from "@/components/NutritionGoalsPanel";
import { emptyFoodNutrition, scaleFoodNutrition, type FoodMicronutrients, type FoodNutrition, type FoodSearchResult } from "@/lib/food-search";
import { calculateNutritionGoal, calculateWeeklyWeightTrend, inferNutritionGoal, sanitizeNutritionGoal, type NutritionGoal, type NutritionGoalType, type WeightTrend } from "@/lib/nutrition-goals";
import { isNativeApp, mobileImpact, takeFoodPhoto } from "@/lib/mobile";
import { createClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/streak";
import { authorizedFetch } from "@/lib/api-client";
import { validateManualNutrition } from "@/lib/nutrition-calculation";
import { translateFoodSource, translateMeal, useTranslations, type Dictionary } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { BrowserMultiFormatReader } from "@zxing/browser";

// Barkod okuma tamamen cihaz üstünde çalışır: ağ isteği yok, AI çağrısı yok,
// çevrimdışı da işler. EAN-13/8 ve UPC-A/E market ürünlerinin, Code128 ise
// bazı yerel/özel etiketlerin standart formatlarıdır.
const barcodeHints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
]]]);

type Meal = "Kahvaltı" | "Öğle yemeği" | "Akşam yemeği" | "Atıştırmalık";
type FoodEntry = { id: string; name: string; meal: Meal; calories: number; protein: number; carbs: number; fat: number; fiber?: number; grams?: number; micros?: FoodMicronutrients; time: string; consumedAt: string; source: "Barkod" | "Fotoğraf" | "Manuel"; isEstimated?: boolean };

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
const seedTime = new Date().toISOString();
const initialEntries: FoodEntry[] = [
  { id: "seed-yogurt", name: "Yoğurtlu yulaf kasesi", meal: "Kahvaltı", calories: 385, protein: 19, carbs: 48, fat: 12, time: "08:35", consumedAt: seedTime, source: "Manuel" },
  { id: "seed-coffee", name: "Sütlü filtre kahve", meal: "Kahvaltı", calories: 82, protein: 4, carbs: 8, fat: 3, time: "09:10", consumedAt: seedTime, source: "Manuel" },
  { id: "seed-chicken", name: "Tavuklu bulgur kasesi", meal: "Öğle yemeği", calories: 540, protein: 43, carbs: 58, fat: 15, time: "13:05", consumedAt: seedTime, source: "Manuel" },
];

function microLabel(t: Dictionary, key: keyof FoodMicronutrients): string {
  if (key === "sodiumMg") return t.calorieTracker.microSodium;
  if (key === "calciumMg") return t.calorieTracker.microCalcium;
  if (key === "ironMg") return t.calorieTracker.microIron;
  if (key === "potassiumMg") return t.calorieTracker.microPotassium;
  return t.calorieTracker.microVitaminC;
}

function formatAmount(value: number, dateLocale: string) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString(dateLocale, { maximumFractionDigits: 1 });
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
  const nutritionFields: Array<{ key: Exclude<keyof FoodNutrition, "micros">; label: string; unit: string }> = [
    { key: "calories", label: t.calorieTracker.fieldCalorie, unit: "kcal" },
    { key: "protein", label: t.calorieTracker.fieldProtein, unit: "g" },
    { key: "carbs", label: t.calorieTracker.fieldCarbs, unit: "g" },
    { key: "fat", label: t.calorieTracker.fieldFat, unit: "g" },
    { key: "fiber", label: t.calorieTracker.fieldFiber, unit: "g" },
  ];
  const inferredGoal = inferNutritionGoal(profileGoal);
  const recommendedGoals = useMemo(() => Object.fromEntries((["lose", "maintain", "gain"] as NutritionGoalType[]).map((goalType) => [goalType, calculateNutritionGoal({ goalType, bmr, tdee, weightKg, activityFactor, workoutDays })])) as Record<NutritionGoalType, NutritionGoal>, [activityFactor, bmr, tdee, weightKg, workoutDays]);
  const [entries, setEntries] = useState<FoodEntry[]>(initialEntries);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal>(() => calculateNutritionGoal({ goalType: inferredGoal, bmr, tdee, weightKg, activityFactor, workoutDays }));
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  // Trend en az 2 ölçüm ve 5 gün ister. İlk hafta boyunca panel yalnızca
  // "Ölçüm bekleniyor" diyordu; kullanıcının neyi beklediğini görebilmesi için
  // ilerlemeyi ayrıca taşıyoruz.
  const [trendProgress, setTrendProgress] = useState<{ count: number; daysLeft: number } | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [activeMethod, setActiveMethod] = useState<"manual" | "barcode" | "photo">("manual");
  const [meal, setMeal] = useState<Meal>("Atıştırmalık");
  const [foodName, setFoodName] = useState("");
  const [grams, setGrams] = useState("100");
  const [nutrition, setNutrition] = useState<FoodNutrition>(emptyFoodNutrition);
  const [selectedProduct, setSelectedProduct] = useState<FoodSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [searchNotice, setSearchNotice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
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
  const barcodeVideo = useRef<HTMLVideoElement>(null);
  const productSearchCache = useRef(new Map<string, { results: FoodSearchResult[]; notice: string }>());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("fit-ai-calorie-entries");
        if (saved) {
          const parsed = JSON.parse(saved) as FoodEntry[];
          if (Array.isArray(parsed)) setEntries(parsed.map((entry) => ({ ...entry, consumedAt: entry.consumedAt || new Date().toISOString() })));
        }
      } catch { /* İlk kullanımda örnek kayıtlar gösterilir. */ }
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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadEntries() {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase.from("food_entries").select("*").order("consumed_at", { ascending: false }).limit(100);
      if (cancelled || !data) return;
      setEntries(data.map((entry) => ({ id: String(entry.id), name: String(entry.name), meal: entry.meal as Meal, calories: Number(entry.calories), protein: Number(entry.protein_g), carbs: Number(entry.carbs_g), fat: Number(entry.fat_g), fiber: Number(entry.fiber_g || 0), grams: Number(entry.grams || 0) || undefined, micros: entry.micros && typeof entry.micros === "object" ? entry.micros as FoodMicronutrients : undefined, time: new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(String(entry.consumed_at))), consumedAt: String(entry.consumed_at), source: entry.source as FoodEntry["source"] })));
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

  useEffect(() => {
    if (activeMethod !== "manual" || foodName.trim().length < 2 || selectedProduct?.name === foodName) {
      return;
    }
    const query = foodName.trim();
    const cacheKey = query.toLocaleLowerCase("tr-TR");
    const cached = productSearchCache.current.get(cacheKey);
    if (cached) {
      queueMicrotask(() => {
        setSearchResults(cached.results);
        setSearchNotice(cached.notice);
        setSearchState(cached.results.length ? "ready" : "empty");
      });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState("loading");
      setSearchNotice("");
      try {
        const response = await authorizedFetch(`/api/nutrition/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const result = await response.json().catch(() => ({})) as { results?: FoodSearchResult[]; error?: string; notice?: string };
        if (controller.signal.aborted) return;
        const results = Array.isArray(result.results) ? result.results : [];
        if (response.ok) productSearchCache.current.set(cacheKey, { results, notice: result.notice || "" });
        setSearchResults(results);
        setSearchNotice(result.notice || result.error || "");
        setSearchState(response.ok ? (results.length ? "ready" : "empty") : "error");
      } catch {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchNotice(t.calorieTracker.searchUnavailable);
        setSearchState("error");
      }
    }, 650);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [activeMethod, foodName, selectedProduct?.name, t]);

  useEffect(() => {
    if (!isScanning) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      // Efekt gövdesinde eşzamanlı setState kademeli render'a yol açar; bir
      // sonraki mikro görevde çalıştırarak diğer efektlerdeki desenle tutarlı
      // şekilde erteliyoruz.
      queueMicrotask(() => { setMessage(t.calorieTracker.cameraUnsupported); setIsScanning(false); });
      return;
    }
    let cancelled = false;
    let controls: { stop: () => void } | null = null;
    const reader = new BrowserMultiFormatReader(barcodeHints);
    // decodeFromVideoDevice hem kamera akışını açar hem de video elementine
    // bağlar hem de her kareyi sürekli tarar; tüm tarayıcılarda (Chromium,
    // Safari, Firefox) aynı şekilde çalışır, ağ isteği veya AI çağrısı yapmaz.
    reader.decodeFromVideoDevice(undefined, barcodeVideo.current ?? undefined, (result, error) => {
      if (cancelled) return;
      if (result) {
        setBarcode(result.getText());
        setIsScanning(false);
        setMessage(t.calorieTracker.barcodeScanned);
        return;
      }
      // NotFoundException her boş karede fırlar; bu normal tarama gürültüsüdür.
      if (error && error.name !== "NotFoundException" && error.name !== "ChecksumException" && error.name !== "FormatException") {
        setMessage(t.calorieTracker.cameraAccessFailed);
        setIsScanning(false);
      }
    }).then((value) => { if (!cancelled) controls = value; else value.stop(); }).catch(() => {
      if (!cancelled) { setMessage(t.calorieTracker.cameraAccessFailed); setIsScanning(false); }
    });
    return () => { cancelled = true; controls?.stop(); };
  }, [isScanning, t]);

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

  async function addEntry(entry: Omit<FoodEntry, "id" | "time" | "consumedAt">, productBarcode?: string) {
    const now = new Date();
    const temporaryId = crypto.randomUUID();
    const record = { ...entry, id: temporaryId, time: new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(now), consumedAt: now.toISOString() };
    setEntries((current) => [record, ...current]);
    if (userId) {
      const inputMethod = record.source === "Barkod" ? "barcode" : record.source === "Fotoğraf" ? "photo" : selectedProduct ? "search" : aiEstimate ? "natural_language" : "manual";
      const foodId = selectedProduct && /^[0-9a-f-]{36}$/i.test(selectedProduct.id) ? selectedProduct.id : null;
      const response = await authorizedFetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodId,
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
          confidence: aiEstimate ? (aiEstimate.confidence === "high" ? 0.9 : aiEstimate.confidence === "medium" ? 0.7 : 0.45) : null,
          isEstimated: Boolean(record.isEstimated || aiEstimate),
          metadata: { barcode: productBarcode || null, micros: record.micros || {} },
        }),
      });
      const result = await response.json().catch(() => ({})) as { log?: { id?: string } };
      if (!response.ok) setMessage(t.calorieTracker.syncedLocallyOnly);
      else if (result.log?.id) setEntries((current) => current.map((item) => item.id === temporaryId ? { ...item, id: result.log!.id! } : item));
    }
    setFoodName(""); setGrams("100"); setNutrition(emptyFoodNutrition()); setSelectedProduct(null); setSearchResults([]); setBarcode(""); setPhotoPreview(null); setAiEstimate(null);
  }

  async function submitManual() {
    if (isSubmitting || !foodName.trim()) { if (!foodName.trim()) setMessage(t.calorieTracker.fillNameAndCalories); return; }
    const portionGrams = Number(grams.replace(",", "."));
    const validation = validateManualNutrition({ portionGrams, calories: nutrition.calories, protein: nutrition.protein, carbohydrates: nutrition.carbs, fat: nutrition.fat, fiber: nutrition.fiber });
    if (!validation.valid) { setMessage(validation.error || t.calorieTracker.fillNameAndCalories); return; }
    if (validation.warning) setMessage(validation.warning);
    setIsSubmitting(true);
    try {
      await addEntry({ name: foodName.trim(), meal, calories: nutrition.calories, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, fiber: nutrition.fiber, grams: portionGrams, micros: nutrition.micros, source: activeMethod === "photo" ? "Fotoğraf" : selectedProduct?.barcode ? "Barkod" : "Manuel", isEstimated: Boolean(aiEstimate) }, selectedProduct?.barcode);
      setMessage(validation.warning ? `${t.calorieTracker.entryAdded} ${validation.warning}` : t.calorieTracker.entryAdded);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Katalogda karşılığı olmayan serbest metinler için AI tahmini. Porsiyonu da
  // metinden çıkarır ("2 dilim", "1 kase"), böylece kullanıcı gramajı elle
  // hesaplamak zorunda kalmaz.
  async function estimateFromText() {
    const query = foodName.trim();
    if (query.length < 2) { setMessage(t.calorieTracker.fillNameAndCalories); return; }
    setEstimating(true);
    setMessage(t.calorieTracker.estimating);
    try {
      const response = await authorizedFetch("/api/nutrition/parse-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, locale }) });
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
      setFoodName(items.map((item) => item.query).join(", "));
      setGrams(String(Math.round(totalGrams)));
      setNutrition({ calories: totals.calories, protein: totals.protein, carbs: totals.carbohydrates, fat: totals.fat, fiber: totals.fiber, micros: {} });
      setSelectedProduct(null);
      setSearchResults([]);
      setSearchState("idle");
      setAiEstimate({ grams: Math.round(totalGrams), items: items.map((item) => item.query), confidence });
      setMessage([confidence === "low" ? t.calorieTracker.estimateLowConfidence : t.calorieTracker.estimateReady, ...(result.warnings || [])].join(" "));
    } catch {
      setMessage(t.calorieTracker.estimateFailed);
    } finally {
      setEstimating(false);
    }
  }

  async function findBarcode() {
    if (!barcode.trim()) { setMessage(t.calorieTracker.enterOrScanBarcode); return; }
    setMessage(t.calorieTracker.searchingCatalogMessage);
    const response = await authorizedFetch(`/api/nutrition/barcode?code=${encodeURIComponent(barcode)}`);
    const result = await response.json().catch(() => ({})) as { error?: string; name?: string; brand?: string; barcode?: string; servingGrams?: number; source?: FoodSearchResult["source"]; verified?: boolean; dataQuality?: FoodSearchResult["dataQuality"]; nutritionPer100g?: FoodNutrition };
    if (!response.ok || !result.name || !result.nutritionPer100g) { setMessage(result.error || t.calorieTracker.productNotFound); return; }
    const serving = result.servingGrams || 100;
    setFoodName(result.name);
    setGrams(String(serving));
    setNutrition(scaleFoodNutrition(result.nutritionPer100g, serving));
    setSelectedProduct({ id: `barcode-${barcode}`, name: result.name, brand: result.brand, barcode: result.barcode || barcode, servingGrams: serving, nutritionPer100g: result.nutritionPer100g, source: result.source || "Open Food Facts", verified: result.verified, dataQuality: result.dataQuality });
    setAiEstimate(null);
    setActiveMethod("manual");
    setMessage(t.calorieTracker.productFoundMessage);
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const photoDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(); reader.onerror = reject; reader.readAsDataURL(file); }).catch(() => "");
    await analyzeFoodPhoto(photoDataUrl, URL.createObjectURL(file));
  }

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
    setSelectedProduct(null);
    setAiEstimate({ grams: result.grams || 100, items: result.itemNames || [], confidence: result.confidence || "medium" });
    const resultMessage = result.confidence === "low" ? t.calorieTracker.photoResultLowConfidence : t.calorieTracker.photoResultMessage;
    const manualNotice = result.needsManualNutrition ? " Bazı besin değerlerini elle tamamlamalısın." : "";
    setMessage(`${resultMessage}${manualNotice} ${(result.warnings || []).join(" ")}${result.usage ? ` ${t.calorieTracker.photoDailyUsage(result.usage.used, result.usage.limit)}` : ""}`.trim());
  }

  function updateNutrition(field: Exclude<keyof FoodNutrition, "micros">, value: string) {
    const parsed = Number(value.replace(",", "."));
    setNutrition((current) => ({ ...current, [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }));
  }

  function updateGrams(value: string) {
    const next = Number(value.replace(",", "."));
    const previous = Number(grams.replace(",", "."));
    setGrams(value);
    if (Number.isFinite(next) && next > 0 && next <= 5_000 && Number.isFinite(previous) && previous > 0) setNutrition((current) => scaleFoodNutrition(current, (next / previous) * 100));
  }

  function selectProduct(product: FoodSearchResult) {
    const serving = product.servingGrams || 100;
    setFoodName(product.name);
    setGrams(String(serving));
    setNutrition(scaleFoodNutrition(product.nutritionPer100g, serving));
    setSelectedProduct(product);
    setSearchResults([]);
    setSearchState("idle");
    setSearchNotice("");
    setMessage(t.calorieTracker.productLoadedMessage(product.source));
  }

  async function chooseFoodPhoto() {
    if (!isNativeApp()) { cameraInput.current?.click(); return; }
    try {
      const photoDataUrl = await takeFoodPhoto();
      if (photoDataUrl) { await mobileImpact(); await analyzeFoodPhoto(photoDataUrl); }
    } catch { setMessage(t.calorieTracker.cameraOrPhotoPermissionDenied); }
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

    <NutritionGoalsPanel key={`${nutritionGoal.goalType}-${nutritionGoal.calorieTarget}-${nutritionGoal.proteinGrams}-${nutritionGoal.carbsGrams}-${nutritionGoal.fatGrams}`} goal={nutritionGoal} recommendedGoals={recommendedGoals} totals={totals} trend={weightTrend} trendProgress={trendProgress} saving={goalSaving} saveMessage={goalMessage} onSave={saveNutritionGoal} />

    <section className="calorie-hero">
      <div className={overBy ? "calorie-progress over" : "calorie-progress"} style={{ "--progress": `${progress}%` } as React.CSSProperties}><div><small>{t.calorieTracker.todayIntake}</small><strong>{totals.calories}<em> kcal</em></strong><span>{t.calorieTracker.percentOfGoal(rawProgress)}</span></div></div>
      <div className="calorie-hero-copy"><span>{t.calorieTracker.dailyGoal}</span><strong>{nutritionGoal.calorieTarget} kcal</strong><p>{overBy ? t.calorieTracker.overMessage(overBy) : remaining ? t.calorieTracker.remainingMessage(remaining) : t.calorieTracker.goalReached}</p><div className="macro-row"><span><i className="protein" />{t.calorieTracker.macroProtein} <b>{totals.protein}/{nutritionGoal.proteinGrams}g</b></span><span><i className="carbs" />{t.calorieTracker.macroCarbs} <b>{totals.carbs}/{nutritionGoal.carbsGrams}g</b></span><span><i className="fat" />{t.calorieTracker.macroFat} <b>{totals.fat}/{nutritionGoal.fatGrams}g</b></span></div></div>
      <div className={overBy ? "calorie-remaining over" : "calorie-remaining"}><span>{overBy ? t.calorieTracker.overLabel : t.calorieTracker.remainingLabel}</span><strong>{overBy ? `+${overBy}` : remaining}</strong><small>kcal</small></div>
    </section>

    <section className="meal-ai-advice" aria-labelledby="meal-ai-advice-title">
      <div className="meal-ai-icon" aria-hidden="true">✦</div><div><span>{t.calorieTracker.mealAdviceEyebrow}</span><h2 id="meal-ai-advice-title">{t.calorieTracker.mealAdviceTitle}</h2><p>{mealAdviceLoading ? t.calorieTracker.mealAdviceLoading : mealAdvice || t.calorieTracker.mealAdvicePreparing}</p><small>{mealAdviceSource === "ai" ? t.calorieTracker.mealAdviceAiNote : t.calorieTracker.mealAdviceFallbackNote} {t.calorieTracker.mealAdviceDisclaimer}</small></div><button type="button" disabled={mealAdviceLoading} onClick={() => setAdviceRevision((value) => value + 1)}>{mealAdviceLoading ? t.calorieTracker.refreshing : t.calorieTracker.refresh}</button>
    </section>

    <section className="food-entry-panel">
      <div className="section-title"><div><div className="eyebrow">{t.calorieTracker.addMealEyebrow}</div><h2>{t.calorieTracker.addMealTitle}</h2></div><span className="food-entry-note"><Sparkles size={14} /> {t.calorieTracker.quickAndPractical}</span></div>
      <div className="food-methods">
        <button type="button" className={activeMethod === "barcode" ? "active" : ""} onClick={() => setActiveMethod("barcode")}><Barcode /><strong>{t.calorieTracker.scanBarcode}</strong><small>{t.calorieTracker.scanBarcodeHint}</small></button>
        <button type="button" className={activeMethod === "photo" ? "active" : ""} onClick={() => setActiveMethod("photo")}><Camera /><strong>{t.calorieTracker.takePhoto}</strong><small>{t.calorieTracker.takePhotoHint}</small></button>
        <button type="button" className={activeMethod === "manual" ? "active" : ""} onClick={() => setActiveMethod("manual")}><Search /><strong>{t.calorieTracker.typeToAdd}</strong><small>{t.calorieTracker.typeToAddHint}</small></button>
      </div>
      <div className="entry-workspace">
        <label>{t.calorieTracker.mealLabel}<select value={meal} onChange={(event) => setMeal(event.target.value as Meal)}>{meals.map((option) => <option key={option} value={option}>{translateMeal(t, option)}</option>)}</select></label>
        {activeMethod === "barcode" && <div className="method-content barcode-content"><button type="button" className="scanner-visual" onClick={() => setIsScanning((current) => !current)}>{isScanning ? <video ref={barcodeVideo} muted playsInline /> : <><Barcode size={42} /><span>{t.calorieTracker.scannerPrompt}</span></>}<b>{isScanning ? t.calorieTracker.stopScanning : t.calorieTracker.openCamera}</b></button><label>{t.calorieTracker.barcodeNumberLabel}<input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="8690…" /></label><button type="button" className="primary-btn" onClick={() => void findBarcode()}>{t.calorieTracker.findProduct} <span>→</span></button><small>{t.calorieTracker.barcodePortionNote}</small></div>}
        {activeMethod === "photo" && <div className="method-content photo-food-content"><button type="button" className="food-photo-drop" onClick={() => void chooseFoodPhoto()}>{photoPreview ? <Image src={photoPreview} alt={t.calorieTracker.photoAlt} width={640} height={480} unoptimized /> : <><ImagePlus size={26} /><strong>{t.calorieTracker.photoDropPrompt1}</strong><span>{t.calorieTracker.photoDropPrompt2}</span></>}</button><input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />{photoPreview && <button type="button" className="outline-btn" onClick={() => void chooseFoodPhoto()}>{t.calorieTracker.choosePhotoAgain}</button>}</div>}
        {(activeMethod === "manual" || photoPreview) && <>
          <div className="manual-fields">
            <label className="food-name">{t.calorieTracker.foodNameLabel}<input value={foodName} onChange={(event) => { setFoodName(event.target.value); setSelectedProduct(null); setAiEstimate(null); }} placeholder={t.calorieTracker.foodNamePlaceholder} autoComplete="off" /></label>
            <label>{t.calorieTracker.portionLabel}<input inputMode="decimal" value={grams} onChange={(event) => updateGrams(event.target.value)} placeholder="100" /></label>
            {nutritionFields.map((field) => <label key={field.key}>{field.label} ({field.unit})<input inputMode="decimal" value={formatAmount(nutrition[field.key], dateLocale)} onChange={(event) => updateNutrition(field.key, event.target.value)} placeholder="0" /></label>)}
            {aiEstimate && <div className={`ai-estimate-card ${aiEstimate.confidence}`}><span>{t.calorieTracker.aiEstimateLabel}</span><strong>{t.calorieTracker.aiEstimateGrams(aiEstimate.grams)}</strong>{aiEstimate.items.length > 0 && <small>{aiEstimate.items.join(" · ")}</small>}<p>{aiEstimate.confidence === "low" ? t.calorieTracker.aiConfidenceLow : aiEstimate.confidence === "high" ? t.calorieTracker.aiConfidenceHigh : t.calorieTracker.aiConfidenceMedium}</p></div>}
            <button type="button" className="primary-btn add-food" disabled={isSubmitting} onClick={() => void submitManual()}><Plus size={16} /> {t.calorieTracker.addToLog}</button>
          </div>
          {activeMethod === "manual" && foodName.trim().length >= 2 && <div className={`food-search-panel ${searchState}`} aria-live="polite">
            <div className="food-search-heading"><strong>{t.calorieTracker.productSearchLabel}</strong><span>{searchState === "loading" ? t.calorieTracker.searchingCatalog : selectedProduct ? t.calorieTracker.productSelected(selectedProduct.source) : t.calorieTracker.typeProductName}</span></div>
            {searchState === "loading" && <div className="food-search-loading"><i /><i /><i /> {t.calorieTracker.preparingResults}</div>}
            {searchState === "ready" && <div className="food-search-results">{searchResults.map((product) => <button type="button" key={product.id} onClick={() => selectProduct(product)}><span><strong>{product.name}</strong><small>{[product.brand, product.source, product.verified ? "Doğrulanmış" : "Sağlayıcı verisi"].filter(Boolean).join(" · ")}</small></span><b>{product.nutritionPer100g.calories} kcal<small>/100 g</small></b></button>)}</div>}
            {(searchState === "empty" || searchState === "error") && <div className="food-search-empty"><strong>{searchState === "error" ? t.calorieTracker.catalogUnavailable : t.calorieTracker.noResultsFound}</strong><span>{searchNotice || t.calorieTracker.manualFallbackNote}</span><button type="button" className="ai-estimate-btn" disabled={estimating} onClick={() => void estimateFromText()}><Sparkles size={14} /> {estimating ? t.calorieTracker.estimating : t.calorieTracker.estimateWithAi}</button></div>}
            {selectedProduct && <div className="selected-food-summary"><span><strong>{selectedProduct.name}</strong><small>{t.calorieTracker.perGram(formatAmount(Number(grams) || 0, dateLocale), selectedProduct.source)}</small></span><b>{nutrition.calories} kcal</b><p>{t.calorieTracker.fiberLabel(formatAmount(nutrition.fiber, dateLocale))}{Object.entries(nutrition.micros).filter(([, value]) => Number(value) > 0).slice(0, 3).map(([key, value]) => ` · ${microLabel(t, key as keyof FoodMicronutrients)} ${formatAmount(Number(value), dateLocale)} mg`).join("")}</p></div>}
          </div>}
        </>}
        {message && <p className="food-message">{message}</p>}
      </div>
    </section>

    <section className="food-log"><div className="section-title"><div><div className="eyebrow">{t.calorieTracker.dailySummaryEyebrow}</div><h2>{t.calorieTracker.yourMeals}</h2></div><span className="log-total"><Utensils size={14} /> {t.calorieTracker.recordCount(dailyEntries.length)}</span></div>{meals.map((mealName) => { const group = dailyEntries.filter((entry) => entry.meal === mealName); const groupCalories = group.reduce((sum, entry) => sum + entry.calories, 0); return <div className="meal-group" key={mealName}><div className="meal-group-head"><strong>{translateMeal(t, mealName)}</strong><span>{groupCalories} kcal</span></div>{group.length ? group.map((entry) => <article className="food-log-item" key={entry.id}><div className="food-icon">{entry.meal === "Kahvaltı" ? "☀" : entry.meal === "Öğle yemeği" ? "◒" : entry.meal === "Akşam yemeği" ? "◐" : "✦"}</div><div><strong>{entry.name}</strong><small>{entry.time} · {translateFoodSource(t, entry.source)}</small><span>P {entry.protein}g · K {entry.carbs}g · Y {entry.fat}g</span></div><b>{entry.calories} <small>kcal</small></b><button type="button" aria-label={t.calorieTracker.deleteEntry(entry.name)} onClick={() => void deleteEntry(entry.id)}><Trash2 size={15} /></button></article>) : <p className="empty-meal">{t.calorieTracker.noRecordsYet}</p>}</div>; })}</section>
  </div>;
}
