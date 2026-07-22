"use client";

import { Barcode, Camera, ChevronLeft, ChevronRight, ImagePlus, Plus, Search, Sparkles, Trash2, Utensils } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { NutritionGoalsPanel } from "@/components/NutritionGoalsPanel";
import { emptyFoodNutrition, scaleFoodNutrition, type FoodMicronutrients, type FoodNutrition, type FoodSearchResult } from "@/lib/food-search";
import { calculateNutritionGoal, calculateWeeklyWeightTrend, inferNutritionGoal, sanitizeNutritionGoal, type NutritionGoal, type NutritionGoalType, type WeightTrend } from "@/lib/nutrition-goals";
import { isNativeApp, mobileImpact, takeFoodPhoto } from "@/lib/mobile";
import { createClient } from "@/lib/supabase/client";
import { istanbulDateKey } from "@/lib/workout-calendar";

type Meal = "Kahvaltı" | "Öğle yemeği" | "Akşam yemeği" | "Atıştırmalık";
type FoodEntry = { id: string; name: string; meal: Meal; calories: number; protein: number; carbs: number; fat: number; fiber?: number; grams?: number; micros?: FoodMicronutrients; time: string; consumedAt: string; source: "Barkod" | "Fotoğraf" | "Manuel" };

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

const nutritionFields: Array<{ key: Exclude<keyof FoodNutrition, "micros">; label: string; unit: string }> = [
  { key: "calories", label: "KALORİ", unit: "kcal" },
  { key: "protein", label: "PROTEİN", unit: "g" },
  { key: "carbs", label: "KARBONHİDRAT", unit: "g" },
  { key: "fat", label: "YAĞ", unit: "g" },
  { key: "fiber", label: "LİF", unit: "g" },
];

const microLabels: Record<keyof FoodMicronutrients, string> = { sodiumMg: "Sodyum", calciumMg: "Kalsiyum", ironMg: "Demir", potassiumMg: "Potasyum", vitaminCMg: "C vitamini" };

function formatAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function todayLabel(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function CalorieTracker({ userId, bmr = 1600, tdee = 2100, weightKg = 70, activityFactor = 1.375, workoutDays = 3, profileGoal = "" }: CalorieTrackerProps) {
  const inferredGoal = inferNutritionGoal(profileGoal);
  const recommendedGoals = useMemo(() => Object.fromEntries((["lose", "maintain", "gain"] as NutritionGoalType[]).map((goalType) => [goalType, calculateNutritionGoal({ goalType, bmr, tdee, weightKg, activityFactor, workoutDays })])) as Record<NutritionGoalType, NutritionGoal>, [activityFactor, bmr, tdee, weightKg, workoutDays]);
  const [entries, setEntries] = useState<FoodEntry[]>(initialEntries);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal>(() => calculateNutritionGoal({ goalType: inferredGoal, bmr, tdee, weightKg, activityFactor, workoutDays }));
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
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
  const [message, setMessage] = useState("");
  const [mealAdvice, setMealAdvice] = useState("");
  const [mealAdviceLoading, setMealAdviceLoading] = useState(false);
  const [mealAdviceSource, setMealAdviceSource] = useState<"gemini" | "fallback">("fallback");
  const [adviceRevision, setAdviceRevision] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dateOffset, setDateOffset] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const barcodeVideo = useRef<HTMLVideoElement>(null);

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
      setEntries(data.map((entry) => ({ id: String(entry.id), name: String(entry.name), meal: entry.meal as Meal, calories: Number(entry.calories), protein: Number(entry.protein_g), carbs: Number(entry.carbs_g), fat: Number(entry.fat_g), fiber: Number(entry.fiber_g || 0), grams: Number(entry.grams || 0) || undefined, micros: entry.micros && typeof entry.micros === "object" ? entry.micros as FoodMicronutrients : undefined, time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(String(entry.consumed_at))), consumedAt: String(entry.consumed_at), source: entry.source as FoodEntry["source"] })));
    }
    void loadEntries();
    return () => { cancelled = true; };
  }, [userId]);

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
      setWeightTrend(calculateWeeklyWeightTrend((measurements || []).map((item) => ({ measuredAt: String(item.measured_at), weightKg: item.weight_kg === null ? null : Number(item.weight_kg) }))));
    }
    void loadNutritionGoal();
    return () => { cancelled = true; };
  }, [inferredGoal, recommendedGoals, userId]);

  useEffect(() => {
    if (activeMethod !== "manual" || foodName.trim().length < 2 || selectedProduct?.name === foodName) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState("loading");
      setSearchNotice("");
      try {
        const response = await fetch(`/api/nutrition/search?q=${encodeURIComponent(foodName.trim())}`, { signal: controller.signal });
        const result = await response.json().catch(() => ({})) as { results?: FoodSearchResult[]; error?: string; notice?: string };
        if (controller.signal.aborted) return;
        const results = Array.isArray(result.results) ? result.results : [];
        setSearchResults(results);
        setSearchNotice(result.notice || result.error || "");
        setSearchState(response.ok ? (results.length ? "ready" : "empty") : "error");
      } catch {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchNotice("Ürün araması şu an tamamlanamadı. Besinini kendi değerlerinle ekleyebilirsin.");
        setSearchState("error");
      }
    }, 320);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [activeMethod, foodName, selectedProduct?.name]);

  useEffect(() => {
    if (!isScanning) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: number | null = null;
    async function scan() {
      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) { setMessage("Bu tarayıcıda kamera ile barkod tarama desteklenmiyor. Numarayı yazarak devam edebilirsin."); setIsScanning(false); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        if (cancelled || !barcodeVideo.current) return;
        barcodeVideo.current.srcObject = stream;
        await barcodeVideo.current.play();
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const detect = async () => {
          if (cancelled || !barcodeVideo.current) return;
          const results = await detector.detect(barcodeVideo.current).catch(() => []);
          if (results[0]?.rawValue) { setBarcode(results[0].rawValue); setIsScanning(false); setMessage("Barkod okundu. Ürünü bulmak için devam et."); return; }
          timer = window.setTimeout(detect, 300);
        };
        void detect();
      } catch { setMessage("Kameraya erişilemedi. İzin vererek yeniden deneyebilir veya barkod numarasını yazabilirsin."); setIsScanning(false); }
    }
    void scan();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [isScanning]);

  const selectedDate = useMemo(() => { const date = new Date(); date.setDate(date.getDate() + dateOffset); return istanbulDateKey(date); }, [dateOffset]);
  const dailyEntries = useMemo(() => entries.filter((entry) => istanbulDateKey(new Date(entry.consumedAt)) === selectedDate), [entries, selectedDate]);
  const totals = useMemo(() => dailyEntries.reduce((total, entry) => ({ calories: total.calories + entry.calories, protein: total.protein + entry.protein, carbs: total.carbs + entry.carbs, fat: total.fat + entry.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [dailyEntries]);
  const remaining = Math.max(0, nutritionGoal.calorieTarget - totals.calories);
  const progress = Math.min(100, Math.round((totals.calories / Math.max(1, nutritionGoal.calorieTarget)) * 100));

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMealAdviceLoading(true);
      try {
        const response = await fetch("/api/nutrition/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calorieTarget: nutritionGoal.calorieTarget, proteinTarget: nutritionGoal.proteinGrams, carbsTarget: nutritionGoal.carbsGrams, fatTarget: nutritionGoal.fatGrams, totals, meals: dailyEntries.map(({ name, meal: mealName, calories, protein, carbs, fat }) => ({ name, meal: mealName, calories, protein, carbs, fat })) }),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({})) as { advice?: string; source?: "gemini" | "fallback" };
        if (!controller.signal.aborted && result.advice) {
          setMealAdvice(result.advice);
          setMealAdviceSource(result.source === "gemini" ? "gemini" : "fallback");
        }
      } catch {
        if (!controller.signal.aborted) setMealAdvice("Sonraki öğünde eksik kalan makroları tamamlayacak sade bir protein, sebze veya meyve ve ölçülü karbonhidrat seçebilirsin.");
      } finally {
        if (!controller.signal.aborted) setMealAdviceLoading(false);
      }
    }, adviceRevision ? 0 : 650);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [adviceRevision, dailyEntries, nutritionGoal.calorieTarget, nutritionGoal.carbsGrams, nutritionGoal.fatGrams, nutritionGoal.proteinGrams, selectedDate, totals]);

  async function addEntry(entry: Omit<FoodEntry, "id" | "time" | "consumedAt">, productBarcode?: string) {
    const now = new Date();
    const record = { ...entry, id: crypto.randomUUID(), time: new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(now), consumedAt: now.toISOString() };
    setEntries((current) => [record, ...current]);
    if (userId) {
      const supabase = createClient();
      const { error } = await supabase?.from("food_entries").insert({ id: record.id, user_id: userId, consumed_at: record.consumedAt, meal: record.meal, name: record.name, calories: record.calories, protein_g: record.protein, carbs_g: record.carbs, fat_g: record.fat, fiber_g: record.fiber || 0, grams: record.grams || null, micros: record.micros || {}, source: record.source, barcode: productBarcode || null }) || {};
      if (error) setMessage("Kayıt bu cihazda eklendi; hesabına eşitlenemedi.");
    }
    setFoodName(""); setGrams("100"); setNutrition(emptyFoodNutrition()); setSelectedProduct(null); setSearchResults([]); setBarcode(""); setPhotoPreview(null); setMessage("");
  }

  function submitManual() {
    if (!foodName.trim() || !nutrition.calories) { setMessage("Besin adı ve kalori bilgisini ekle."); return; }
    void addEntry({ name: foodName.trim(), meal, calories: nutrition.calories, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, fiber: nutrition.fiber, grams: Number(grams) || undefined, micros: nutrition.micros, source: activeMethod === "photo" ? "Fotoğraf" : selectedProduct?.barcode ? "Barkod" : "Manuel" }, selectedProduct?.barcode);
  }

  async function findBarcode() {
    if (!barcode.trim()) { setMessage("Barkod numarasını gir veya kamerayla okut."); return; }
    setMessage("Ürün kataloğunda aranıyor…");
    const response = await fetch(`/api/nutrition/barcode?code=${encodeURIComponent(barcode)}`);
    const result = await response.json().catch(() => ({})) as { error?: string; name?: string; calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; micros?: FoodMicronutrients };
    if (!response.ok || !result.name) { setMessage(result.error || "Ürün bulunamadı."); return; }
    setFoodName(result.name);
    setGrams("100");
    setNutrition({ calories: result.calories || 0, protein: result.protein || 0, carbs: result.carbs || 0, fat: result.fat || 0, fiber: result.fiber || 0, micros: result.micros || {} });
    setSelectedProduct({ id: `barcode-${barcode}`, name: result.name, barcode, servingGrams: 100, nutritionPer100g: { calories: result.calories || 0, protein: result.protein || 0, carbs: result.carbs || 0, fat: result.fat || 0, fiber: result.fiber || 0, micros: result.micros || {} }, source: "Open Food Facts" });
    setActiveMethod("manual");
    setMessage("Ürün bulundu. Porsiyon ve değerleri kontrol ederek günlüğe ekleyebilirsin.");
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const photoDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(); reader.onerror = reject; reader.readAsDataURL(file); }).catch(() => "");
    await analyzeFoodPhoto(photoDataUrl, URL.createObjectURL(file));
  }

  async function analyzeFoodPhoto(photoDataUrl: string, previewUrl = photoDataUrl) {
    if (!photoDataUrl) { setMessage("Fotoğraf okunamadı. Başka bir fotoğraf dene."); return; }
    setPhotoPreview(previewUrl);
    setMessage("Fotoğraf analiz ediliyor…");
    const response = await fetch("/api/nutrition/analyze-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoDataUrl }) });
    const result = await response.json().catch(() => ({})) as { error?: string; name?: string; calories?: number; protein?: number; carbs?: number; fat?: number };
    if (!response.ok || !result.name) { setMessage(result.error || "Fotoğraf analizi tamamlanamadı."); return; }
    setMessage("Tahmini değerleri kontrol ederek günlüğe ekleyebilirsin.");
    setFoodName(result.name); setGrams("100"); setNutrition({ calories: result.calories || 0, protein: result.protein || 0, carbs: result.carbs || 0, fat: result.fat || 0, fiber: 0, micros: {} }); setSelectedProduct(null);
  }

  function updateNutrition(field: Exclude<keyof FoodNutrition, "micros">, value: string) {
    const parsed = Number(value.replace(",", "."));
    setNutrition((current) => ({ ...current, [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }));
  }

  function updateGrams(value: string) {
    const next = Number(value.replace(",", "."));
    const previous = Number(grams.replace(",", "."));
    setGrams(value);
    if (Number.isFinite(next) && next >= 0 && Number.isFinite(previous) && previous > 0) setNutrition((current) => scaleFoodNutrition(current, (next / previous) * 100));
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
    setMessage(`${product.source} verileri yüklendi. Değerleri istediğin gibi düzenleyebilirsin.`);
  }

  async function chooseFoodPhoto() {
    if (!isNativeApp()) { cameraInput.current?.click(); return; }
    try {
      const photoDataUrl = await takeFoodPhoto();
      if (photoDataUrl) { await mobileImpact(); await analyzeFoodPhoto(photoDataUrl); }
    } catch { setMessage("Kamera veya fotoğraf izni verilmedi. Cihaz ayarlarından daha sonra açabilirsin."); }
  }

  async function deleteEntry(entryId: string) {
    setEntries((current) => current.filter((item) => item.id !== entryId));
    if (userId) await createClient()?.from("food_entries").delete().eq("id", entryId);
  }

  async function saveNutritionGoal(goal: NutritionGoal) {
    const safeGoal = sanitizeNutritionGoal({ ...goal, isManual: true });
    if (!safeGoal) { setGoalMessage("Hedef değerlerini kontrol et."); return; }
    setGoalSaving(true);
    setGoalMessage("");
    setNutritionGoal(safeGoal);
    if (!userId) { setGoalSaving(false); setGoalMessage("Hedefler bu oturum için güncellendi."); return; }
    const supabase = createClient();
    const { error } = await supabase?.from("nutrition_goals").upsert({ user_id: userId, goal_type: safeGoal.goalType, calorie_target: safeGoal.calorieTarget, protein_g: safeGoal.proteinGrams, carbs_g: safeGoal.carbsGrams, fat_g: safeGoal.fatGrams, bmr: safeGoal.bmr, tdee: safeGoal.tdee, calorie_adjustment: safeGoal.calorieAdjustment, activity_factor: safeGoal.activityFactor, workout_days: safeGoal.workoutDays, is_manual: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" }) || {};
    setGoalSaving(false);
    setGoalMessage(error ? "Hedefler cihazda güncellendi ancak hesabına kaydedilemedi." : "Kişisel beslenme hedeflerin kaydedildi.");
  }

  return <div className="calorie-tracker subview">
    <div className="calorie-page-head">
      <div><div className="eyebrow">BESLENME TAKİBİ</div><h1>Yediklerini gör,<br /><em>hedefine yaklaş.</em></h1><p className="lead">Her öğünü barkodla, fotoğrafla veya yazarak ekle. Günlük enerjini tek yerden takip et.</p></div>
      <div className="date-switcher"><button type="button" aria-label="Önceki gün" onClick={() => setDateOffset((day) => day - 1)}><ChevronLeft size={17} /></button><div><span>{dateOffset === 0 ? "BUGÜN" : "GÜNLÜK"}</span><strong>{todayLabel(dateOffset)}</strong></div><button type="button" aria-label="Sonraki gün" disabled={dateOffset >= 0} onClick={() => setDateOffset((day) => Math.min(0, day + 1))}><ChevronRight size={17} /></button></div>
    </div>

    <NutritionGoalsPanel key={`${nutritionGoal.goalType}-${nutritionGoal.calorieTarget}-${nutritionGoal.proteinGrams}-${nutritionGoal.carbsGrams}-${nutritionGoal.fatGrams}`} goal={nutritionGoal} recommendedGoals={recommendedGoals} totals={totals} trend={weightTrend} saving={goalSaving} saveMessage={goalMessage} onSave={saveNutritionGoal} />

    <section className="calorie-hero">
      <div className="calorie-progress" style={{ "--progress": `${progress}%` } as React.CSSProperties}><div><small>BUGÜN ALINAN</small><strong>{totals.calories}<em> kcal</em></strong><span>Hedefinin %{progress}&apos;i</span></div></div>
      <div className="calorie-hero-copy"><span>GÜNLÜK HEDEF</span><strong>{nutritionGoal.calorieTarget} kcal</strong><p>{remaining ? `${remaining} kcal hakkın kaldı. Dengeli bir sonraki öğün planlayabilirsin.` : "Günlük hedefe ulaştın. Bugünkü açlığını ve antrenmanını dikkate al."}</p><div className="macro-row"><span><i className="protein" />Protein <b>{totals.protein}/{nutritionGoal.proteinGrams}g</b></span><span><i className="carbs" />Karbonhidrat <b>{totals.carbs}/{nutritionGoal.carbsGrams}g</b></span><span><i className="fat" />Yağ <b>{totals.fat}/{nutritionGoal.fatGrams}g</b></span></div></div>
      <div className="calorie-remaining"><span>KALAN</span><strong>{remaining}</strong><small>kcal</small></div>
    </section>

    <section className="meal-ai-advice" aria-labelledby="meal-ai-advice-title">
      <div className="meal-ai-icon" aria-hidden="true">✦</div><div><span>AI ÖĞÜN TAVSİYESİ</span><h2 id="meal-ai-advice-title">Bir sonraki öğünde neye odaklanmalı?</h2><p>{mealAdviceLoading ? "Günlük hedeflerin ve öğünlerin birlikte değerlendiriliyor…" : mealAdvice || "Öğün özeti hazırlanıyor…"}</p><small>{mealAdviceSource === "gemini" ? "Kişisel hedef ve bugünkü kayıtlara göre hazırlandı." : "Güvenli beslenme kurallarıyla hazırlandı."} Tıbbi beslenme tavsiyesi değildir.</small></div><button type="button" disabled={mealAdviceLoading} onClick={() => setAdviceRevision((value) => value + 1)}>{mealAdviceLoading ? "Hazırlanıyor" : "Yenile"}</button>
    </section>

    <section className="food-entry-panel">
      <div className="section-title"><div><div className="eyebrow">ÖĞÜN EKLE</div><h2>Nasıl eklemek istersin?</h2></div><span className="food-entry-note"><Sparkles size={14} /> Hızlı ve pratik</span></div>
      <div className="food-methods">
        <button type="button" className={activeMethod === "barcode" ? "active" : ""} onClick={() => setActiveMethod("barcode")}><Barcode /><strong>Barkod tara</strong><small>Paketli ürünleri bul</small></button>
        <button type="button" className={activeMethod === "photo" ? "active" : ""} onClick={() => setActiveMethod("photo")}><Camera /><strong>Fotoğraf çek</strong><small>Öğününü analiz et</small></button>
        <button type="button" className={activeMethod === "manual" ? "active" : ""} onClick={() => setActiveMethod("manual")}><Search /><strong>Yazarak ekle</strong><small>Kendin gir veya ara</small></button>
      </div>
      <div className="entry-workspace">
        <label>ÖĞÜN<select value={meal} onChange={(event) => setMeal(event.target.value as Meal)}>{meals.map((option) => <option key={option}>{option}</option>)}</select></label>
        {activeMethod === "barcode" && <div className="method-content barcode-content"><button type="button" className="scanner-visual" onClick={() => setIsScanning((current) => !current)}>{isScanning ? <video ref={barcodeVideo} muted playsInline /> : <><Barcode size={42} /><span>Telefon kamerasıyla okut veya numarayı gir</span></>}<b>{isScanning ? "Taramayı durdur" : "Kamerayı aç"}</b></button><label>BARKOD NUMARASI<input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="8690…" /></label><button type="button" className="primary-btn" onClick={() => void findBarcode()}>Ürünü bul <span>→</span></button><small>Değerler 100 g üzerinden getirilir; porsiyona göre düzenleyebilirsin.</small></div>}
        {activeMethod === "photo" && <div className="method-content photo-food-content"><button type="button" className="food-photo-drop" onClick={() => void chooseFoodPhoto()}>{photoPreview ? <Image src={photoPreview} alt="Analiz için seçilen öğün" width={640} height={480} unoptimized /> : <><ImagePlus size={26} /><strong>Öğününün fotoğrafını çek</strong><span>Yemeği kadraja al, yaklaşık değerleri birlikte kontrol edelim.</span></>}</button><input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />{photoPreview && <button type="button" className="outline-btn" onClick={() => void chooseFoodPhoto()}>Başka fotoğraf seç</button>}</div>}
        {(activeMethod === "manual" || photoPreview) && <>
          <div className="manual-fields">
            <label className="food-name">BESİN / ÖĞÜN<input value={foodName} onChange={(event) => { setFoodName(event.target.value); setSelectedProduct(null); }} placeholder="Örn. yoğurt, tavuk göğsü veya yulaf" autoComplete="off" /></label>
            <label>PORSİYON (g)<input inputMode="decimal" value={grams} onChange={(event) => updateGrams(event.target.value)} placeholder="100" /></label>
            {nutritionFields.map((field) => <label key={field.key}>{field.label} ({field.unit})<input inputMode="decimal" value={formatAmount(nutrition[field.key])} onChange={(event) => updateNutrition(field.key, event.target.value)} placeholder="0" /></label>)}
            <button type="button" className="primary-btn add-food" onClick={submitManual}><Plus size={16} /> Günlüğe ekle</button>
          </div>
          {activeMethod === "manual" && foodName.trim().length >= 2 && <div className={`food-search-panel ${searchState}`} aria-live="polite">
            <div className="food-search-heading"><strong>ÜRÜN ARAMASI</strong><span>{searchState === "loading" ? "Katalog aranıyor…" : selectedProduct ? `${selectedProduct.source} seçildi` : "Türkçe ürün adını yaz"}</span></div>
            {searchState === "loading" && <div className="food-search-loading"><i /><i /><i /> Sonuçlar hazırlanıyor</div>}
            {searchState === "ready" && <div className="food-search-results">{searchResults.map((product) => <button type="button" key={product.id} onClick={() => selectProduct(product)}><span><strong>{product.name}</strong><small>{[product.brand, product.source].filter(Boolean).join(" · ")}</small></span><b>{product.nutritionPer100g.calories} kcal<small>/100 g</small></b></button>)}</div>}
            {(searchState === "empty" || searchState === "error") && <div className="food-search-empty"><strong>{searchState === "error" ? "Katalog şu an kullanılamıyor" : "Sonuç bulunamadı"}</strong><span>{searchNotice || "Besinini gram ve değerleriyle kendin oluşturabilirsin."}</span></div>}
            {selectedProduct && <div className="selected-food-summary"><span><strong>{selectedProduct.name}</strong><small>{formatAmount(Number(grams) || 0)} g · {selectedProduct.source}</small></span><b>{nutrition.calories} kcal</b><p>Lif {formatAmount(nutrition.fiber)} g{Object.entries(nutrition.micros).filter(([, value]) => Number(value) > 0).slice(0, 3).map(([key, value]) => ` · ${microLabels[key as keyof FoodMicronutrients]} ${formatAmount(Number(value))} mg`).join("")}</p></div>}
          </div>}
        </>}
        {message && <p className="food-message">{message}</p>}
      </div>
    </section>

    <section className="food-log"><div className="section-title"><div><div className="eyebrow">GÜNÜN ÖZETİ</div><h2>Öğünlerin</h2></div><span className="log-total"><Utensils size={14} /> {dailyEntries.length} kayıt</span></div>{meals.map((mealName) => { const group = dailyEntries.filter((entry) => entry.meal === mealName); const groupCalories = group.reduce((sum, entry) => sum + entry.calories, 0); return <div className="meal-group" key={mealName}><div className="meal-group-head"><strong>{mealName}</strong><span>{groupCalories} kcal</span></div>{group.length ? group.map((entry) => <article className="food-log-item" key={entry.id}><div className="food-icon">{entry.meal === "Kahvaltı" ? "☀" : entry.meal === "Öğle yemeği" ? "◒" : entry.meal === "Akşam yemeği" ? "◐" : "✦"}</div><div><strong>{entry.name}</strong><small>{entry.time} · {entry.source}</small><span>P {entry.protein}g · K {entry.carbs}g · Y {entry.fat}g</span></div><b>{entry.calories} <small>kcal</small></b><button type="button" aria-label={`${entry.name} kaydını sil`} onClick={() => void deleteEntry(entry.id)}><Trash2 size={15} /></button></article>) : <p className="empty-meal">Henüz kayıt yok.</p>}</div>; })}</section>
  </div>;
}
