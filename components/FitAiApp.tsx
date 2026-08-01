"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AiCoachChat } from "@/components/AiCoachChat";
import { AuthScreen } from "@/components/AuthScreen";
import { adaptPrescription, summarizeTrainingAdaptation, type TrainingAdaptation, type WorkoutDifficulty } from "@/lib/training-adaptation";
import { ExerciseAnimation as ExerciseFrameAnimation } from "@/components/exercises/ExerciseAnimation";
import { ExerciseLibrary } from "@/components/exercises/ExerciseLibrary";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslations, translateDifficulty, translatePainArea, type Dictionary } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";
import { tr } from "@/lib/i18n/dictionaries/tr";
import { CalorieTracker } from "@/components/CalorieTracker";
import { BodyMeasurements } from "@/components/BodyMeasurements";
import { WorkoutCalendar } from "@/components/WorkoutCalendar";
import { ActivityStreak } from "@/components/ActivityStreak";
import { ActivityLogger } from "@/components/ActivityLogger";
import { WeeklyAiReview } from "@/components/WeeklyAiReview";
import { WorkoutSetLogger } from "@/components/WorkoutSetLogger";
import { MobileRuntime } from "@/components/MobileRuntime";
import { SportyLoader } from "@/components/SportyLoader";
import { PreferenceSync } from "@/components/PreferenceSync";
import { PlanEditor } from "@/components/PlanEditor";
import { GoalPlanCard } from "@/components/GoalPlanCard";
import { QuickActions } from "@/components/QuickActions";
import type { AppView } from "@/lib/quick-actions";
import { FrozenAccountScreen, ProfileManager } from "@/components/ProfileManager";
import { TrainingPlaceSwitch } from "@/components/TrainingPlaceSwitch";
import { BodyMetrics } from "@/components/onboarding/BodyMetrics";
import { GoalPicker } from "@/components/onboarding/GoalPicker";
import { DEFAULT_HEIGHT_CM, DEFAULT_WEIGHT_KG, WEIGHT_RANGE, readMeasure } from "@/lib/body-metrics";
import { planGoal as buildGoalProjection } from "@/lib/goal-plan";
import { getExerciseById, getExercisesForAI } from "@/lib/exercise-service";
import { trustedExerciseMedia } from "@/lib/trusted-exercise-media";
import { translateExerciseLabel, turkishExerciseInstructions } from "@/lib/exercise-translations";
import { extractSessionMinutes, extractWeeklyDays, planProgressionBlock } from "@/lib/training-profile";
import { alternativeExercises } from "@/lib/exercise-alternatives";
import { canPerformExercise, hasEquipment, usableEquipmentText } from "@/lib/equipment-match";
import { EQUIPMENT_PROFILES, buildReadyProgram, detectUserEquipmentProfile, isReplacementCompatible, matchesProfile, type EquipmentProfile } from "@/lib/ready-programs";
import { FREE_TEXT_QUESTIONS, QUESTION, QUESTION_COUNT, emptyHistory, isHistoryComplete, normalizeHistory } from "@/lib/onboarding-questions";
import { applyPreviousPerformance, buildCompletedExerciseLog, createWorkoutSetDrafts, exerciseLogKey, type CompletedExerciseLog, type PreviousExercisePerformance, type WorkoutSetDraft } from "@/lib/workout-log";
import { localTimeKey } from "@/lib/workout-calendar";
import { localDateKey } from "@/lib/streak";
import { inferWorkoutDays } from "@/lib/nutrition-goals";
import type { EditableWorkout } from "@/lib/plan-editor";
import type { Exercise } from "@/types/exercise";
import { calculateAge, isValidBirthDate, type AccountStatus, type EditableProfile } from "@/lib/profile";
import { isVerifiedAuthUser } from "@/lib/auth";
import { saveProfileWithHistory, signedAvatarUrl } from "@/lib/profile-service";
import { detectNewPersonalRecords, summarizePersonalRecords, type NewPersonalRecord, type PersonalRecord, type SetLogInput } from "@/lib/personal-records";
import { formatWeight, unitToKg, type WeightUnit } from "@/lib/units";
import { setStoredGoalPlan, useStoredGoalPlan, useWeightUnit } from "@/lib/preferences";
import { authorizedFetch } from "@/lib/api-client";

// Kullanıcı hangi arayüz dilini seçerse seçsin, seçilen cevaplar bu Türkçe
// kanonik değerlerle saklanır — plan üretimi ve ağrı bölgesi eşleştirmesi
// (ör. pain.includes("diz")) bu sabit değerlere dayanır. Yalnızca EKRANDA
// GÖSTERİLEN metin `t.onboarding.historyQuestions/answerOptions` ile çevrilir.
const answerOptions = tr.onboarding.answerOptions;

// Onboarding adımları. Daha önce çıplak sayılardı (5 = gösterge paneli);
// araya ekran eklemek her karşılaştırmayı tek tek gözden geçirmeyi
// gerektiriyordu. Panel her zaman SON adımdır.
const STEP = { profile: 1, place: 2, photo: 3, test: 4, building: 5, report: 6, dashboard: 7 } as const;
const FORM_STEP_COUNT = 4;

// Diğer seçeneklerle birlikte işaretlenmesi anlamsız olan cevaplar. Bunlardan
// biri seçilince diğerleri temizlenir (ör. "Yok" ile birlikte "Diz" olamaz).
const EXCLUSIVE_ANSWERS = new Set(["Yok", "Hayır", "0 gün"]);

const coreExerciseLibrary = [
  { name: "Goblet Squat", english: "Goblet Squat", area: "Bacak", tone: "orange", icon: "◒", requires: ["dambıl", "kettlebell"], bodyweight: false, goals: ["güç", "kas", "kilo"], instructions: "Ayaklarını omuz genişliğinde aç. Ağırlığı göğsünde tut, kalçanı geriye ve aşağıya indir; topuklardan güç alarak kalk." },
  { name: "Eğimli Şınav", english: "Incline Push-up", area: "Göğüs", tone: "blue", icon: "✦", requires: ["bench", "sehpa"], bodyweight: false, goals: ["güç", "kondisyon", "kilo"], instructions: "Ellerini sağlam bir yükseltiye koy. Vücudunu düz bir çizgide tut, göğsünü kontrollü indir ve yüksel." },
  { name: "Dambıl Row", english: "Dumbbell Row", area: "Sırt", tone: "purple", icon: "↗", requires: ["dambıl"], bodyweight: false, goals: ["güç", "kas"], instructions: "Gövdeni sabit ve sırtını düz tut. Dirseğini kalçana doğru çek, kürek kemiklerini sık ve ağırlığı yavaşça indir." },
  { name: "Yerde Dambıl Göğüs Presi", english: "Dumbbell Floor Press", area: "Göğüs", tone: "blue", icon: "✦", requires: ["dambıl"], bodyweight: false, goals: ["güç", "kas", "kilo"], instructions: "Sırt üstü yere yat, dizlerini bük ve ayaklarını yere bas. Dirseklerini yere kontrollü yaklaştır, dambılları göğsünün üzerinden yukarı it ve yavaşça indir." },
  { name: "Glute Bridge", english: "Glute Bridge", area: "Kalça", tone: "orange", icon: "◓", requires: [], bodyweight: true, goals: ["güç", "kilo"], instructions: "Sırt üstü yat, dizlerini bük. Topuklarından iterek kalçanı kaldır, tepede sık ve kontrollü indir." },
  { name: "Plank", english: "Plank", area: "Core", tone: "blue", icon: "—", requires: [], bodyweight: true, goals: ["güç", "kondisyon", "kilo"], instructions: "Dirseklerini omuzlarının altına yerleştir. Karnını ve kalçanı sık, belini çökertmeden düz çizgiyi koru." },
  { name: "Reverse Lunge", english: "Reverse Lunge", area: "Bacak", tone: "purple", icon: "↘", requires: [], bodyweight: true, goals: ["güç", "kilo", "kondisyon"], instructions: "Bir ayağınla geriye adım at. Ön dizini ayak bileğinin üzerinde tut, iki diz kontrollü bükülüp öndeki topuktan kalk." },
  { name: "Band Row", english: "Resistance Band Row", area: "Sırt", tone: "blue", icon: "↔", requires: ["band", "lastik"], bodyweight: false, goals: ["güç", "kas"], instructions: "Bandı göğüs hizasında sabitle. Dirseklerini geriye çek, omuzlarını kulaklarından uzak tut ve yavaşça bırak." },
  { name: "Şınav", english: "Push-up", area: "Göğüs", tone: "blue", icon: "✦", requires: [], bodyweight: true, goals: ["güç", "kas", "kilo", "kondisyon"], instructions: "Ellerini omuzlarının biraz dışına koy. Gövdeni düz tutarak göğsünü yere yaklaştır ve nefes vererek it." },
  { name: "Bulgarian Split Squat", english: "Bulgarian Split Squat", area: "Bacak", tone: "orange", icon: "◒", requires: ["bench", "sehpa"], bodyweight: false, goals: ["güç", "kas"], instructions: "Arka ayağını yükseltiye koy. Ön ayağınla dengeni koruyarak kalçanı indir, öndeki topuktan güç alarak yüksel." },
  { name: "Dambıl Omuz Press", english: "Dumbbell Shoulder Press", area: "Omuz", tone: "purple", icon: "↥", requires: ["dambıl"], bodyweight: false, goals: ["güç", "kas"], instructions: "Dambılları omuz hizasında başlat. Kaburgalarını kontrol altında tutarak ağırlıkları baş üstüne it ve yavaşça indir." },
  { name: "Dead Bug", english: "Dead Bug", area: "Core", tone: "orange", icon: "·", requires: [], bodyweight: true, goals: ["güç", "kilo"], instructions: "Sırt üstü yat ve belini zemine yaklaştır. Karşı kol ve bacağını uzat, merkezini sabit tutarak geri getir." },
  { name: "Mountain Climber", english: "Mountain Climber", area: "Kondisyon", tone: "blue", icon: "↯", requires: [], bodyweight: true, goals: ["kilo", "kondisyon"], instructions: "Yüksek plank pozisyonunda başla. Belini sabit tutarak dizlerini sırayla göğsüne çek; ritmi kontrollü artır." },
  { name: "Step-up", english: "Step-up", area: "Bacak", tone: "orange", icon: "↟", requires: ["bench", "sehpa"], bodyweight: false, goals: ["kilo", "kondisyon", "güç"], instructions: "Bir ayağını sağlam basamağa koy. O ayağın topuğundan iterek yüksel, diğer ayağı hafifçe yanına getir ve kontrollü in." },
  { name: "Lat Pulldown", english: "Lat Pulldown", area: "Sırt", tone: "purple", icon: "↡", requires: ["lat pulldown", "makine", "salon"], bodyweight: false, goals: ["güç", "kas"], instructions: "Barı omuz genişliğinden biraz açık tut. Göğsünü açık bırakıp barı üst göğse doğru çek, kontrollü bırak." },
  { name: "Leg Press", english: "Leg Press", area: "Bacak", tone: "orange", icon: "▣", requires: ["leg press", "makine", "salon"], bodyweight: false, goals: ["güç", "kas", "kilo"], instructions: "Belini pedde sabit tut. Dizleri kilitlemeden platformu it, inişte dizlerini ayak yönünde takip ettir." },
];

type ExerciseDefinition = [string, string, string, string, string[], boolean, string[], string];

const additionalExerciseDefinitions: ExerciseDefinition[] = [
  ["Eğimli Dambıl Press", "Incline Dumbbell Press", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["güç", "kas"], "Bench'i 30–45 dereceye ayarla, dambılları göğsünün üstünden kontrollü indirip yukarı it."],
  ["Düz Dambıl Press", "Flat Dumbbell Press", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["güç", "kas"], "Sırtını sehpaya sabitle, dambılları göğüs hizasında indir ve dirseklerini kontrollü kapat."],
  ["Barbell Bench Press", "Barbell Bench Press", "Göğüs", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı göğüs hizasına kontrollü indir, ayaklarını yere bas ve barı düz bir hatta yukarı it."],
  ["Eğimli Barbell Press", "Incline Barbell Bench Press", "Göğüs", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Eğimli sehpada kürek kemiklerini sabitle, barı üst göğse indirip yukarı it."],
  ["Decline Şınav", "Decline Push-up", "Göğüs", "blue", [], true, ["güç", "kas", "kondisyon"], "Ayaklarını yükseltiye koy, gövdeni düz tut ve göğsünü kontrollü şekilde yere yaklaştır."],
  ["Diz Üstü Şınav", "Knee Push-up", "Göğüs", "blue", [], true, ["güç", "kilo", "kondisyon"], "Dizlerini yerde tut, kalçanı sık ve göğsünü ellerinin arasında kontrollü indir."],
  ["Geniş Tutuş Şınav", "Wide Push-up", "Göğüs", "blue", [], true, ["güç", "kas", "kondisyon"], "Ellerini omuzlardan daha geniş aç, gövdeni düz tutarak aşağı in ve yukarı it."],
  ["Diamond Şınav", "Diamond Push-up", "Göğüs", "blue", [], true, ["güç", "kas"], "Başparmak ve işaret parmaklarını birleştir, dirseklerini gövdeye yakın tutarak itiş yap."],
  ["Archer Şınav", "Archer Push-up", "Göğüs", "blue", [], true, ["güç", "kas"], "Bir kolunu yana açarken diğer kolunla gövdeyi taşımayı kontrollü şekilde değiştir."],
  ["Kablo Göğüs Açış", "Cable Chest Fly", "Göğüs", "blue", ["kablo", "makine", "salon"], false, ["kas", "güç"], "Kollarını hafif bükülü tut, iki kolu göğüs önünde birleştirip kontrollü aç."],
  ["Dambıl Fly", "Dumbbell Fly", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["kas"], "Dambılları göğüs üzerinde birleştir, kolları hafif bükülü tutarak yana aç ve kapat."],
  ["Pec Deck", "Pec Deck Fly", "Göğüs", "blue", ["pec deck", "makine", "salon"], false, ["kas"], "Sırtını pedde sabitle, kolları göğüs önünde birleştir ve omuzlarını yükseltme."],
  ["Dambıl Pullover", "Dumbbell Pullover", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["güç", "kas"], "Dambılı göğüs üzerinde tut, başının arkasına kontrollü indirip göğüs üzerinden geri getir."],
  ["Dar Tutuş Bench Press", "Close Grip Bench Press", "Göğüs", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı omuz genişliğinden dar tut, dirseklerini gövdeye yakın indirip yukarı it."],
  ["Svend Press", "Svend Press", "Göğüs", "blue", ["plaka", "plate", "dambıl"], false, ["güç", "kas"], "Ağırlığı göğüs önünde iki elinle sıkıştır, kolları öne uzatıp geri getir."],
  ["Landmine Press", "Landmine Press", "Göğüs", "blue", ["barbell", "bar", "landmine", "salon"], false, ["güç", "kas"], "Barın ucunu göğüs önünden çapraz yukarı it, gövdeni sabit tutarak kontrollü indir."],
  ["Göğüs Dipsi", "Chest Dips", "Göğüs", "blue", ["dip", "bar", "salon"], false, ["güç", "kas"], "Paralel barda gövdeni hafif öne eğ, dirsekleri büküp göğsü aşağı indir ve it."],
  ["Destekli Göğüs Dipsi", "Assisted Chest Dips", "Göğüs", "blue", ["dip", "makine", "salon"], false, ["güç", "kas"], "Makinenin desteğini kullan, omuzlarını aşağıda tutarak göğsü kontrollü indirip yüksel."],
  ["Barbell Row", "Barbell Row", "Sırt", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Kalçadan öne eğil, sırtını düz tut ve barı göbek yönüne çekip yavaşça bırak."],
  ["Pendlay Row", "Pendlay Row", "Sırt", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Gövdeyi yere yakın sabit tut, barı zeminden göğse doğru güçlü ve kontrollü çek."],
  ["Tek Kol Kablo Row", "One Arm Cable Row", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Tek kolu kalçaya doğru çek, kürek kemiğini sık ve kabloyu kontrollü geri bırak."],
  ["Oturarak Kablo Row", "Seated Cable Row", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Göğsünü açık tut, tutacağı göbeğe doğru çek ve omuzlarını öne düşürmeden bırak."],
  ["Göğüs Destekli Row", "Chest Supported Row", "Sırt", "purple", ["dambıl", "bench", "sehpa", "makine", "salon"], false, ["güç", "kas"], "Göğsünü sehpaya yasla, dirsekleri geriye çek ve ağırlığı kontrollü indir."],
  ["T-Bar Row", "T-Bar Row", "Sırt", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Kalçadan eğil, göğsünü açık tut ve barı gövdene çekerek sırtını sık."],
  ["Ters Row", "Inverted Row", "Sırt", "purple", ["bar", "salon"], false, ["güç", "kas", "kondisyon"], "Vücudunu düz çizgide tut, göğsünü bara yaklaştır ve kontrollü uzaklaş."],
  ["TRX Row", "TRX Row", "Sırt", "purple", ["trx", "askı", "salon"], false, ["güç", "kas"], "Askı tutacaklarını kavra, vücudunu düz tutarak göğsünü ellerine çek."],
  ["Barfiks", "Pull-up", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "kas"], "Barı üstten kavra, kürek kemiklerini aşağı çek ve çeneni bara yaklaştır."],
  ["Ters Tutuş Barfiks", "Chin-up", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "kas"], "Barı avuç içlerin sana bakacak şekilde tut, dirsekleri aşağı çekerek yüksel."],
  ["Destekli Barfiks", "Assisted Pull-up", "Sırt", "purple", ["barfiks", "makine", "salon"], false, ["güç", "kas"], "Makine desteğiyle göğsünü bara yaklaştır, inişi yavaş ve kontrollü yap."],
  ["Negatif Barfiks", "Negative Pull-up", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "kas"], "Üst pozisyondan başla ve kollar tamamen uzayana kadar 3–5 saniyede in."],
  ["Düz Kol Pulldown", "Straight Arm Pulldown", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Kolları düz ve gövdeyi sabit tut, barı kalçaya doğru indirip kontrollü yükselt."],
  ["Tek Kol Lat Pulldown", "Single Arm Lat Pulldown", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Tek kolu üst göğse doğru çek, gövdeyi yana yatırmadan yavaşça bırak."],
  ["Kablo Pullover", "Cable Pullover", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Kolları hafif bükülü tut, barı kalça hizasına indir ve sırtı sık."],
  ["Bel Ekstansiyonu", "Back Extension", "Sırt", "purple", ["bench", "sehpa", "salon"], false, ["güç"], "Kalçadan bükül, sırtı nötr tut ve gövdeyi kalça kaslarıyla düz çizgiye getir."],
  ["Superman", "Superman", "Sırt", "purple", [], true, ["güç", "kondisyon"], "Yüzüstü uzan, karşı kol ve bacağı kaldır, belini sıkıştırmadan kontrollü indir."],
  ["Face Pull", "Face Pull", "Omuz", "purple", ["kablo", "band", "lastik", "makine", "salon"], false, ["güç", "kas"], "Halatı yüz hizasına çek, dirsekleri dışarı aç ve kürek kemiklerini sık."],
  ["Ters Dambıl Açış", "Dumbbell Reverse Fly", "Omuz", "purple", ["dambıl"], false, ["kas", "güç"], "Gövdeyi öne eğ, dambılları yana aç ve omuzlarını kulaklarına çekmeden indir."],
  ["Arnold Press", "Arnold Press", "Omuz", "purple", ["dambıl"], false, ["güç", "kas"], "Avuç içleri sana bakacak şekilde başla, döndürerek ağırlıkları baş üstüne it."],
  ["Barbell Overhead Press", "Barbell Overhead Press", "Omuz", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Barı omuz hizasından başlat, gövdeyi sıkı tutarak baş üstüne dik it."],
  ["Landmine Shoulder Press", "Landmine Shoulder Press", "Omuz", "purple", ["barbell", "bar", "landmine", "salon"], false, ["güç", "kas"], "Barın ucunu tek kolla çapraz yukarı it, belini bükmeden kontrollü geri getir."],
  ["Makine Omuz Press", "Machine Shoulder Press", "Omuz", "purple", ["makine", "salon"], false, ["güç", "kas"], "Sırtını pedde sabitle, tutacakları yukarı it ve dirsekleri kilitlemeden indir."],
  ["Yana Dambıl Açış", "Dumbbell Lateral Raise", "Omuz", "purple", ["dambıl"], false, ["kas", "güç"], "Dambılları omuz yüksekliğine kadar yana aç, bilekleri nötr tutarak indir."],
  ["Kablo Yana Açış", "Cable Lateral Raise", "Omuz", "purple", ["kablo", "makine", "salon"], false, ["kas", "güç"], "Kabloyu tek kolla yana aç, omuz hizasında kısa duraklayıp kontrollü indir."],
  ["Ön Dambıl Raise", "Dumbbell Front Raise", "Omuz", "purple", ["dambıl"], false, ["kas", "güç"], "Dambılı omuz hizasına kadar öne kaldır, gövdeyi sallamadan yavaşça indir."],
  ["Plaka Front Raise", "Plate Front Raise", "Omuz", "purple", ["plaka", "plate"], false, ["kas", "güç"], "Plakayı iki elle göğüs önünde tut, omuz hizasına kaldırıp kontrollü indir."],
  ["Rear Delt Fly", "Rear Delt Fly", "Omuz", "purple", ["dambıl", "makine", "salon"], false, ["kas"], "Kolları yana ve geriye aç, sırtını sabit tutarak omuz arkasını sık."],
  ["Upright Row", "Upright Row", "Omuz", "purple", ["barbell", "dambıl", "kablo"], false, ["güç", "kas"], "Ağırlığı gövdeye yakın yukarı çek, dirsekleri omuz hizasından fazla yükseltme."],
  ["Cuban Rotation", "Cuban Rotation", "Omuz", "purple", ["dambıl", "band", "lastik"], false, ["güç"], "Dirsekleri 90 derece sabit tut, ön kolları dışa döndürüp kontrollü geri getir."],
  ["Scaption", "Scaption", "Omuz", "purple", ["dambıl", "band", "lastik"], false, ["güç"], "Kolları başparmaklar yukarı bakacak şekilde hafif öne ve yana kaldır."],
  ["Pike Şınav", "Pike Push-up", "Omuz", "purple", [], true, ["güç", "kas"], "Kalçanı yukarı kaldır, başını ellerin arasına indirip omuzlarınla geri it."],
  ["Duvar Amudu Bekleme", "Handstand Hold", "Omuz", "purple", ["duvar"], false, ["güç", "kondisyon"], "Duvara kontrollü çık, karnını sık ve omuzlarını aktif tutarak kısa süre bekle."],
  ["Barbell Curl", "Barbell Curl", "Kol", "blue", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Dirsekleri gövdeye sabitle, barı omuzlara doğru kıvırıp yavaşça indir."],
  ["Dambıl Curl", "Dumbbell Curl", "Kol", "blue", ["dambıl"], false, ["güç", "kas"], "Dirsekleri sabit tut, dambılları sırayla omuzlara yaklaştır ve kontrollü bırak."],
  ["Hammer Curl", "Hammer Curl", "Kol", "blue", ["dambıl"], false, ["güç", "kas"], "Avuç içlerini birbirine bakacak şekilde tut, dirsekleri oynatmadan kaldır."],
  ["Eğimli Dambıl Curl", "Incline Dumbbell Curl", "Kol", "blue", ["dambıl", "bench", "sehpa"], false, ["kas"], "Eğimli sehpada kolları aşağı sarkıt, bicepsleri gererek dambılları kıvır."],
  ["Concentration Curl", "Concentration Curl", "Kol", "blue", ["dambıl"], false, ["kas"], "Dirseği iç bacağa destekle, dambılı omuza doğru kıvırıp yavaşça aç."],
  ["Kablo Curl", "Cable Curl", "Kol", "blue", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Kabloyu tut, dirsekleri gövdede sabit tutarak elleri omuzlara çek."],
  ["Preacher Curl", "Preacher Curl", "Kol", "blue", ["makine", "bench", "sehpa", "salon"], false, ["kas"], "Kolları pedde sabitle, dirsekleri kilitlemeden ağırlığı yukarı ve aşağı taşı."],
  ["Ters Tutuş Curl", "Reverse Curl", "Kol", "blue", ["barbell", "bar", "dambıl"], false, ["güç", "kas"], "Avuç içlerini yere çevir, bilekleri sabit tutarak ağırlığı kıvır."],
  ["Triceps Pushdown", "Triceps Pushdown", "Kol", "blue", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Dirsekleri gövdeye sabitle, ön kolları aşağı uzatıp kontrollü yukarı getir."],
  ["İp Triceps Pushdown", "Rope Triceps Pushdown", "Kol", "blue", ["kablo", "makine", "salon"], false, ["güç", "kas"], "İpi aşağı iterken uçları dışa aç, dirsekleri sabit tut."],
  ["Baş Üstü Triceps Extension", "Overhead Triceps Extension", "Kol", "blue", ["dambıl", "kablo"], false, ["güç", "kas"], "Ağırlığı baş üstünde tut, dirsekleri yakın koruyarak arkaya indirip uzat."],
  ["Dambıl Skull Crusher", "Dumbbell Skull Crusher", "Kol", "blue", ["dambıl", "bench", "sehpa"], false, ["kas"], "Dambılları alnın iki yanına kontrollü indir, dirsekleri sabit tutarak uzat."],
  ["Dar Şınav", "Close Grip Push-up", "Kol", "blue", [], true, ["güç", "kas"], "Ellerini omuz genişliğinde tut, dirsekleri gövdeye yakın indirip yukarı it."],
  ["Bench Dip", "Bench Dip", "Kol", "blue", ["bench", "sehpa"], false, ["güç", "kas"], "Ellerini sehpaya koy, kalçayı öne al ve dirsekleri büküp kontrollü yüksel."],
  ["Triceps Kickback", "Triceps Kickback", "Kol", "blue", ["dambıl"], false, ["kas"], "Gövdeyi öne eğ, üst kolları sabit tut ve ön kolları geriye uzat."],
  ["JM Press", "JM Press", "Kol", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı çene hizasına kontrollü indir, dirsekleri sabit tutarak yukarı it."],
  ["Barbell Back Squat", "Barbell Back Squat", "Bacak", "orange", ["barbell", "bar", "rack", "salon"], false, ["güç", "kas"], "Barı sırtında sabitle, kalçayı geriye indir ve topuklardan güç alarak kalk."],
  ["Front Squat", "Front Squat", "Bacak", "orange", ["barbell", "bar", "rack", "salon"], false, ["güç", "kas"], "Barı omuz önünde tut, gövdeyi dik koruyarak çömelip ayağa kalk."],
  ["Split Squat", "Split Squat", "Bacak", "orange", [], true, ["güç", "kas", "kilo"], "Bir ayağı öne al, arka dizini yere yaklaştır ve öndeki topuktan yüksel."],
  ["Sumo Squat", "Sumo Squat", "Bacak", "orange", ["dambıl", "kettlebell"], false, ["güç", "kas", "kilo"], "Ayakları geniş ve dışa dönük aç, dizleri ayak yönünde takip ettirerek çömel."],
  ["Vücut Ağırlığı Squat", "Bodyweight Squat", "Bacak", "orange", [], true, ["güç", "kilo", "kondisyon"], "Ayakları omuz genişliğinde aç, kalçayı geriye indir ve topuklardan yüksel."],
  ["Jump Squat", "Jump Squat", "Bacak", "orange", [], true, ["kilo", "kondisyon"], "Çömelmeden güçlü sıçra, dizleri yumuşak karşıla ve ritmi kontrollü koru."],
  ["Wall Sit", "Wall Sit", "Bacak", "orange", ["duvar"], false, ["güç", "kilo", "kondisyon"], "Sırtını duvara yasla, dizleri yaklaşık 90 derecede tut ve nefesi düzenli al."],
  ["Romanian Deadlift", "Romanian Deadlift", "Bacak", "orange", ["dambıl", "barbell", "bar"], false, ["güç", "kas"], "Dizleri hafif bük, kalçayı geriye gönder ve sırtı nötr tutarak ağırlığı indir."],
  ["Stiff Leg Deadlift", "Stiff Leg Deadlift", "Bacak", "orange", ["dambıl", "barbell", "bar"], false, ["güç", "kas"], "Bacakları uzun tut, kalçadan katlan ve hamstring gerilince ağırlığı geri kaldır."],
  ["Conventional Deadlift", "Conventional Deadlift", "Bacak", "orange", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Barı bacaklara yakın tut, sırtı nötr koru ve yerden kalçayla birlikte yüksel."],
  ["Sumo Deadlift", "Sumo Deadlift", "Bacak", "orange", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Geniş duruş al, dizleri ayak yönünde aç ve barı yere yakın çek."],
  ["Good Morning", "Good Morning", "Bacak", "orange", ["barbell", "bar", "salon"], false, ["güç"], "Barı sırtında tut, kalçadan öne eğil ve sırtı düz koruyarak yüksel."],
  ["Hip Thrust", "Hip Thrust", "Kalça", "orange", ["bench", "sehpa", "dambıl"], false, ["güç", "kas", "kilo"], "Sırtını sehpaya yasla, topuklardan iterek kalçayı kaldır ve tepede sık."],
  ["Barbell Hip Thrust", "Barbell Hip Thrust", "Kalça", "orange", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı kalça üzerinde sabitle, pelvisini nötr tutarak kalçayı yukarı sür."],
  ["Tek Bacak Glute Bridge", "Single Leg Glute Bridge", "Kalça", "orange", [], true, ["güç", "kilo"], "Bir bacağı uzat, diğer topuktan iterek kalçayı kaldır ve kontrollü indir."],
  ["Frog Pump", "Frog Pump", "Kalça", "orange", [], true, ["güç", "kilo"], "Ayak tabanlarını birleştir, dizleri yana aç ve kalçayı kısa kontrollü tekrarlarla kaldır."],
  ["Fire Hydrant", "Fire Hydrant", "Kalça", "orange", [], true, ["güç", "kilo"], "Dört ayak pozisyonunda dizini yana kaldır, kalçayı döndürmeden geri indir."],
  ["Donkey Kick", "Donkey Kick", "Kalça", "orange", [], true, ["güç", "kilo"], "Dört ayak pozisyonunda topuğu tavana it, belini çökertmeden bacağı indir."],
  ["Kablo Glute Kickback", "Cable Glute Kickback", "Kalça", "orange", ["kablo", "makine", "salon"], false, ["güç", "kas", "kilo"], "Bacağı geriye uzat, leğen kemiğini sabit tut ve kabloyu kontrollü bırak."],
  ["Leg Extension", "Leg Extension", "Bacak", "orange", ["leg extension", "makine", "salon"], false, ["güç", "kas"], "Sırtını pedde tut, dizleri kontrollü uzat ve ağırlığı yavaşça indir."],
  ["Oturarak Leg Curl", "Seated Leg Curl", "Bacak", "orange", ["leg curl", "makine", "salon"], false, ["güç", "kas"], "Kalçayı pedde sabitle, topukları geriye çek ve kontrollü başlangıca dön."],
  ["Yatarak Leg Curl", "Lying Leg Curl", "Bacak", "orange", ["leg curl", "makine", "salon"], false, ["güç", "kas"], "Karnını pedde sabitle, topukları kalçaya çekip yavaşça uzat."],
  ["Nordic Curl", "Nordic Curl", "Bacak", "orange", ["bench", "sehpa", "salon"], false, ["güç", "kas"], "Ayakları sabitle, gövdeyi hamstringlerle yavaşça öne indir ve ellerle destek al."],
  ["Ayakta Baldır Raise", "Standing Calf Raise", "Bacak", "orange", ["dambıl", "makine", "salon"], false, ["güç", "kilo"], "Ayak ucuna yüksel, tepede baldırı sık ve topukları kontrollü indir."],
  ["Oturarak Baldır Raise", "Seated Calf Raise", "Bacak", "orange", ["makine", "salon"], false, ["güç", "kas"], "Dizler üzerindeki ağırlığı kullan, topukları kaldırıp yavaşça aşağı bırak."],
  ["Tibialis Raise", "Tibialis Raise", "Bacak", "orange", ["duvar"], false, ["güç", "kondisyon"], "Topukları yerde bırak, ayak uçlarını yukarı çekip kontrollü indir."],
  ["Cossack Squat", "Cossack Squat", "Bacak", "orange", [], true, ["güç", "esneklik", "kilo"], "Bir yana çömelirken diğer bacağı uzat, göğsü açık tut ve ortaya dön."],
  ["Curtsy Lunge", "Curtsy Lunge", "Bacak", "orange", [], true, ["güç", "kilo"], "Bir ayağı çapraz geriye al, kalçayı indir ve öndeki topuktan yüksel."],
  ["Walking Lunge", "Walking Lunge", "Bacak", "orange", [], true, ["güç", "kilo", "kondisyon"], "Öne adım at, iki dizi bük ve arkadaki ayağı öne getirerek ilerle."],
  ["Lateral Lunge", "Lateral Lunge", "Bacak", "orange", [], true, ["güç", "esneklik", "kilo"], "Yana geniş adım at, kalçayı geriye indir ve itiş yapan bacakla dön."],
  ["Box Jump", "Box Jump", "Bacak", "orange", ["kutu", "bench", "sehpa"], false, ["kilo", "kondisyon"], "Kollarla destek alarak sağlam kutuya sıçra, dizleri yumuşak karşıla ve in."],
  ["Crunch", "Crunch", "Core", "blue", [], true, ["güç", "kilo"], "Belini zemine yaklaştır, omuzları hafif kaldır ve boynu çekmeden geri in."],
  ["Reverse Crunch", "Reverse Crunch", "Core", "blue", [], true, ["güç", "kilo"], "Dizleri göğse çek, kalçayı hafif kaldır ve belini yere kontrollü bırak."],
  ["Bicycle Crunch", "Bicycle Crunch", "Core", "blue", [], true, ["güç", "kilo", "kondisyon"], "Karşı dirseği karşı dize yaklaştır, beli yere yakın tutarak taraf değiştir."],
  ["Russian Twist", "Russian Twist", "Core", "blue", ["dambıl", "kettlebell"], false, ["güç", "kilo"], "Gövdeyi hafif geriye al, ağırlığı sağa sola döndürürken kalçayı sabit tut."],
  ["Side Plank", "Side Plank", "Core", "blue", [], true, ["güç", "kilo"], "Dirseği omuz altına koy, kalçayı kaldır ve vücudu düz çizgide tut."],
  ["Hollow Body Hold", "Hollow Body Hold", "Core", "blue", [], true, ["güç", "kilo"], "Belini zemine bastır, omuz ve bacakları hafif kaldırarak pozisyonu koru."],
  ["V-Up", "V-Up", "Core", "blue", [], true, ["güç", "kilo"], "Kolları ve bacakları aynı anda merkeze getir, kontrollü uzayarak geri dön."],
  ["Leg Raise", "Leg Raise", "Core", "blue", [], true, ["güç", "kilo"], "Bacakları düz kaldır, belin yerden ayrılmadan yavaşça aşağı indir."],
  ["Hanging Knee Raise", "Hanging Knee Raise", "Core", "blue", ["barfiks", "bar", "salon"], false, ["güç", "kilo"], "Barfiks barında asılı kal, dizleri göğse çekip salınım yapmadan indir."],
  ["Hanging Leg Raise", "Hanging Leg Raise", "Core", "blue", ["barfiks", "bar", "salon"], false, ["güç", "kilo"], "Asılı pozisyonda düz bacakları kaldır, kalçayı kontrollü kullan ve indir."],
  ["Pallof Press", "Pallof Press", "Core", "blue", ["kablo", "band", "lastik", "salon"], false, ["güç"], "Kabloyu göğüs önünde tut, kolları uzatırken gövdenin dönmesine diren."],
  ["Kablo Woodchop", "Cable Woodchop", "Core", "blue", ["kablo", "makine", "salon"], false, ["güç", "kilo"], "Kabloyu çapraz aşağı çek, kalça ve gövdeyi birlikte döndürerek kontrollü dön."],
  ["Ab Wheel Rollout", "Ab Wheel Rollout", "Core", "blue", ["ab wheel", "tekerlek"], false, ["güç"], "Dizlerden başla, gövdeyi düz uzat ve belini çökertmeden geri çek."],
  ["Bear Crawl", "Bear Crawl", "Core", "blue", [], true, ["kilo", "kondisyon"], "Dizleri yerden hafif kaldır, karşı el ve ayağı sırayla ilerlet."],
  ["Burpee", "Burpee", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Çömel, elleri yere koy, ayakları geriye al ve kontrollü kalkıp sıçra."],
  ["Jumping Jack", "Jumping Jack", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Kolları ve bacakları ritmik açıp kapat, inişlerde dizleri yumuşak tut."],
  ["High Knees", "High Knees", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Dizleri kalça hizasına doğru sırayla kaldır, gövdeyi dik ve ritmi kontrollü koru."],
  ["Butt Kicks", "Butt Kicks", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Topukları sırayla kalçaya yaklaştır, gövdeyi dik tut ve yumuşak bas."],
  ["Skater", "Skater", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Yana sıçrayıp karşı ayağın arkasına uzan, dengeyi koruyarak taraf değiştir."],
  ["Squat Thrust", "Squat Thrust", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Çömelip elleri yere koy, ayakları geriye alıp tekrar öne çek ve kalk."],
  ["Inchworm", "Inchworm", "Kondisyon", "orange", [], true, ["kilo", "kondisyon", "esneklik"], "Ayakta öne katlan, ellerle plank pozisyonuna yürü ve kontrollü geri dön."],
  ["Bear Plank", "Bear Plank", "Core", "blue", [], true, ["güç", "kondisyon"], "Dizleri yerden kaldır, omuz ve kalçayı sabit tutarak kısa süre bekle."],
  ["Hollow Rock", "Hollow Rock", "Core", "blue", [], true, ["güç"], "Hollow pozisyonunu koru, gövdeyi küçük salınımlarla kontrol ederek hareket ettir."],
  ["Dead Hang", "Dead Hang", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "esneklik"], "Barı kavra, omuzları aktif tut ve vücudu kontrollü şekilde asılı koru."],
  ["Cat Cow", "Cat Cow", "Esneklik", "orange", [], true, ["esneklik"], "Dört ayak pozisyonunda sırayla omurgayı yuvarla ve göğsü öne aç."],
  ["Child's Pose", "Child's Pose", "Esneklik", "orange", [], true, ["esneklik"], "Kalçayı topuklara gönder, kolları öne uzat ve nefesle gevşe."],
  ["Downward Dog", "Downward Dog", "Esneklik", "orange", [], true, ["esneklik"], "Kalçayı yukarı kaldır, omurgayı uzat ve topukları zemine doğru rahat bırak."],
  ["World's Greatest Stretch", "World's Greatest Stretch", "Esneklik", "orange", [], true, ["esneklik", "kondisyon"], "Öne hamle pozisyonunda bir dirseği yere yaklaştır, göğsü döndür ve taraf değiştir."],
  ["Kalça Fleksör Esnetme", "Hip Flexor Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Bir diz yerdeyken kalçayı hafif öne taşı, beli çökertmeden ön kalçayı esnet."],
  ["Hamstring Esnetme", "Hamstring Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Bacağı uzat, kalçadan öne eğil ve sırtı yuvarlamadan rahat nefes al."],
  ["90/90 Hip Switch", "90/90 Hip Switch", "Esneklik", "orange", [], true, ["esneklik"], "Dizleri iki yana 90 derece yerleştir, kalçadan kontrollü bir tarafa dön."],
  ["Thoracic Rotation", "Thoracic Rotation", "Esneklik", "orange", [], true, ["esneklik"], "Yan yatışta üst kolu açarak göğsü tavana döndür, kalçayı sabit tut."],
  ["Omuz Dislocate", "Shoulder Dislocate", "Esneklik", "orange", ["band", "lastik", "çubuk"], false, ["esneklik"], "Bandı geniş kavra, kolları baş üstünden arkaya ve öne yavaşça taşı."],
  ["Ankle Rocker", "Ankle Rocker", "Esneklik", "orange", [], true, ["esneklik"], "Ön ayağın topuğu yerdeyken dizi ayak parmaklarına doğru kontrollü taşı."],
  ["Glute Stretch", "Glute Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Bir bacağı diğerinin üzerinden geçir, gövdeyi hafif öne al ve kalçayı gevşet."],
  ["Pigeon Stretch", "Pigeon Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Ön bacağı bük, arka bacağı uzat ve kalçayı kontrollü şekilde yere yaklaştır."],
  ["Cobra Stretch", "Cobra Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Yüzüstü yat, ellerle göğsü hafif kaldır ve omuzları kulaklardan uzak tut."],
  ["Wrist Stretch", "Wrist Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Avuç ve parmakları nazikçe ger, bilekte keskin ağrı olmadan nefes al."],
  ["Kettlebell Swing", "Kettlebell Swing", "Kalça", "orange", ["kettlebell"], false, ["güç", "kilo", "kondisyon"], "Kalçanı geriye göndererek ağırlığı bacaklarının arasına salla, kalçanı öne patlatarak kettlebell'i göğüs hizasına çıkar; kollarını kaldırma, güç kalçadan gelsin."],
  ["Hip Abduction", "Hip Abduction", "Kalça", "orange", ["makine", "salon", "band", "lastik"], false, ["güç", "kas"], "Oturur pozisyonda dizlerini dışa doğru kontrollü aç, en açık noktada bir saniye sık ve direnci karşılayarak yavaşça kapat."],
  ["Kablo Pull Through", "Cable Pull Through", "Kalça", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Kabloyu bacaklarının arasından kavra, kalçanı geriye göndererek öne katlan ve kalçanı öne sıkarak doğrul."],
  ["Hip Thrust Tek Bacak", "Single-leg Hip Thrust", "Kalça", "orange", ["bench", "sehpa"], false, ["güç", "kas"], "Sırtını sehpaya yasla, bir bacağını havada tut ve destek topuğundan iterek kalçanı kaldır; tepede kalçanı sık."],
  ["Kettlebell Goblet Squat Press", "Kettlebell Thruster", "Kondisyon", "blue", ["kettlebell", "dambıl"], false, ["kondisyon", "kilo", "güç"], "Çömelişten kalkarken ivmeyi kullanarak ağırlığı baş üstüne it, indirirken kontrolü bırakma ve nefesini tutma."],
  ["Sled Push", "Sled Push", "Kondisyon", "orange", ["sled", "salon"], false, ["kondisyon", "güç"], "Kollarını gergin, gövdeni öne eğik tut ve kısa güçlü adımlarla it; sırtını yuvarlama."],
  ["Boyun Yan Esnetme", "Neck Side Stretch", "Esneklik", "blue", [], true, ["esneklik"], "Başını yana yatır, karşı omzunu aşağıda tut ve nefes vererek 20–30 saniye bekle; zorlayıp çekiştirme."],
  ["Göğüs Kapı Esnetme", "Doorway Chest Stretch", "Esneklik", "blue", [], true, ["esneklik"], "Kolunu kapı çerçevesine dirsekten bükülü yasla, gövdeni yavaşça öne çevir ve göğsünde hafif gerilme hissettiğinde dur."],
  ["Quad Esnetme", "Standing Quad Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Ayak bileğini elinle kalçana doğru çek, dizlerini yan yana tut ve kalçanı hafif öne al; dengeni bir noktaya bakarak koru."],
  ["Kedi Deve Oturarak", "Seated Spinal Twist", "Esneklik", "purple", [], true, ["esneklik"], "Otururken bir bacağını karşıya çaprazla, gövdeni o yöne yavaşça çevir ve nefes vererek derinleştir."],
  ["Baldır Duvar Esnetme", "Wall Calf Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Ellerini duvara koy, bir ayağını geriye uzat ve topuğunu yerde tutarak öne yaslan."],
  ["Kol Çapraz Esnetme", "Cross-body Shoulder Stretch", "Esneklik", "blue", [], true, ["esneklik"], "Kolunu göğsünün önünden karşıya uzat, diğer kolunla dirsekten destekle ve omzunu yukarı kaldırmadan bekle."],
  ["Triceps Esnetme", "Overhead Triceps Stretch", "Esneklik", "purple", [], true, ["esneklik"], "Kolunu baş üstünden arkaya bük, diğer elinle dirseğini nazikçe geriye it ve kaburgalarını dışarı çıkarma."],
  ["Diz Göğse Çekme", "Knee to Chest Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Sırt üstü yat, bir dizini iki elinle göğsüne çek ve diğer bacağını uzun bırak; belini zemine yaklaştır."],
  ["Dambıl Çekiç Curl", "Dumbbell Hammer Curl", "Kol", "purple", ["dambıl"], false, ["güç", "kas"], "Avuç içlerin birbirine baksın, dirseklerini gövdene sabitle ve ağırlıkları sallanmadan yukarı çek."],
  ["Konsantrasyon Curl", "Concentration Curl", "Kol", "purple", ["dambıl"], false, ["kas"], "Otururken dirseğini iç uyluğuna daya, ağırlığı yalnız ön kolunu bükerek kaldır ve yavaşça indir."],
  ["Kablo Triceps Push-down", "Cable Triceps Pushdown", "Kol", "blue", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Dirseklerini gövdene sabitle, yalnız ön kolunu aşağı doğru uzat ve üst noktaya kontrollü dön."],
  ["Overhead Triceps Extension", "Overhead Dumbbell Triceps Extension", "Kol", "purple", ["dambıl"], false, ["kas"], "Ağırlığı baş üstünde tut, dirseklerini içeride sabitleyerek arkaya indir ve kaburgalarını açmadan yukarı uzat."],
  ["Ters Curl", "Reverse Curl", "Kol", "blue", ["dambıl", "barbell", "bar"], false, ["kas"], "Avuç içlerin aşağı baksın, bileklerini düz tutarak ağırlığı kaldır ve kontrollü indir."],
  ["Bench Dips", "Bench Dips", "Kol", "purple", ["bench", "sehpa"], false, ["güç", "kas"], "Ellerini sehpanın kenarına koy, dirseklerini geriye bükerek kalçanı indir ve omuzlarını kulaklarından uzak tut."],
  ["Bilek Curl", "Wrist Curl", "Kol", "purple", ["dambıl"], false, ["kas"], "Ön kolunu bacağına daya, yalnız bileğini yukarı kıvır ve tam açıklıkta kontrollü indir."],
  ["Yan Plank", "Side Plank", "Core", "blue", [], true, ["güç", "kilo"], "Dirseğini omzunun altına yerleştir, kalçanı yukarıda ve gövdeni tek çizgide tut; boynunu bükme."],
  ["Bacak Kaldırma", "Lying Leg Raise", "Core", "orange", [], true, ["güç", "kas"], "Sırt üstü yat, ellerini kalçanın altına al ve bacaklarını düz tutarak indir kaldır; belin yerden kalkmasın."],
  ["Barbell Glute Bridge", "Barbell Glute Bridge", "Kalça", "orange", ["barbell","bar","salon"], false, ["güç","kas"], "Barı kalçanın üzerine yerleştir, sırtını yerde tut ve topuklardan iterek kalçanı kaldır; tepede kalçanı sık, beli aşırı kavislendirme."],
  ["Band Kalça Kaldırma", "Hip Lift with Band", "Kalça", "blue", ["band","lastik"], false, ["güç","kilo"], "Bandı kalçanın üzerinden geçir, dizlerini bük ve direnci karşılayarak kalçanı yukarı kaldır; inişte kontrolü bırakma."],
  ["Physioball Kalça Köprüsü", "Physioball Hip Bridge", "Kalça", "orange", ["top","pilates topu"], false, ["güç","kilo"], "Ayaklarını topun üzerine koy, kalçanı kaldırıp omuz-diz hattını kur; top kaymasın diye karnını sıkı tut."],
  ["Diz Üstü Squat", "Kneeling Squat", "Kalça", "purple", ["barbell","bar","salon"], false, ["güç","kas"], "Dizlerinin üzerinde dik dur, kalçanı topuklarına doğru geriye götür ve kalçanı öne sıkarak doğrul."],
  ["Flutter Kicks", "Flutter Kicks", "Kondisyon", "blue", [], true, ["kilo","kondisyon"], "Sırt üstü yat, belini zemine yaklaştır ve bacaklarını küçük hızlı hareketlerle almaşık indirip kaldır; belin yerden kalkmasın."],
  ["Diz Üstü Sıçrama", "Kneeling Jump Squat", "Kondisyon", "orange", [], true, ["kondisyon","güç"], "Dizlerinin üzerinden kalçanı öne patlatarak ayağa sıçra, inişte dizlerini yumuşat ve dengeni topuklarından karşıla."],
];

function buildExerciseInstruction(name: string, cue: string) {
  return `${cue} ${name} hareketinde ağrı hissedersen dur ve hareket açıklığını azalt.`;
}

const additionalExerciseLibrary = additionalExerciseDefinitions.map(([name, english, area, tone, requires, bodyweight, goals, cue], index) => ({
  name,
  english,
  area,
  tone,
  icon: index % 3 === 0 ? "✦" : index % 3 === 1 ? "↗" : "◒",
  requires,
  bodyweight,
  goals,
  instructions: buildExerciseInstruction(name, cue),
}));

const exerciseLibrary = [...coreExerciseLibrary, ...additionalExerciseLibrary];


function createPersonalPlan(gym: string, equipmentText: string, history: string[], goalText: string, requestedExercises = "", completedSessions = 0) {
  const profileText = `${equipmentText} ${goalText} ${requestedExercises} ${history.join(" ")}`.toLowerCase();
  const goal = profileText.includes("kilo") || profileText.includes("yağ") ? "kilo" : profileText.includes("kas") ? "kas" : profileText.includes("kondisyon") ? "kondisyon" : "güç";
  // Çoklu seçimde "Yeni başlıyorum · Orta seviye" gelebilir; en güvenli
  // varsayım, başlangıç seviyesi işaretliyse acemi kabul etmektir.
  const isBeginner = !history[QUESTION.level] || history[QUESTION.level].includes("Yeni başlıyorum");
  const wantsGym = gym === "Salon";
  const durationText = history[QUESTION.sessionMinutes] || goalText.match(/(15|30|45|60)/)?.[1] || "30";
  const duration = extractSessionMinutes(durationText);
  const weeklyDays = extractWeeklyDays(history[QUESTION.availableDays] || history[QUESTION.recentFrequency]);
  const pain = history[QUESTION.injuries]?.toLowerCase() || "";
  const matchesEquipment = (item: typeof exerciseLibrary[number]) => canPerformExercise(item, { isGym: wantsGym, equipmentText });
  const avoidKneeLoad = pain.includes("diz");
  const avoidShoulderLoad = pain.includes("omuz");
  const safeForPain = (item: typeof exerciseLibrary[number]) => !(avoidKneeLoad && ["Reverse Lunge", "Bulgarian Split Squat", "Step-up", "Mountain Climber", "Leg Press"].includes(item.name)) && !(avoidShoulderLoad && ["Şınav", "Eğimli Şınav", "Dambıl Omuz Press", "Lat Pulldown"].includes(item.name));
  const seed = [...profileText].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 997, 7);
  const goalItems = exerciseLibrary.filter((item) => matchesEquipment(item) && safeForPain(item) && item.goals.includes(goal));
  const fallback = exerciseLibrary.filter((item) => matchesEquipment(item) && safeForPain(item));
  const requestedItems = findRequestedLibraryExercises(requestedExercises, goalText, gym, equipmentText, history);
  // Evde antrenman yapan ve ekipman belirten kullanıcı için, sahip olduğu ekipmanı kullanan
  // hareketleri güvenli oldukları sürece plana öncelikli olarak dahil et.
  const ownsHomeEquipment = !wantsGym && usableEquipmentText(equipmentText).length > 0;
  const equipmentItems = ownsHomeEquipment ? exerciseLibrary.filter((item) => !item.bodyweight && safeForPain(item) && item.requires.some((requirement) => hasEquipment(equipmentText, requirement))) : [];
  // Hareket seçimi PROFİLE göre sabittir. Bir dönem gün numarası skora
  // karıştırılıp plan her gün döndürülüyordu; bu, aynı hareketteki ilerlemeyi
  // izlemeyi imkânsız kıldığı için programı "stabil değil" hissettiriyordu.
  // Zamanla değişmesi gereken hareketler değil, yüktür — onu da
  // planProgressionBlock(completedSessions) yönetir.
  const score = (name: string) => [...name].reduce((total, character) => total + character.charCodeAt(0), seed) % 997;
  // Hazır programlardaki hareketler en sona itilir; aksi halde kişisel plan ile
  // "hemen başla" şablonları neredeyse aynı listeyi gösteriyordu.
  const priority = (item: typeof exerciseLibrary[number]) => requestedItems.includes(item) ? 0 : equipmentItems.includes(item) ? 1 : READY_PROGRAM_NAMES.has(item.name) ? 3 : 2;
  // Hareket sayısı süreye göre belirlenir, haftalık sıklıkla dengelenir: haftada
  // 5+ gün çalışan biri seans başına daha az hareketle toplam hacmi yayar, haftada
  // 1-2 gün çalışan biri ise daha dolu seanslara ihtiyaç duyar.
  const baseCount = duration <= 15 ? 3 : duration >= 60 ? 6 : 5;
  const frequencyAdjustment = weeklyDays >= 5 ? -1 : weeklyDays <= 2 ? 1 : 0;
  const exerciseCount = Math.min(7, Math.max(3, baseCount + frequencyAdjustment));
  const chosen = [...requestedItems, ...equipmentItems, ...goalItems, ...fallback].filter((item, index, list) => list.findIndex((candidate) => candidate.name === item.name) === index).sort((a, b) => priority(a) - priority(b) || score(a.name) - score(b.name)).slice(0, exerciseCount);
  const block = planProgressionBlock(completedSessions);
  const baseSets = isBeginner ? (duration <= 15 ? 2 : 3) : duration >= 60 ? 4 : 3;
  const baseReps = goal === "kondisyon" || goal === "kilo" ? (isBeginner ? 10 : 14) : isBeginner ? 10 : 8;
  const baseRest = goal === "kondisyon" ? 45 : isBeginner ? 60 : 90;
  const sets = Math.min(5, baseSets + (block >= 2 ? 1 : 0));
  const reps = baseReps + (block >= 1 ? 2 : 0) + (block >= 3 ? 2 : 0);
  const rest = Math.max(30, baseRest - (block >= 3 ? 15 : 0));
  const holdSeconds = 30 + block * 5;
  return chosen.map((item) => { const isHold = item.name === "Plank" || item.name === "Dead Bug"; return { ...item, level: item.area, sets: `${sets} set · ${isHold ? `${holdSeconds} sn` : `${reps} tekrar`}`, rest: `${rest} sn dinlenme`, seconds: isHold ? holdSeconds : 45 }; });
}

type AiWorkout = { id?: string; name: string; english: string; area: string; sets: string; rest: string; seconds: number; tone: string; icon: string; level: string; instructions: string; images?: string[]; equipment?: string | null; secondaryMuscles?: string[]; category?: string; bodyweight?: boolean };
type MotionPattern = "floor-press" | "pushup" | "press" | "overhead" | "row" | "pulldown" | "squat" | "lunge" | "hinge" | "bridge" | "plank" | "core" | "cardio" | "mobility" | "curl" | "triceps" | "raise" | "fly" | "calf" | "leg-machine";
type WorkoutPhase = "work" | "rest" | "done";
type WorkoutSessionRecord = { id: string; completedAt: string; durationSeconds: number; calories: number; completedExercises: number; totalExercises: number; exerciseNames: string[]; difficulty?: WorkoutDifficulty; fatigue?: number; painAreas?: string[]; feedbackNote?: string };
type AiPlanAnalysis = { experienceLevel: string; weeklyFrequency: string; sessionMinutes: number; primaryGoal: string; intensity: string; equipmentMode: string; focusAreas: string[]; adaptations: string[] };
type AiScheduleDay = { day: string; focus: string; durationMinutes: number };
type EnergyMetrics = { bmr: number; tdee: number; activityLabel: string; activityFactor: number };
type AiStage = "profile" | "history" | "planning" | "complete";

const motionGuides: Record<MotionPattern, { action: string; focus: string; start: string; move: string; finish: string; breathe: string; mistake: string }> = {
  "floor-press": { action: "YUKARI İT", focus: "Göğüs · triceps", start: "Sırt üstü yat, dizleri bük ve dambılları dirseklerin üzerinde tut.", move: "Dambılları göğsünün üzerinde birbirine yaklaştırarak yukarı it.", finish: "Dirsekleri yere çarpmadan kontrollü indir.", breathe: "İterken nefes ver, indirirken nefes al.", mistake: "Omuzları kulaklara çekme; bilekleri geriye kırma." },
  pushup: { action: "GÖVDENİ İT", focus: "Göğüs · omuz · core", start: "Eller omuzlardan biraz açık, baştan topuğa düz çizgi kur.", move: "Dirsekleri yaklaşık 45 dereceyle büküp göğsü kontrollü indir.", finish: "Zemini iterek gövdeyi tek parça halinde yükselt.", breathe: "İnerken nefes al, yükselirken ver.", mistake: "Belini çökertme ve başını öne uzatma." },
  press: { action: "İLERİ İT", focus: "Göğüs · ön omuz · triceps", start: "Kürek kemiklerini sabitle, ağırlığı göğüs hizasında tut.", move: "Dirsekleri kontrollü bük, ardından ağırlığı düz hatta it.", finish: "Kolları kilitlemeden başlangıca dön.", breathe: "İterken nefes ver, dönüşte al.", mistake: "Dirsekleri omuz hizasında tamamen yana açma." },
  overhead: { action: "BAŞ ÜSTÜNE İT", focus: "Omuz · triceps · core", start: "Ağırlıkları omuz hizasında, kaburgaları aşağıda tut.", move: "Ağırlıkları başının iki yanından yukarı taşı.", finish: "Belini kamburlaştırmadan kontrollü indir.", breathe: "Yukarı iterken nefes ver.", mistake: "Bel boşluğunu artırma ve ağırlıkları öne kaçırma." },
  row: { action: "DİRSEĞİ GERİ ÇEK", focus: "Sırt · arka omuz · biceps", start: "Kalçadan hafif eğil, sırtı düz ve omuzları aşağıda tut.", move: "Dirseği kalçaya doğru çekip kürek kemiğini sık.", finish: "Gövdeyi döndürmeden kolu yavaşça uzat.", breathe: "Çekerken nefes ver, uzatırken al.", mistake: "Omzu kulağa çekme ve ağırlığı savurma." },
  pulldown: { action: "AŞAĞI ÇEK", focus: "Kanat · sırt · biceps", start: "Göğsü açık tut, barı omuzlardan biraz geniş kavra.", move: "Dirsekleri aşağı ve geriye sürerek barı üst göğse çek.", finish: "Omuzları yükseltmeden kolları kontrollü uzat.", breathe: "Barı çekerken nefes ver.", mistake: "Barı enseye çekme ve gövdeyi geriye savurma." },
  squat: { action: "KALÇAYI İNDİR", focus: "Ön bacak · kalça · core", start: "Ayakları sağlam bas, dizleri ayak uçlarıyla aynı yöne çevir.", move: "Kalçayı geriye-aşağı indirirken göğsü açık tut.", finish: "Topuklardan güç alıp kalçayı sıkarak yüksel.", breathe: "İnerken nefes al, kalkarken ver.", mistake: "Dizleri içeri düşürme ve topukları kaldırma." },
  lunge: { action: "TEK BACAK İN", focus: "Bacak · kalça · denge", start: "Ayakları ray üzerindeymiş gibi ayrı tut, gövdeyi dikleştir.", move: "İki dizi kontrollü büküp arka dizi zemine yaklaştır.", finish: "Öndeki topuktan güç alarak başlangıca dön.", breathe: "İnerken nefes al, kalkarken ver.", mistake: "Ön dizi içeri kaçırma ve adımı fazla dar tutma." },
  hinge: { action: "KALÇAYI GERİ İT", focus: "Arka bacak · kalça · sırt", start: "Dizleri hafif bük, omurgayı nötr ve ağırlığı bacağa yakın tut.", move: "Kalçayı geriye gönderirken gövdeyi tek parça öne eğ.", finish: "Topuklardan itip kalçayı sıkarak doğrul.", breathe: "İnişte nefes al, doğrulurken ver.", mistake: "Belini yuvarlama ve ağırlığı vücuttan uzaklaştırma." },
  bridge: { action: "KALÇAYI KALDIR", focus: "Kalça · arka bacak · core", start: "Sırt üstü yat, topukları kalçaya yaklaştır ve beli nötr tut.", move: "Topuklardan iterek kalçayı omuz-diz hattına kaldır.", finish: "Tepede kalçayı sık, beli aşırı yaymadan kontrollü in.", breathe: "Yükselirken nefes ver.", mistake: "Hareketi belden yapma ve dizleri dışa savurma." },
  plank: { action: "GÖVDEYİ SABİTLE", focus: "Core · omuz · kalça", start: "Dirsekleri omuzların altına yerleştir, ayakları geriye uzat.", move: "Karnı ve kalçayı sıkıp baştan topuğa düz çizgiyi koru.", finish: "Süre boyunca nefesi kesmeden pozisyonu sürdür.", breathe: "Kısa ve düzenli nefes alıp ver.", mistake: "Belini çökertme veya kalçayı fazla yükseltme." },
  core: { action: "MERKEZİ KONTROL ET", focus: "Karın · bel çevresi · kalça", start: "Bel boşluğunu kontrol et, kaburgaları aşağıda tut.", move: "Kol veya bacak hareket ederken gövdeyi sabit bırak.", finish: "Kontrolü kaybetmeden başlangıca dön.", breathe: "Zor bölümde yavaşça nefes ver.", mistake: "Hız için bel kontrolünden vazgeçme." },
  cardio: { action: "RİTMİ KORU", focus: "Nabız · bacak · koordinasyon", start: "Gövdeyi dengeli tut, iniş için dizleri yumuşat.", move: "Kollar ve bacakları eş zamanlı, kontrollü ritimde hareket ettir.", finish: "Yumuşak inişlerle ritmi sürdür.", breathe: "Konuşabilecek kadar düzenli nefes al.", mistake: "Sert iniş yapma ve kontrolsüz hızlanma." },
  mobility: { action: "KONTROLLÜ UZAT", focus: "Hareket açıklığı · nefes", start: "Omurgayı uzun tut, eklemleri rahat bırak.", move: "Ağrısız aralıkta gerilimi yavaşça artır.", finish: "Sekmeden ve zorlamadan başlangıca dön.", breathe: "Burundan yavaşça nefes alıp ver.", mistake: "Ağrının içine ilerleme ve nefesi tutma." },
  curl: { action: "DİRSEĞİ BÜK", focus: "Biceps · ön kol", start: "Dirsekleri gövdenin yanında sabitle, bilekleri düz tut.", move: "Ağırlığı omuza doğru kaldırırken yalnızca dirseği bük.", finish: "Üstte kısa süre sık, ağırlığı savurmadan yavaşça indir.", breathe: "Kaldırırken nefes ver, indirirken al.", mistake: "Dirsekleri öne taşıma ve gövdeyi geriye savurma." },
  triceps: { action: "DİRSEĞİ AÇ", focus: "Triceps · omuz dengesi", start: "Üst kolu sabitle, dirseği kontrollü bükülü tut.", move: "Ön kolu uzatarak dirseği aç ve tricepsi sık.", finish: "Dirseği yerinden oynatmadan yavaşça başlangıca dön.", breathe: "Kolu uzatırken nefes ver.", mistake: "Omzu öne düşürme ve dirseği yana açma." },
  raise: { action: "KOLU KALDIR", focus: "Omuz · üst sırt", start: "Kolları gövdenin yanında, dirsekleri hafif bükülü tut.", move: "Ağırlıkları omuz hizasına kadar kontrollü kaldır.", finish: "Omuzları aşağıda tutarak aynı yoldan yavaşça indir.", breathe: "Kaldırırken nefes ver.", mistake: "Ağırlığı savurma ve omuz hizasının çok üstüne çıkma." },
  fly: { action: "KOLLARI KAPAT", focus: "Göğüs · ön omuz", start: "Kolları iki yana aç, dirseklerde yumuşak bir açı bırak.", move: "Göğsünü sıkarak kolları geniş bir yay çizerek birleştir.", finish: "Omuz kontrolünü kaybetmeden kolları yavaşça yeniden aç.", breathe: "Kolları kapatırken nefes ver.", mistake: "Dirsek açısını değiştirme ve omuzu öne yuvarlama." },
  calf: { action: "TOPUKLARI KALDIR", focus: "Baldır · ayak bileği", start: "Ayak tabanını dengeli bas, dizleri kilitleme.", move: "Başparmak kökünden güç alıp topukları kontrollü yükselt.", finish: "Üstte kısa dur, topukları yavaşça aşağı indir.", breathe: "Yükselirken nefes ver.", mistake: "Ayak bileklerini dışa kaçırma ve zıplama." },
  "leg-machine": { action: "DİZİ AÇ / BÜK", focus: "Ön veya arka bacak", start: "Kalçanı ve belini mindere sabitle, makine eksenini dizinle hizala.", move: "Dizi kontrollü aç veya bük; hareketi bacak kasıyla yönet.", finish: "Ağırlıkları birbirine çarptırmadan yavaşça başlangıca dön.", breathe: "Zor bölümde nefes ver.", mistake: "Kalçayı minderden kaldırma ve ağırlığı hızla bırakma." },
};

function getMotionPattern(exercise: { name: string; english: string }): MotionPattern {
  // DİKKAT: burada Türkçe küçültme (tr-TR) KULLANILMAZ. Türkçe kuralında büyük
  // "I" noktasız "ı"ya döner ve "Inchworm" → "ınchworm" olarak ASCII kalıplarla
  // eşleşmez. Yerel bağımsız küçültüp yalnızca "İ"nin bıraktığı birleşik noktayı
  // siliyoruz; böylece "şınav" gibi gerçek "ı" içeren adlar bozulmadan kalır.
  const text = `${exercise.name} ${exercise.english}`.toLowerCase().replace(/\u0307/g, "");
  // Esneme ve kardiyo önce kontrol edilir: bu hareketler çoğu zaman bir kas adı
  // taşır ("Triceps Esnetme", "Rowing Machine") ve aşağıdaki kas kalıplarına
  // takılırsa kullanıcıya kuvvet anlatımı gösterilirdi.
  if (/stretch|esnetme|pose|mobility|90\/90|dislocate|rocker|cat cow|downward dog|side bend|spinal twist|thoracic rotation/.test(text)) return "mobility";
  if (/burpee|jumping jack|high knees|butt kicks|skater|squat thrust|box jump|inchworm|jump rope|ip atlama|stationary bike|bisiklet|sled push|battle rope|shadow boxing|stair climb|merdiven|brisk walk|yürüyüş|rowing machine|kürek çekme|thruster|flutter kick|kneeling jump|sıçrama/.test(text)) return "cardio";
  if (/floor press|yerde dambıl göğüs/.test(text)) return "floor-press";
  if (/lateral raise|front raise|yana .*açış|ön dambıl|scaption/.test(text)) return "raise";
  if (/chest fly|fly|pec deck|crossover|göğüs açış/.test(text)) return "fly";
  if (/curl/.test(text) && !/leg curl/.test(text)) return "curl";
  if (/triceps|skull crusher|kickback|jm press|dar şınav|close grip/.test(text)) return "triceps";
  if (/calf|baldır/.test(text)) return "calf";
  if (/leg extension|leg curl|bacak açış|bacak curl/.test(text)) return "leg-machine";
  if (/push-up|şınav|dip/.test(text)) return "pushup";
  if (/shoulder press|military press|arnold press|overhead press/.test(text)) return "overhead";
  if (/pulldown|pull-up|chin-up|barfiks|hang/.test(text)) return "pulldown";
  if (/row|face pull|reverse fly|rear delt/.test(text)) return "row";
  if (/deadlift|romanian|good morning|pull-through|swing/.test(text)) return "hinge";
  if (/hip thrust|glute bridge|bridge/.test(text)) return "bridge";
  if (/lunge|split squat|step-up|step up|cossack/.test(text)) return "lunge";
  if (/squat|leg press|wall sit/.test(text)) return "squat";
  if (/plank|mountain climber|bear crawl|handstand|amudu/.test(text)) return "plank";
  if (/crunch|dead bug|hollow|v-up|leg raise|pallof|woodchop|ab wheel|russian twist|bird dog|superman/.test(text)) return "core";
  if (/rotation|mobility/.test(text)) return "mobility";
  if (/march|run/.test(text)) return "cardio";
  // Kalça izolasyon hareketleri: köprü kılavuzu kalça sıkma ve nötr bel
  // vurgusuyla bunlara da uyuyor; genel "press" anlatımı ise tamamen alakasız.
  if (/frog pump|fire hydrant|donkey kick|abduction|band walk|band yürüyüş|clamshell|hip/.test(text)) return "bridge";
  if (/pull through|pull-through|back extension|bel ekstansiyonu|good morning/.test(text)) return "hinge";
  if (/pullover/.test(text)) return "pulldown";
  if (/tibialis/.test(text)) return "calf";
  return "press";
}

function getMotionGuide(exercise: { name: string; english: string }) {
  const guide = motionGuides[getMotionPattern(exercise)];
  return { ...guide, focus: localizeMotionFocus(guide.focus) };
}

function localizeMotionFocus(value: string) {
  return value.replace(/triceps/gi, "arka kol").replace(/biceps/gi, "biseps").replace(/core/gi, "merkez bölge");
}

function ExerciseAnimation({ exercise, compact = false, autoplay = true }: { exercise: { name: string; english: string; tone: string; images?: string[] }; compact?: boolean; autoplay?: boolean }) {
  const images = exercise.images?.length ? exercise.images : trustedExerciseMedia(exercise.name, exercise.english);
  return <ExerciseFrameAnimation images={images} name={exercise.name} compact={compact} autoplay={autoplay} />;
}

function workoutPrescription(workout: AiWorkout) {
  const totalSets = Math.max(1, Number.parseInt(workout.sets, 10) || 3);
  const restSeconds = Math.max(10, Number.parseInt(workout.rest, 10) || 60);
  const target = workout.sets.split("·")[1]?.trim() || `${workout.seconds} sn`;
  return { totalSets, restSeconds, target, workSeconds: Math.max(10, workout.seconds || 45) };
}

// Antrenman ekranındaki hazır program/bölgesel tarama listelerinden tek bir
// hareketi veya listenin tamamını antrenman oynatıcısında başlatmak için
// katalog kaydını AiWorkout biçimine çevirir.
function catalogItemToWorkout(item: typeof exerciseLibrary[number]): AiWorkout {
  const isHold = item.name === "Plank" || item.name === "Dead Bug";
  return { ...item, level: item.area, sets: `3 set · ${isHold ? "30 sn" : "10 tekrar"}`, rest: "60 sn dinlenme", seconds: isHold ? 30 : 45 };
}

function isExerciseSafeForAdaptivePain(exercise: AiWorkout, painAreas: string[]) {
  const text = `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR");
  const pain = painAreas.join(" ").toLocaleLowerCase("tr-TR");
  if (pain.includes("diz") && /squat|lunge|step-up|step up|jump|leg press|bacak açış/.test(text)) return false;
  if (pain.includes("omuz") && /push|press|dip|fly|overhead|raise|pulldown|barfiks/.test(text)) return false;
  if (pain.includes("bel") && /deadlift|good morning|back extension|woodchop|superman|russian twist/.test(text)) return false;
  return true;
}

// AiWorkout ekipman gereksinimini taşımaz; ekipman kontrolü için katalogdaki
// karşılığından okunur. Katalogda bulunamayan hareket (ör. AI'ın ürettiği bir
// isim) vücut ağırlığı varsayılır, çünkü aksini iddia edecek verimiz yok.
function catalogShape(workout: AiWorkout) {
  const item = exerciseLibrary.find((exercise) => exercise.name === workout.name);
  return {
    name: workout.name,
    area: workout.area,
    requires: item?.requires ?? [],
    bodyweight: item ? item.bodyweight : workout.bodyweight ?? true,
  };
}

function adaptWorkoutsToHistory(workouts: AiWorkout[], adaptation: TrainingAdaptation, fallbackPlan: AiWorkout[]) {
  const adjusted = workouts.map((workout) => {
    const currentSets = Math.max(1, Number.parseInt(workout.sets, 10) || 3);
    const currentRest = Math.max(30, Number.parseInt(workout.rest, 10) || 60);
    const target = workout.sets.split("·")[1]?.trim() || "10 tekrar";
    const isTimed = /sn|saniye/i.test(target);
    const currentReps = Math.max(1, Number.parseInt(target, 10) || 10);
    const prescription = adaptPrescription(currentSets, currentReps, currentRest, adaptation);
    const nextTarget = isTimed ? `${Math.max(15, currentReps + adaptation.repDelta * 2)} sn` : `${prescription.reps} tekrar`;
    return { ...workout, sets: `${prescription.sets} set · ${nextTarget}`, rest: `${prescription.restSeconds} sn dinlenme`, seconds: isTimed ? Math.max(15, currentReps + adaptation.repDelta * 2) : workout.seconds };
  });
  if (!adaptation.painAreas.length) return adjusted;
  const safeFallback = fallbackPlan.filter((exercise) => isExerciseSafeForAdaptivePain(exercise, adaptation.painAreas));
  const safeAdjusted = adjusted.filter((exercise) => isExerciseSafeForAdaptivePain(exercise, adaptation.painAreas));
  // Ağrı yüzünden düşen hareketin yerine konan aday, plandaki ekipman
  // gerçekliğine uymalı. Bu kontrol olmadan ekipmansız bir hazır programın
  // boşluğu kişisel plandan gelen bir dambıl hareketiyle doldurulabiliyordu.
  const planProfile = safeAdjusted.map(catalogShape);
  const replacements = safeFallback
    .filter((exercise) => !safeAdjusted.some((current) => exerciseKey(current) === exerciseKey(exercise)))
    .filter((exercise) => isReplacementCompatible(catalogShape(exercise), planProfile));
  return [...safeAdjusted, ...replacements].slice(0, workouts.length);
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function databaseExerciseAsWorkout(exercise: Exercise): AiWorkout {
  const muscle = exercise.primaryMuscles[0] || "full body";
  const area = muscle === "chest" ? "Göğüs" : ["lats", "middle back"].includes(muscle) ? "Sırt" : muscle === "shoulders" ? "Omuz" : ["biceps", "triceps", "forearms"].includes(muscle) ? "Kol" : muscle === "abdominals" ? "Core" : ["glutes"].includes(muscle) ? "Kalça" : "Bacak";
  const tone = area === "Bacak" || area === "Kalça" ? "orange" : area === "Göğüs" || area === "Core" ? "blue" : "purple";
  return { id: exercise.id, name: exercise.name, english: exercise.name, area, level: translateExerciseLabel(exercise.level), sets: "3 set · 10 tekrar", rest: "60 sn dinlenme", seconds: 45, tone, icon: "↗", instructions: turkishExerciseInstructions(exercise).join(" "), images: exercise.images, equipment: exercise.equipment, secondaryMuscles: exercise.secondaryMuscles, category: exercise.category, bodyweight: !exercise.equipment || ["body only", "none"].includes(exercise.equipment.toLowerCase()) };
}

function calculateEnergyMetrics(gender: string, ageValue: string, heightValue: string, weightValue: string, movementLevel: string): EnergyMetrics | null {
  const age = Number(ageValue);
  const height = Number(heightValue);
  const weight = Number(weightValue);
  if (!age || !height || !weight) return null;
  const sexConstant = gender === "Erkek" ? 5 : -161;
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + sexConstant);
  const activity = movementLevel === "Yüksek" ? { factor: 1.55, label: "Yüksek hareket" } : movementLevel === "Orta" ? { factor: 1.375, label: "Orta hareket" } : { factor: 1.2, label: "Düşük hareket" };
  return { bmr, tdee: Math.round(bmr * activity.factor), activityLabel: activity.label, activityFactor: activity.factor };
}

function workoutMet(exercise: AiWorkout, phase: WorkoutPhase, intensity: string) {
  if (phase === "rest") return 2.0;
  const pattern = getMotionPattern(exercise);
  const vigorous = /yüksek|ileri/i.test(intensity);
  if (pattern === "cardio") return vigorous ? 8 : 7.5;
  if (["squat", "lunge", "hinge"].includes(pattern)) return vigorous ? 6 : 5;
  if (["pushup", "plank", "core"].includes(pattern)) return vigorous ? 6.5 : 3.8;
  if (pattern === "mobility") return 2.8;
  return vigorous ? 6 : 3.5;
}

function fallbackAnalysis(gym: string, equipmentText: string, history: string[], goalText: string): AiPlanAnalysis {
  const duration = extractSessionMinutes(history[QUESTION.sessionMinutes]);
  const primaryGoal = history[QUESTION.goal] || goalText || "Güçlenme";
  const experienceLevel = history[QUESTION.level] || "Yeni başlıyorum";
  return { experienceLevel, weeklyFrequency: history[QUESTION.availableDays] || history[QUESTION.recentFrequency] || "1–2 gün", sessionMinutes: duration, primaryGoal, intensity: /ileri|yüksek/i.test(`${experienceLevel} ${history[QUESTION.dailyMovement]}`) ? "Orta-yüksek" : "Düşük-orta", equipmentMode: gym === "Salon" ? "Spor salonu ekipmanları" : equipmentText || "Ekipmansız", focusAreas: primaryGoal.toLowerCase().includes("kilo") ? ["Tüm vücut", "Kondisyon"] : primaryGoal.toLowerCase().includes("kas") ? ["Direnç", "Kas grubu dengesi"] : ["Temel kuvvet", "Hareket kalitesi"], adaptations: [`${duration} dakikalık seansa göre hareket sayısı ayarlandı.`, `${experienceLevel} seviyesine göre set ve dinlenme seçildi.`, history[QUESTION.injuries] && history[QUESTION.injuries] !== "Yok" ? `${history[QUESTION.injuries]} bölgesi için riskli hareketler elendi.` : "Belirtilen ağrı bölgesi olmadığı için dengeli seçim yapıldı."] };
}

function findRequestedLibraryExercises(requestedExercises: string, goalText: string, gym: string, equipmentText: string, history: string[]) {
  const requestedNames = `${requestedExercises} ${goalText}`.toLowerCase().split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  const pain = history[QUESTION.injuries]?.toLowerCase() || "";
  const matchesEquipment = (item: typeof exerciseLibrary[number]) => canPerformExercise(item, { isGym: gym === "Salon", equipmentText });
  const safeForPain = (item: typeof exerciseLibrary[number]) => !(pain.includes("diz") && ["Reverse Lunge", "Bulgarian Split Squat", "Step-up", "Mountain Climber", "Leg Press"].includes(item.name)) && !(pain.includes("omuz") && ["Şınav", "Eğimli Şınav", "Dambıl Omuz Press", "Lat Pulldown"].includes(item.name));
  return exerciseLibrary.filter((item) => requestedNames.some((requested) => item.name.toLowerCase().includes(requested) || item.english.toLowerCase().includes(requested) || requested.includes("yerde") && item.name === "Yerde Dambıl Göğüs Presi") && matchesEquipment(item) && safeForPain(item));
}

function exerciseKey(exercise: { name: string; english: string }) {
  return `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function findLibraryExercise(exercise: { name: string; english: string }) {
  const values = [exerciseKey({ name: exercise.name, english: "" }), exerciseKey({ name: exercise.english, english: "" })].filter(Boolean);
  return exerciseLibrary.find((candidate) => values.some((value) => {
    const candidateValues = [exerciseKey({ name: candidate.name, english: "" }), exerciseKey({ name: candidate.english, english: "" })];
    return candidateValues.includes(value) || candidateValues.some((candidateValue) => candidateValue.length > 5 && (candidateValue.includes(value) || value.includes(candidateValue)));
  }));
}

function isBodyweightWorkout(exercise: AiWorkout) {
  if (typeof exercise.bodyweight === "boolean") return exercise.bodyweight;
  const databaseExercise = exercise.id ? getExerciseById(exercise.id) : null;
  if (databaseExercise) return !databaseExercise.equipment || ["body only", "none"].includes(databaseExercise.equipment.toLowerCase());
  return findLibraryExercise(exercise)?.bodyweight ?? false;
}

function profileGoal(goalText: string, history: string[]) {
  const text = `${history[QUESTION.goal] || ""} ${goalText}`.toLocaleLowerCase("tr-TR");
  return text.includes("kilo") || text.includes("yağ") ? "kilo" : text.includes("kas") ? "kas" : text.includes("kondisyon") ? "kondisyon" : "güç";
}

function isExerciseSafeForProfile(exercise: { id?: string; name: string; english: string }, gym: string, equipmentText: string, history: string[]) {
  const text = `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR");
  const pain = (history[QUESTION.injuries] || "").toLocaleLowerCase("tr-TR");
  const equipment = equipmentText.toLocaleLowerCase("tr-TR");
  if (pain.includes("diz") && /squat|lunge|jump|step|leg press|mountain climber|box jump|skater/.test(text)) return false;
  if (pain.includes("omuz") && /push|press|dip|shoulder|fly|overhead|lateral raise|pulldown|barfiks/.test(text)) return false;
  if (pain.includes("bel") && /deadlift|good morning|back extension|woodchop|superman|russian twist/.test(text)) return false;
  const databaseExercise = exercise.id ? getExerciseById(exercise.id) : null;
  if (databaseExercise) return gym === "Salon" || !databaseExercise.equipment || ["body only", "none"].includes(databaseExercise.equipment) || equipment.includes(databaseExercise.equipment);
  const libraryExercise = findLibraryExercise(exercise);
  if (!libraryExercise) return false;
  return gym === "Salon" || libraryExercise.bodyweight || libraryExercise.requires.some((requirement) => equipment.includes(requirement));
}

function personalizeAiWorkouts(items: AiWorkout[], gym: string, equipmentText: string, history: string[], goalText: string, requestedExercises: string, completedSessions = 0) {
  const localPlan = createPersonalPlan(gym, equipmentText, history, goalText, requestedExercises, completedSessions);
  const goal = profileGoal(goalText, history);
  const safeAi = items.filter((item) => isExerciseSafeForProfile(item, gym, equipmentText, history)).map((item) => {
    const libraryExercise = findLibraryExercise(item);
    return libraryExercise ? { ...item, name: libraryExercise.name, english: libraryExercise.english, area: libraryExercise.area, tone: libraryExercise.tone, icon: libraryExercise.icon, instructions: item.instructions || libraryExercise.instructions } : item;
  });
  const requestedItems = findRequestedLibraryExercises(requestedExercises, goalText, gym, equipmentText, history).map((item) => ({ ...item, level: item.area, sets: "3 set · 10 tekrar", rest: "60 sn dinlenme", seconds: 45 }));
  const safeAiKeys = new Set(safeAi.map(exerciseKey));
  const requestedKeys = new Set(requestedItems.map(exerciseKey));
  const aiRequested = safeAi.filter((item) => requestedKeys.has(exerciseKey(item)));
  const goalArea = goal === "kilo" || goal === "kondisyon" ? "Kondisyon" : "";
  const requiredGoalAnchors = exerciseLibrary.filter((item) => item.goals.includes(goal) && (!goalArea || item.area === goalArea) && isExerciseSafeForProfile(item, gym, equipmentText, history)).map((item) => ({ ...item, level: item.area, sets: "3 set · 10 tekrar", rest: goalArea ? "45 sn dinlenme" : "60 sn dinlenme", seconds: 45 })).slice(0, goalArea ? 1 : 0);
  const localGoalAnchors = [...requiredGoalAnchors, ...localPlan].filter((item) => item.goals.includes(goal) && !safeAiKeys.has(exerciseKey(item)) && !requestedKeys.has(exerciseKey(item))).slice(0, 2);
  const candidates = [...requestedItems.filter((item) => !safeAiKeys.has(exerciseKey(item))), ...aiRequested, ...localGoalAnchors, ...safeAi.filter((item) => !requestedKeys.has(exerciseKey(item))), ...localPlan];
  const targetCount = Math.min(6, Math.max(3, localPlan.length || safeAi.length || 5));
  return candidates.filter((item, index, list) => list.findIndex((candidate) => exerciseKey(candidate) === exerciseKey(item)) === index).slice(0, targetCount);
}

function normalizeAiWorkouts(items: Array<{ id: string; name: string; english: string; area: string; sets: number; reps: string; restSeconds: number; instructions?: string }>): AiWorkout[] {
  const visuals: Record<string, { tone: string; icon: string }> = { Bacak: { tone: "orange", icon: "◒" }, Göğüs: { tone: "blue", icon: "✦" }, Sırt: { tone: "purple", icon: "↗" }, Kalça: { tone: "orange", icon: "◓" }, Core: { tone: "blue", icon: "—" } };
  return items.map((item) => {
    const databaseExercise = getExerciseById(item.id);
    if (!databaseExercise) return null;
    const libraryExercise = findLibraryExercise(item);
    const base = databaseExerciseAsWorkout(databaseExercise);
    const area = libraryExercise?.area || base.area || item.area;
    return { ...base, name: databaseExercise.name, english: databaseExercise.name, area, instructions: item.instructions || databaseExercise.instructions[0] || libraryExercise?.instructions || "Hareketi kontrollü yap, nefesini tutma ve ağrı hissedersen dur.", sets: `${item.sets} set · ${item.reps}`, rest: `${item.restSeconds} sn dinlenme`, seconds: item.reps.includes("sn") ? 30 : 45, level: databaseExercise.level, ...(libraryExercise ? { tone: libraryExercise.tone, icon: libraryExercise.icon } : visuals[area] || { tone: "purple", icon: "✦" }) };
  }).filter((item): item is AiWorkout => Boolean(item));
}

function AiScanFigure({ compact = false, status = "scanning", stage = "profile" }: { compact?: boolean; status?: "scanning" | "complete" | "fallback"; stage?: AiStage }) {
  const t = useTranslations();
  const stageCopy: Record<AiStage, [string, string]> = { profile: [t.aiScan.profileTitle, t.aiScan.profileBody], history: [t.aiScan.historyTitle, t.aiScan.historyBody], planning: [t.aiScan.planningTitle, t.aiScan.planningBody], complete: [t.aiScan.completeTitle, t.aiScan.completeBody] };
  const copy = status === "complete" ? stageCopy.complete : status === "fallback" ? [t.aiScan.fallbackTitle, t.aiScan.fallbackBody] : stageCopy[stage];
  return <div className={`${compact ? "ai-scan compact" : "ai-scan"} ${status}`}><div className="scan-figure"><span className="scan-head" /><span className="scan-body" /><span className="scan-line" /></div><div><strong>{copy[0]}</strong><small>{copy[1]}</small>{!compact && status === "scanning" && <div className="analysis-steps"><i className="done" /><i className={stage === "history" || stage === "planning" || stage === "complete" ? "done" : ""} /><i className={stage === "planning" || stage === "complete" ? "done" : ""} /></div>}</div></div>;
}

function AiPlanInsights({ analysis, schedule, progression, fingerprint }: { analysis: AiPlanAnalysis; schedule: AiScheduleDay[]; progression: string[]; fingerprint: string }) {
  const t = useTranslations();
  return <section className="ai-insights"><div className="section-title"><div><div className="eyebrow">{t.insights.eyebrow}</div><h2>{t.insights.title}</h2></div><span className="analysis-id">{t.insights.analysisId(fingerprint || t.insights.local)}</span></div><div className="analysis-grid"><article><span>{t.insights.levelLabel}</span><strong>{analysis.experienceLevel}</strong><small>{t.insights.intensitySuffix(analysis.intensity)}</small></article><article><span>{t.insights.frequencyLabel}</span><strong>{analysis.weeklyFrequency}</strong><small>{t.insights.perSession(analysis.sessionMinutes)}</small></article><article><span>{t.insights.environmentLabel}</span><strong>{analysis.equipmentMode}</strong><small>{analysis.focusAreas.join(" · ")}</small></article></div><div className="adaptation-list"><div><span>{t.insights.whyDifferent}</span>{analysis.adaptations.map((adaptation) => <p key={adaptation}>✓ {adaptation}</p>)}</div><div><span>{t.insights.fourWeekProgress}</span>{progression.slice(0, 4).map((item, index) => <p key={`${item}-${index}`}><b>{index + 1}</b>{item}</p>)}</div></div>{schedule.length > 0 && <div className="week-schedule">{schedule.map((item) => <div key={`${item.day}-${item.focus}`}><span>{item.day}</span><strong>{item.focus}</strong><small>{t.insights.dayMinutes(item.durationMinutes)}</small></div>)}</div>}</section>;
}

function AdaptivePlanCard({ adaptation, sessionCount }: { adaptation: TrainingAdaptation; sessionCount: number }) {
  const t = useTranslations();
  const changeText = adaptation.direction === "increase" ? t.insights.increaseChange(adaptation.setDelta, adaptation.repDelta, adaptation.restDelta) : adaptation.direction === "deload" ? t.insights.deloadChange(adaptation.setDelta, adaptation.repDelta, adaptation.restDelta) : t.insights.setsUnchanged;
  return <section className={`adaptive-card ${adaptation.direction}`}><div className="adaptive-icon">↗</div><div><div className="eyebrow">{t.insights.adaptiveEyebrow}</div><h2>{adaptation.title}</h2><p>{adaptation.summary}</p><div className="adaptive-change"><strong>{t.insights.nextPlan}</strong><span>{changeText}</span></div>{adaptation.painAreas.length > 0 && <div className="adaptive-pain">{t.insights.protectedAreas(adaptation.painAreas.join(" · "))}</div>}<ul>{adaptation.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul></div><span className="adaptive-count">{sessionCount}<small>{t.insights.recordsLabel}</small></span></section>;
}

function PersonalRecordsCard({ userId }: { userId?: string }) {
  const t = useTranslations();
  const unit = useWeightUnit();
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      try {
        const { data: exerciseLogs } = await supabase
          .from("workout_exercise_logs")
          .select("id, exercise_key, exercise_name, completed_at")
          .eq("user_id", userId as string)
          .eq("is_bodyweight", false)
          .order("completed_at", { ascending: false })
          .limit(400);
        if (cancelled) return;
        const logs = exerciseLogs || [];
        if (!logs.length) { setLoading(false); return; }
        const byId = new Map(logs.map((log) => [String(log.id), log]));
        const { data: setLogs } = await supabase
          .from("workout_set_logs")
          .select("exercise_log_id, weight_kg, reps")
          .eq("user_id", userId as string)
          .not("weight_kg", "is", null)
          .not("reps", "is", null)
          .limit(1500);
        if (cancelled) return;
        const rows: SetLogInput[] = (setLogs || []).flatMap((set) => {
          const log = byId.get(String(set.exercise_log_id));
          if (!log) return [];
          return [{ exerciseKey: String(log.exercise_key), exerciseName: String(log.exercise_name), completedAt: String(log.completed_at), weightKg: set.weight_kg === null ? null : Number(set.weight_kg), reps: set.reps === null ? null : Number(set.reps) }];
        });
        if (!cancelled) setRecords(summarizePersonalRecords(rows).slice(0, 6));
      } catch {
        // rekorlar yüklenemezse sessizce geç
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  return <section className="pr-panel"><div className="section-title"><div><div className="eyebrow">{t.personalRecords.eyebrow}</div><h2>{t.personalRecords.title}</h2></div>{records.length > 0 && <span className="pr-note">{t.personalRecords.note}</span>}</div>{loading ? <p className="pr-empty">{t.personalRecords.calculating}</p> : records.length === 0 ? <p className="pr-empty">{t.personalRecords.empty}</p> : <><div className="pr-list">{records.map((record) => <article key={record.exerciseKey} className="pr-item"><div className="pr-main"><strong>{record.exerciseName}</strong><small>{t.personalRecords.bestSet(formatWeight(record.bestWeightKg, unit), record.bestReps, record.sessionCount)}</small></div><div className="pr-orm"><b>{formatWeight(record.estimatedOneRepMaxKg, unit)}</b><span>{t.personalRecords.estimatedOneRepMax}</span></div></article>)}</div><p className="pr-disclaimer">{t.personalRecords.disclaimer}</p></>}</section>;
}

function ProgressView({ name, sessions, referenceTime, energyMetrics, userId, goalText }: { name: string; sessions: WorkoutSessionRecord[]; referenceTime: number; energyMetrics: EnergyMetrics | null; userId?: string; goalText: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const weekAgo = referenceTime - 7 * 24 * 60 * 60 * 1000;
  const weeklySessions = sessions.filter((session) => new Date(session.completedAt).getTime() >= weekAgo);
  const totalSeconds = sessions.reduce((total, session) => total + session.durationSeconds, 0);
  const totalCalories = sessions.reduce((total, session) => total + session.calories, 0);
  const referenceDate = new Date(referenceTime);
  const monthlySessions = sessions.filter((session) => { const date = new Date(session.completedAt); return date.getMonth() === referenceDate.getMonth() && date.getFullYear() === referenceDate.getFullYear(); });
  const monthlyMinutes = Math.round(monthlySessions.reduce((total, session) => total + session.durationSeconds, 0) / 60);
  const monthlyCalories = monthlySessions.reduce((total, session) => total + session.calories, 0);
  const completedTotal = monthlySessions.reduce((total, session) => total + session.completedExercises, 0);
  const exerciseTotal = monthlySessions.reduce((total, session) => total + session.totalExercises, 0);
  const completionRate = exerciseTotal ? Math.round((completedTotal / exerciseTotal) * 100) : 0;
  const weekBuckets = [3, 2, 1, 0].map((weeksAgo) => { const end = referenceTime - weeksAgo * 7 * 24 * 60 * 60 * 1000; const start = end - 7 * 24 * 60 * 60 * 1000; return sessions.filter((session) => { const time = new Date(session.completedAt).getTime(); return time > start && time <= end; }).length; });
  const maxWeek = Math.max(1, ...weekBuckets);
const dateLocale = locale === "en" ? "en-US" : "tr-TR";
return <div className="subview"><div className="eyebrow">{t.progress.eyebrow}</div><h1>{t.progress.title(name || t.progress.defaultName)}<em>{t.progress.titleEm}</em></h1><p className="lead">{t.progress.lead}</p><div className="progress-cards"><div><span>{t.progress.thisWeek}</span><strong>{weeklySessions.length}</strong><small>{t.progress.completedWorkouts}</small></div><div><span>{t.progress.totalDuration}</span><strong>{Math.round(totalSeconds / 60)} {locale === "en" ? "min" : "dk"}</strong><small>{sessions.length ? t.progress.allRecords : t.progress.awaitingFirst}</small></div><div><span>{t.progress.energyBurned}</span><strong>{totalCalories} kcal</strong><small>{t.progress.metEstimate}</small></div></div><WeeklyAiReview userId={userId} goalText={goalText} referenceTime={referenceTime} /><PersonalRecordsCard userId={userId} /><BodyMeasurements userId={userId} referenceTime={referenceTime} /><section className="monthly-report"><div><div className="eyebrow">{t.progress.monthlyReportEyebrow}</div><h2>{t.progress.monthlySummary(new Intl.DateTimeFormat(dateLocale, { month: "long" }).format(referenceDate))}</h2><p>{t.progress.monthlyDisclaimer}</p><div className="monthly-numbers"><span><strong>{monthlySessions.length}</strong>{t.progress.workoutUnit}</span><span><strong>{monthlyMinutes}</strong>{t.progress.minuteUnit}</span><span><strong>{monthlyCalories}</strong>{t.progress.kcalUnit}</span><span><strong>%{completionRate}</strong>{t.progress.completionUnit}</span></div></div><div className="month-bars" aria-label={t.progress.fourWeekChartLabel}>{weekBuckets.map((count, index) => <div key={index}><span style={{ height: `${Math.max(8, (count / maxWeek) * 100)}%` }} /><small>{t.progress.weekShort(index + 1)}</small><b>{count}</b></div>)}</div></section>{energyMetrics && <div className="energy-reference"><div><span>{t.progress.bmrRef}</span><strong>{energyMetrics.bmr} kcal</strong><small>{t.progress.bmrHint}</small></div><div><span>{t.progress.tdeeRef}</span><strong>{energyMetrics.tdee} kcal</strong><small>{t.progress.tdeeCoefficient(energyMetrics.activityLabel)}</small></div><p>{t.progress.equationNote}</p></div>}<div className="progress-panel"><div className="section-title"><div><div className="eyebrow">{t.progress.logEyebrow}</div><h2>{sessions.length ? t.progress.recentWorkouts : t.progress.createFirst}</h2></div><span className="progress-status">{sessions.length ? t.progress.recordsCount(sessions.length) : t.progress.ready}</span></div>{sessions.length ? <div className="session-list">{sessions.slice(0, 6).map((session) => <article key={session.id}><div><strong>{session.exerciseNames.slice(0, 3).join(" · ") || t.progress.personalWorkout}</strong><small>{new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(session.completedAt))}</small>{session.difficulty && <div className="session-feedback"><span>{translateDifficulty(t, session.difficulty)}</span><span>{t.progress.fatigueLabel(session.fatigue || 3)}</span>{session.painAreas?.filter((area) => area !== "Yok").map((area) => <span className="pain" key={area}>{translatePainArea(t, area)}</span>)}</div>}</div><div><b>{Math.max(1, Math.round(session.durationSeconds / 60))} {locale === "en" ? "min" : "dk"}</b><span>{session.calories} kcal · {session.completedExercises}/{session.totalExercises} {t.progress.movementUnit}</span></div></article>)}</div> : <div className="empty-progress"><span>✦</span><p>{t.progress.emptyBody}</p></div>}</div></div>;
}

function PersonalRecordCelebration({ records, unit, onDismiss }: { records: NewPersonalRecord[]; unit: WeightUnit; onDismiss: () => void }) {
  const t = useTranslations();
  if (!records.length) return null;
  return <section className="pr-celebration" role="status">
    <div className="pr-celebration-head">
      <div><div className="eyebrow">{t.personalRecordCelebration.eyebrow}</div><h2>{t.personalRecordCelebration.title(records.length)}</h2></div>
      <button type="button" aria-label={t.personalRecordCelebration.dismiss} onClick={onDismiss}>×</button>
    </div>
    <ul>{records.map((record) => <li key={record.exerciseKey}>
      <strong>{record.exerciseName}</strong>
      <span>{t.personalRecordCelebration.setDetail(formatWeight(record.weightKg, unit, { withUnit: true }), record.reps)}</span>
      <small>{record.isFirstRecord
        ? t.personalRecordCelebration.firstRecord(record.exerciseName)
        : t.personalRecordCelebration.beatenRecord(record.exerciseName, formatWeight(record.previousOneRepMaxKg, unit, { withUnit: true }), formatWeight(record.estimatedOneRepMaxKg, unit, { withUnit: true }))}</small>
    </li>)}</ul>
  </section>;
}

function LibraryView({ onOpenWorkout, onAddWorkout }: { onOpenWorkout: (exercise: AiWorkout) => void; onAddWorkout: (exercise: AiWorkout) => void }) {
  return <ExerciseLibrary onOpenWorkout={(exercise) => onOpenWorkout(databaseExerciseAsWorkout(exercise))} onAddWorkout={(exercise) => onAddWorkout(databaseExerciseAsWorkout(exercise))} />;
}

// Hazır programlar katalogdan ÜRETİLİR (bkz. lib/ready-programs.ts). Sabit isim
// listeleri iki soruna yol açıyordu: kataloğa hareket eklenince güncellenmiyor
// ve "ekipmansız" programa ekipmanlı hareket sızabiliyordu. Kişisel plan
// bunlardan farklı olmalı, o yüzden seçilen isimler orada son sıraya itilir.
const readyPrograms = EQUIPMENT_PROFILES.map((profile) => ({
  id: profile,
  names: buildReadyProgram(exerciseLibrary, profile).map((exercise) => exercise.name),
}));

const READY_PROGRAM_NAMES = new Set(readyPrograms.flatMap((program) => program.names));

// "Antrenman" ekranındaki bölgesel çalış seçenekleri. Katalogdaki gerçek
// `area` değerleridir; "Esneklik" ve "Kondisyon" bir vücut bölgesi olmadığı
// için listede yok.
const BODY_REGIONS = ["Göğüs", "Sırt", "Bacak", "Kalça", "Omuz", "Kol", "Core"] as const;

function regionLabel(t: Dictionary, area: string): string {
  if (area === "Göğüs") return t.workoutBrowse.regionChest;
  if (area === "Sırt") return t.workoutBrowse.regionBack;
  if (area === "Bacak") return t.workoutBrowse.regionLegs;
  if (area === "Kalça") return t.workoutBrowse.regionHips;
  if (area === "Omuz") return t.workoutBrowse.regionShoulders;
  if (area === "Kol") return t.workoutBrowse.regionArms;
  return t.workoutBrowse.regionCore;
}

function equipmentProfileLabel(t: Dictionary, profile: EquipmentProfile): string {
  if (profile === "dumbbell") return t.readyPrograms.dumbbellTab;
  if (profile === "band") return t.readyPrograms.bandTab;
  if (profile === "gym") return t.readyPrograms.gymTab;
  return t.readyPrograms.equipmentFreeTab;
}

export default function Home() {
  const t = useTranslations();
  const locale = useLocale();
  const [authStatus, setAuthStatus] = useState<"loading" | "anonymous" | "authenticated" | "unavailable">("loading");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [step, setStep] = useState<number>(STEP.profile);
  const [targetWeightDraft, setTargetWeightDraft] = useState("");
  const [planReport, setPlanReport] = useState<{ weeklyDays: number; sessionMinutes: number; exerciseCount: number } | null>(null);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("Kadın");
  const [gym, setGym] = useState("Evde");
  const [equipmentText, setEquipmentText] = useState("");
  const [goalText, setGoalText] = useState("");
  const [requestedExercises, setRequestedExercises] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(emptyHistory);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<number | null>(null);
  const [playerQueue, setPlayerQueue] = useState<AiWorkout[]>([]);
  const [timer, setTimer] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [workoutPhase, setWorkoutPhase] = useState<WorkoutPhase>("work");
  const [currentSet, setCurrentSet] = useState(1);
  const [exerciseSetDrafts, setExerciseSetDrafts] = useState<Record<number, WorkoutSetDraft[]>>({});
  const [newRecords, setNewRecords] = useState<NewPersonalRecord[]>([]);
  const [swapOpen, setSwapOpen] = useState(false);
  const [previousPerformances, setPreviousPerformances] = useState<Record<string, PreviousExercisePerformance | null>>({});
  const requestedPerformanceKeys = useRef(new Set<string>());
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);
  const [skippedExercises, setSkippedExercises] = useState<number[]>([]);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionCalories, setSessionCalories] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<WorkoutSessionRecord[]>([]);
  const [pendingSession, setPendingSession] = useState<WorkoutSessionRecord | null>(null);
  const [pendingExerciseLogs, setPendingExerciseLogs] = useState<CompletedExerciseLog[]>([]);
  const [feedbackDifficulty, setFeedbackDifficulty] = useState<WorkoutDifficulty>("Uygun");
  const [feedbackFatigue, setFeedbackFatigue] = useState(3);
  const [feedbackPainAreas, setFeedbackPainAreas] = useState<string[]>(["Yok"]);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [progressReferenceTime] = useState(() => Date.now());
  const [aiWorkouts, setAiWorkouts] = useState<AiWorkout[]>([]);
  const [aiRationale, setAiRationale] = useState("");
  const [aiSafetyNote, setAiSafetyNote] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<AiPlanAnalysis | null>(null);
  const [aiSchedule, setAiSchedule] = useState<AiScheduleDay[]>([]);
  const [aiProgression, setAiProgression] = useState<string[]>([]);
  const [aiFingerprint, setAiFingerprint] = useState("");
  const [aiStage, setAiStage] = useState<AiStage>("profile");
  const [activeView, setActiveView] = useState<"plan" | "workout" | "progress" | "library" | "nutrition" | "calendar" | "profile">("plan");
  const topLinksRef = useRef<HTMLDivElement>(null);
  const [, setAiStatus] = useState<"idle" | "scanning" | "complete" | "fallback">("idle");
  const [activityOpen, setActivityOpen] = useState(false);
  const weightUnit = useWeightUnit();
  // Hedef planı cevapları (hedef kilo, haftalık gün, seans süresi, tempo)
  // plan istemine de gider: kullanıcı "haftada 3 gün 45 dk ağır" dediyse
  // program da o tempoya göre kurulmalı.
  const storedGoalPlan = useStoredGoalPlan();
  const [aiError, setAiError] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | "loading">("loading");
  const [browseProgram, setBrowseProgram] = useState<{ title: string; profile: EquipmentProfile; area?: string } | null>(null);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionPlace, setRegionPlace] = useState<"home" | "gym">("home");
  const [browseDetail, setBrowseDetail] = useState<typeof exerciseLibrary[number] | null>(null);


  // PERFORMANS: aşağıdaki dört hesap YALNIZ gösterge panelinde kullanılır ama
  // bağımlılıkları arasında `history` var. Gate olmadan, profil testinde her
  // tuş vuruşu ve her şık dokunuşu 170 hareketlik katalogda ekipman eşleşmesi
  // (regex + normalize), plan üretimi, sıralama ve JSON.stringify tetikliyordu
  // — tek başına ekipman filtresi ~7 ms, toplamı telefonda yazmayı kasıyordu.
  // Panel dışındayken boş dönüyoruz; panele geçince zaten yeniden hesaplanır.
  const onDashboard = step === STEP.dashboard;
  const localPlan = useMemo(
    () => onDashboard ? createPersonalPlan(gym, equipmentText, history, goalText, requestedExercises, sessionHistory.length) : [],
    [onDashboard, gym, equipmentText, history, goalText, requestedExercises, sessionHistory.length],
  );
  const adaptation = useMemo(() => summarizeTrainingAdaptation(sessionHistory), [sessionHistory]);
  const workouts = useMemo(
    () => onDashboard ? adaptWorkoutsToHistory(aiWorkouts.length ? aiWorkouts : localPlan, adaptation, localPlan) : [],
    [onDashboard, adaptation, aiWorkouts, localPlan],
  );
  const planExerciseOptions = useMemo(
    () => onDashboard
      ? exerciseLibrary.filter((exercise) => isExerciseSafeForProfile(exercise, gym, equipmentText, history)).map((exercise) => ({ ...exercise, level: exercise.area, sets: `3 set · ${exercise.name === "Plank" || exercise.name === "Dead Bug" ? "30 sn" : "10 tekrar"}`, rest: "60 sn dinlenme", seconds: exercise.name === "Plank" || exercise.name === "Dead Bug" ? 30 : 45 }))
      : [],
    [onDashboard, equipmentText, gym, history],
  );
  const currentWorkout = activeWorkout === null ? null : playerQueue[activeWorkout] || null;
  const currentGuide = currentWorkout ? getMotionGuide(currentWorkout) : null;
  const currentPrescription = currentWorkout ? workoutPrescription(currentWorkout) : null;
  const currentWorkoutKey = currentWorkout ? exerciseLogKey(currentWorkout.name) : "";
  const currentSetDrafts = activeWorkout === null ? [] : exerciseSetDrafts[activeWorkout] || [];
  const currentPreviousPerformance = currentWorkoutKey ? previousPerformances[currentWorkoutKey] : null;
  const currentIsBodyweight = currentWorkout ? isBodyweightWorkout(currentWorkout) : false;
  // "" hâlâ "girilmedi" demektir (profil yüklemesi ve sıfırlama buna dayanır);
  // ekranda ise her zaman geçerli bir başlangıç değeri gösterilir.
  const shownHeight = height || String(DEFAULT_HEIGHT_CM);
  const shownWeight = weight || String(DEFAULT_WEIGHT_KG);
  // Hedef kilo profil testinden ÖNCE sorulur; varsayılan olarak mevcut kilo
  // gösterilir ("kilonu koru"), kullanıcı kaydırınca hedef oluşur.
  const shownTargetWeight = targetWeightDraft || shownWeight;
  const autoEquipmentProfile = useMemo(() => detectUserEquipmentProfile(gym === "Salon", equipmentText), [gym, equipmentText]);
  // Salon seçilirse salon kataloğu; ev seçilirse kullanıcının EVDEKİ ekipmanı
  // (profilinde "Salon" yazsa bile), yoksa ekipmansız.
  const regionProfile = useMemo(
    () => regionPlace === "gym" ? "gym" : detectUserEquipmentProfile(false, equipmentText),
    [regionPlace, equipmentText],
  );
  const browseExercises = useMemo(() => {
    if (!browseProgram) return [];
    if (!browseProgram.area) return buildReadyProgram(exerciseLibrary, browseProgram.profile);
    return exerciseLibrary
      .filter((item) => item.area === browseProgram.area && matchesProfile(item, browseProgram.profile))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [browseProgram]);
  const age = useMemo(() => {
    const calculated = calculateAge(birthDate);
    return calculated === null ? "" : String(calculated);
  }, [birthDate]);
  const energyMetrics = useMemo(() => calculateEnergyMetrics(gender, age, height, weight, history[QUESTION.dailyMovement]), [age, gender, height, history, weight]);
  // Rapordaki kalori açığı/fazlası. Hedef kilo verilmediyse (koru) gösterilmez.
  const reportEnergy = useMemo(() => {
    const target = readMeasure(shownTargetWeight, WEIGHT_RANGE, 0);
    const current = readMeasure(shownWeight, WEIGHT_RANGE, 0);
    if (!planReport || target <= 0 || Math.abs(target - current) < 0.5) return null;
    const result = buildGoalProjection(
      { targetWeightKg: target, weeklyDays: planReport.weeklyDays, sessionMinutes: planReport.sessionMinutes, intensity: "steady" },
      { currentWeightKg: current, bmr: energyMetrics?.bmr ?? null },
    );
    return result.status === "ready" ? result : null;
  }, [planReport, shownTargetWeight, shownWeight, energyMetrics]);
  const displayedSessionCalories = Math.round(sessionCalories);
  const progressionBlock = planProgressionBlock(sessionHistory.length);
  const planLevel = history[QUESTION.level] || "Yeni başlıyorum";
  const planGoal = history[QUESTION.goal] || goalText || "Güçlenme";
  const bmi = useMemo(() => {
    const h = Number(height) / 100;
    const w = Number(weight);
    return h && w ? (w / (h * h)).toFixed(1) : "22.4";
  }, [height, weight]);
  // Sohbet bağlamı da yalnız panelde (AiCoachChat) kullanılır; gate olmadan
  // her tuş vuruşunda tüm planı JSON'a çeviriyordu.
  const coachContext = useMemo(() => !onDashboard ? "" : JSON.stringify({
    profile: { name, age, gender, height, weight, bmi, environment: gym, equipment: equipmentText || "Ekipmansız", goal: goalText || planGoal, requestedExercises },
    historyAnswers: history,
    currentPlan: workouts.map(({ name: exerciseName, area, sets, rest, instructions }) => ({ name: exerciseName, area, sets, rest, instructions })),
    recentWorkouts: sessionHistory.slice(0, 5).map(({ completedAt, durationSeconds, calories, completedExercises, totalExercises, difficulty, fatigue, painAreas }) => ({ completedAt, durationSeconds, calories, completedExercises, totalExercises, difficulty, fatigue, painAreas })),
  }), [onDashboard, age, bmi, equipmentText, gender, goalText, gym, height, history, name, planGoal, requestedExercises, sessionHistory, weight, workouts]);

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPhoto(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(file);
    }
  }

  // Tüm seçenekli sorular çoklu seçimdir: insanların cevabı çoğu zaman tek
  // kutuya sığmıyor (ör. hem kuvvet hem kardiyo, hem bel hem diz). Seçimler
  // " · " ile birleştirilir; aşağı akıştaki okuyucular bu biçimi bekler.
  // Çoklu seçimde otomatik ilerleme yapılmaz; kullanıcı "Sonraki" ile geçer.
  function toggleAnswer(answer: string) {
    setHistory((current) => {
      const selected = current[questionIndex] ? current[questionIndex].split(" · ").filter(Boolean) : [];
      let next: string[];
      if (selected.includes(answer)) {
        next = selected.filter((value) => value !== answer);
      } else if (EXCLUSIVE_ANSWERS.has(answer)) {
        // "Yok" / "0 gün" gibi cevaplar yalnız başına anlamlıdır.
        next = [answer];
      } else {
        next = [...selected.filter((value) => !EXCLUSIVE_ANSWERS.has(value)), answer];
      }
      return current.map((value, index) => index === questionIndex ? next.join(" · ") : value);
    });
  }

  function setFreeAnswer(answer: string) {
    setHistory((current) => current.map((value, index) => index === questionIndex ? answer : value));
  }


  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      queueMicrotask(() => setAuthStatus("unavailable"));
      return;
    }

    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      const verifiedUser = isVerifiedAuthUser(data.user) ? data.user : null;
      if (data.user && !verifiedUser) await supabase.auth.signOut({ scope: "local" });
      if (cancelled) return;
      setAuthUser(verifiedUser);
      setAccountStatus(verifiedUser ? "loading" : "active");
      setAuthStatus(verifiedUser ? "authenticated" : "anonymous");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const verifiedUser = isVerifiedAuthUser(session?.user) ? session.user : null;
      setAuthUser(verifiedUser);
      setAccountStatus(verifiedUser ? "loading" : "active");
      setAuthStatus(verifiedUser ? "authenticated" : "anonymous");
      if (session?.user && !verifiedUser) {
        window.setTimeout(() => void supabase.auth.signOut({ scope: "local" }), 0);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const currentUser = authUser;
    const userId = currentUser.id;
    let cancelled = false;
    async function loadProfile() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (cancelled) return;
      if (!profile) {
        const metadataBirthDate = typeof currentUser.user_metadata?.birth_date === "string" ? currentUser.user_metadata.birth_date : "";
        setBirthDate(metadataBirthDate);
        setAccountStatus("active");
        return;
      }
      setName(typeof profile.display_name === "string" ? profile.display_name : "");
      setBirthDate(typeof profile.birth_date === "string" ? profile.birth_date : typeof currentUser.user_metadata?.birth_date === "string" ? currentUser.user_metadata.birth_date : "");
      setGender(typeof profile.gender === "string" ? profile.gender : "Kadın");
      setHeight(profile.height_cm ? String(profile.height_cm) : "");
      setWeight(profile.weight_kg ? String(profile.weight_kg) : "");
      setGym(profile.environment === "Salon" ? "Salon" : "Evde");
      setEquipmentText(typeof profile.equipment_text === "string" ? profile.equipment_text : "");
      setGoalText(typeof profile.goal_text === "string" ? profile.goal_text : "");
      setRequestedExercises(typeof profile.requested_exercises === "string" ? profile.requested_exercises : "");
      const nextAvatarPath = typeof profile.avatar_path === "string" ? profile.avatar_path : null;
      setAvatarPath(nextAvatarPath);
      const nextAvatarUrl = await signedAvatarUrl(supabase, nextAvatarPath);
      if (cancelled) return;
      setAvatarUrl(nextAvatarUrl);
      setAccountStatus(profile.account_status === "frozen" ? "frozen" : "active");
      // Eski 10 soruluk kayıtlar yeni sıraya taşınır; taşımadan okumak
      // kullanıcının hedefini "deneyim" sanmak gibi sessiz hatalar üretirdi.
      const savedHistory = normalizeHistory(profile.history_answers);
      if (Array.isArray(profile.history_answers) && profile.history_answers.length) setHistory(savedHistory);
      if (isHistoryComplete(savedHistory)) setStep(STEP.dashboard);
    }
    void loadProfile();
    return () => { cancelled = true; };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    const userId = authUser.id;
    let cancelled = false;
    async function loadCustomPlan() {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase.from("workout_plans").select("workouts").eq("user_id", userId).maybeSingle();
      if (cancelled || !Array.isArray(data?.workouts) || !data.workouts.length) return;
      setAiWorkouts(data.workouts.filter((item): item is AiWorkout => Boolean(item && typeof item === "object" && typeof (item as AiWorkout).name === "string" && typeof (item as AiWorkout).sets === "string")));
    }
    void loadCustomPlan();
    return () => { cancelled = true; };
  }, [authUser]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkoutHistory() {
      try {
        const supabase = createClient();
        if (!supabase) return;
        if (!authUser) return;
        const { data } = await supabase.from("workout_sessions").select("*").order("completed_at", { ascending: false }).limit(20);
        if (!cancelled && data) setSessionHistory(data.map((session) => ({ id: String(session.id), completedAt: String(session.completed_at), durationSeconds: Number(session.duration_seconds), calories: Number(session.calories), completedExercises: Number(session.completed_exercises), totalExercises: Number(session.total_exercises), exerciseNames: Array.isArray(session.exercise_names) ? session.exercise_names.map(String) : [], difficulty: session.difficulty === "Kolay" || session.difficulty === "Uygun" || session.difficulty === "Zor" ? session.difficulty : undefined, fatigue: session.fatigue ? Number(session.fatigue) : undefined, painAreas: Array.isArray(session.pain_areas) ? session.pain_areas.map(String) : [], feedbackNote: typeof session.feedback_note === "string" ? session.feedback_note : undefined })));
      } catch {
        // Oturum içinde tamamlanan antrenmanlar yine de ekranda gösterilir.
      }
    }
    void loadWorkoutHistory();
    return () => { cancelled = true; };
  }, [authUser]);

  useEffect(() => {
    const requestedKeys = requestedPerformanceKeys.current;
    if (!authUser || !currentWorkout || !currentWorkoutKey || requestedKeys.has(currentWorkoutKey)) return;
    requestedKeys.add(currentWorkoutKey);
    const userId = authUser.id;
    const exerciseName = currentWorkout.name;
    let cancelled = false;
    let settled = false;

    function finishLoading(performance: PreviousExercisePerformance | null) {
      if (cancelled) return;
      settled = true;
      setPreviousPerformances((current) => ({ ...current, [currentWorkoutKey]: performance }));
      // Taslaklar bu hareket açılırken kuruluyor, geçmiş ise sonradan geliyor;
      // bu yüzden otomatik doldurma veri ELDE EDİLDİĞİNDE uygulanır. Dolu veya
      // tamamlanmış alanlara dokunulmaz (bkz. applyPreviousPerformance).
      if (performance && activeWorkout !== null) {
        setExerciseSetDrafts((current) => {
          const drafts = current[activeWorkout];
          if (!drafts) return current;
          return { ...current, [activeWorkout]: applyPreviousPerformance(drafts, performance) };
        });
      }
    }

    async function loadPreviousPerformance() {
      const supabase = createClient();
      if (!supabase) {
        finishLoading(null);
        return;
      }
      const { data: exerciseLog, error: exerciseError } = await supabase
        .from("workout_exercise_logs")
        .select("id, exercise_name, completed_at, is_bodyweight")
        .eq("user_id", userId)
        .eq("exercise_key", currentWorkoutKey)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (exerciseError || !exerciseLog) {
        finishLoading(null);
        return;
      }
      const { data: setRows } = await supabase
        .from("workout_set_logs")
        .select("set_number, weight_kg, reps, duration_seconds, rpe, note")
        .eq("user_id", userId)
        .eq("exercise_log_id", exerciseLog.id)
        .order("set_number", { ascending: true });
      if (cancelled) return;
      finishLoading({
        exerciseLogId: String(exerciseLog.id),
        exerciseName: typeof exerciseLog.exercise_name === "string" ? exerciseLog.exercise_name : exerciseName,
        completedAt: String(exerciseLog.completed_at),
        isBodyweight: Boolean(exerciseLog.is_bodyweight),
        sets: (setRows || []).map((set) => ({
          setNumber: Number(set.set_number),
          weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
          reps: set.reps === null ? null : Number(set.reps),
          durationSeconds: set.duration_seconds === null ? null : Number(set.duration_seconds),
          rpe: set.rpe === null ? null : Number(set.rpe),
          note: typeof set.note === "string" && set.note ? set.note : null,
        })),
      });
    }

    void loadPreviousPerformance();
    return () => {
      cancelled = true;
      if (!settled) requestedKeys.delete(currentWorkoutKey);
    };
  }, [activeWorkout, authUser, currentWorkout, currentWorkoutKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeView, activeWorkout, questionIndex, step]);

  useEffect(() => {
    const links = topLinksRef.current;
    if (!links || !window.matchMedia("(max-width: 700px)").matches) return;

    const activeLink = links.querySelector<HTMLButtonElement>("button.active");
    if (!activeLink) return;

    const frame = window.requestAnimationFrame(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      activeLink.scrollIntoView({ behavior, block: "nearest", inline: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeView, step]);

  useEffect(() => {
    if (!isRunning || !currentWorkout) return;
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current > 1) return current - 1;
        const prescription = workoutPrescription(currentWorkout);
        if (workoutPhase === "work" && activeWorkout !== null) {
          setExerciseSetDrafts((drafts) => ({
            ...drafts,
            [activeWorkout]: (drafts[activeWorkout] || []).map((set) => set.setNumber === currentSet ? { ...set, completed: true } : set),
          }));
        }
        if (workoutPhase === "work" && currentSet < prescription.totalSets) {
          setWorkoutPhase("rest");
          return prescription.restSeconds;
        }
        if (workoutPhase === "rest") {
          setCurrentSet((set) => set + 1);
          setWorkoutPhase("work");
          setIsRunning(false);
          return prescription.workSeconds;
        }
        setWorkoutPhase("done");
        if (activeWorkout !== null) setCompletedExercises((completed) => completed.includes(activeWorkout) ? completed : [...completed, activeWorkout]);
        setIsRunning(false);
        return 0;
      });
      setSessionSeconds((current) => {
        const next = current + 1;
        const userWeight = Math.max(40, Number(weight) || 70);
        const met = workoutMet(currentWorkout, workoutPhase, aiAnalysis?.intensity || "Orta");
        const caloriesPerSecond = ((met * 3.5 * userWeight) / 200) / 60;
        setSessionCalories((calories) => calories + caloriesPerSecond);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeWorkout, aiAnalysis?.intensity, currentSet, currentWorkout, isRunning, weight, workoutPhase]);

  // Kullanıcının ekipmanına ve ağrı kısıtlarına uyan, aynı bölgeyi çalıştıran
  // alternatifler (bkz. lib/exercise-alternatives.ts).
  const swapOptions = useMemo(() => {
    if (!currentWorkout) return [];
    const allowed = exerciseLibrary.filter((exercise) => isExerciseSafeForProfile(exercise, gym, equipmentText, history));
    return alternativeExercises({ name: currentWorkout.name, area: currentWorkout.area, bodyweight: Boolean(currentWorkout.bodyweight), requires: [] }, allowed);
  }, [currentWorkout, equipmentText, gym, history]);

  function swapCurrentExercise(name: string) {
    const replacement = exerciseLibrary.find((exercise) => exercise.name === name);
    if (!replacement || activeWorkout === null) return;
    // Set/tekrar/dinlenme reçetesi kullanıcının planından gelir; yalnızca hareket
    // değişir, yük şeması korunur.
    const swapped: AiWorkout = { ...replacement, level: replacement.area, sets: currentWorkout?.sets ?? "3 set · 10 tekrar", rest: currentWorkout?.rest ?? "60 sn dinlenme", seconds: currentWorkout?.seconds ?? 45 };
    const prescription = workoutPrescription(swapped);
    setPlayerQueue((queue) => queue.map((item, index) => index === activeWorkout ? swapped : item));
    // Taslaklar hareketin kendisine bağlı; değişince sıfırdan kurulmalı.
    setExerciseSetDrafts((current) => ({ ...current, [activeWorkout]: createWorkoutSetDrafts(prescription.totalSets, prescription.target) }));
    setSwapOpen(false);
  }

  // Kısayoldan gelen gezinme: önce görünüm değişir, sonra hedef bölüm görünür
  // hâle getirilir. Kaydırma bir sonraki boyama karesine bırakılır; aksi halde
  // hedef henüz DOM'a girmemiş olur ve scroll hiçbir şey yapmaz.
  function navigateFromQuickAction(view: AppView, anchorId?: string) {
    setActiveView(view);
    if (!anchorId) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function openWorkout(index: number, queue: AiWorkout[] = workouts) {
    const nextWorkout = queue[index];
    if (!nextWorkout) return;
    setActiveView("workout");
    setPlayerQueue(queue);
    setExerciseSetDrafts(Object.fromEntries(queue.map((exercise, exerciseIndex) => {
      const prescription = workoutPrescription(exercise);
      return [exerciseIndex, createWorkoutSetDrafts(prescription.totalSets, prescription.target)];
    })));
    setActiveWorkout(index);
    setTimer(workoutPrescription(nextWorkout).workSeconds);
    setIsRunning(false);
    setWorkoutPhase("work");
    setCurrentSet(1);
    setCompletedExercises([]);
    setSkippedExercises([]);
    setSessionSeconds(0);
    setSessionCalories(0);
  }

  function updateExerciseSetDraft(exerciseIndex: number, setNumber: number, patch: Partial<Omit<WorkoutSetDraft, "setNumber">>) {
    setExerciseSetDrafts((current) => ({
      ...current,
      [exerciseIndex]: (current[exerciseIndex] || []).map((set) => set.setNumber === setNumber ? { ...set, ...patch } : set),
    }));
  }

  function goToWorkout(index: number) {
    const nextWorkout = playerQueue[index];
    if (!nextWorkout) return;
    setActiveWorkout(index);
    setTimer(workoutPrescription(nextWorkout).workSeconds);
    setIsRunning(false);
    setWorkoutPhase("work");
    setCurrentSet(1);
  }

  function completeCurrentPhase() {
    if (!currentWorkout || activeWorkout === null) return;
    const prescription = workoutPrescription(currentWorkout);
    setIsRunning(false);
    if (workoutPhase === "rest") {
      setCurrentSet((set) => set + 1);
      setWorkoutPhase("work");
      setTimer(prescription.workSeconds);
      return;
    }
    updateExerciseSetDraft(activeWorkout, currentSet, { completed: true });
    if (currentSet < prescription.totalSets) {
      setWorkoutPhase("rest");
      setTimer(prescription.restSeconds);
      return;
    }
    setWorkoutPhase("done");
    setTimer(0);
    setCompletedExercises((current) => current.includes(activeWorkout) ? current : [...current, activeWorkout]);
  }

  function skipExercise() {
    if (activeWorkout === null) return;
    setSkippedExercises((current) => current.includes(activeWorkout) ? current : [...current, activeWorkout]);
    if (activeWorkout < playerQueue.length - 1) goToWorkout(activeWorkout + 1);
    else {
      setWorkoutPhase("done");
      setTimer(0);
      setIsRunning(false);
    }
  }

  function finishWorkout() {
    if (!playerQueue.length) return;
    setIsRunning(false);
    const completed = activeWorkout !== null && workoutPhase === "done" && !skippedExercises.includes(activeWorkout) && !completedExercises.includes(activeWorkout) ? [...completedExercises, activeWorkout] : completedExercises;
    const record: WorkoutSessionRecord = { id: crypto.randomUUID(), completedAt: new Date().toISOString(), durationSeconds: Math.max(1, sessionSeconds), calories: Math.max(1, Math.round(sessionCalories)), completedExercises: completed.length, totalExercises: playerQueue.length, exerciseNames: playerQueue.map((exercise) => exercise.name) };
    const exerciseLogs = playerQueue.map((exercise, exerciseIndex) => skippedExercises.includes(exerciseIndex) ? null : buildCompletedExerciseLog({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseOrder: exerciseIndex + 1,
      isBodyweight: isBodyweightWorkout(exercise),
      drafts: exerciseSetDrafts[exerciseIndex] || [],
    })).filter((log): log is CompletedExerciseLog => Boolean(log));
    setActiveWorkout(null);
    setFeedbackDifficulty("Uygun");
    setFeedbackFatigue(3);
    setFeedbackPainAreas(["Yok"]);
    setFeedbackNote("");
    setPendingExerciseLogs(exerciseLogs);
    setPendingSession(record);
  }

  function toggleFeedbackPain(area: string) {
    setFeedbackPainAreas((current) => area === "Yok" ? ["Yok"] : [...current.filter((item) => item !== "Yok"), ...(current.includes(area) ? [] : [area])]);
  }

  async function saveWorkoutFeedback() {
    if (!pendingSession) return;
    const record: WorkoutSessionRecord = { ...pendingSession, difficulty: feedbackDifficulty, fatigue: feedbackFatigue, painAreas: feedbackPainAreas.length ? feedbackPainAreas : ["Yok"], feedbackNote: feedbackNote.trim() || undefined };
    const exerciseLogs = pendingExerciseLogs;
    setSessionHistory((current) => [record, ...current]);
    setPendingSession(null);
    setPendingExerciseLogs([]);
    setActiveView("progress");
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const baseRecord = { id: record.id, user_id: user.id, completed_at: record.completedAt, duration_seconds: record.durationSeconds, calories: record.calories, completed_exercises: record.completedExercises, total_exercises: record.totalExercises, exercise_names: record.exerciseNames };
      const { error: sessionError } = await supabase.from("workout_sessions").insert({ ...baseRecord, difficulty: record.difficulty, fatigue: record.fatigue, pain_areas: record.painAreas, feedback_note: record.feedbackNote || null });
      if (sessionError) {
        const { error: fallbackSessionError } = await supabase.from("workout_sessions").insert(baseRecord);
        if (fallbackSessionError) return;
      }
      window.dispatchEvent(new Event("fit-ai-activity-recorded"));
      const completedDate = localDateKey(new Date(record.completedAt));
      const { data: scheduledDay } = await supabase.from("workout_schedule").select("id, scheduled_time, original_date").eq("user_id", user.id).eq("scheduled_date", completedDate).maybeSingle();
      await supabase.from("workout_schedule").upsert({ id: scheduledDay?.id || crypto.randomUUID(), user_id: user.id, scheduled_date: completedDate, scheduled_time: scheduledDay?.scheduled_time || localTimeKey(new Date(record.completedAt)), status: "completed", original_date: scheduledDay?.original_date || null, completed_session_id: record.id, updated_at: new Date().toISOString() }, { onConflict: "user_id,scheduled_date" });
      if (!exerciseLogs.length) return;

      const exerciseRows = exerciseLogs.map((log) => ({
        id: crypto.randomUUID(),
        session_id: record.id,
        user_id: user.id,
        exercise_id: log.exerciseId,
        exercise_name: log.exerciseName,
        exercise_key: log.exerciseKey,
        exercise_order: log.exerciseOrder,
        is_bodyweight: log.isBodyweight,
        completed_at: record.completedAt,
      }));
      const { error: exerciseLogError } = await supabase.from("workout_exercise_logs").insert(exerciseRows);
      if (exerciseLogError) return;

      const exerciseRowByOrder = new Map(exerciseRows.map((row) => [row.exercise_order, row]));
      const setRows = exerciseLogs.flatMap((log) => {
        const exerciseRow = exerciseRowByOrder.get(log.exerciseOrder);
        if (!exerciseRow) return [];
        return log.sets.map((set) => ({
          id: crypto.randomUUID(),
          session_id: record.id,
          exercise_log_id: exerciseRow.id,
          user_id: user.id,
          set_number: set.setNumber,
          weight_kg: set.weightKg === null ? null : Math.round(unitToKg(set.weightKg, weightUnit) * 100) / 100,
          reps: set.reps,
          duration_seconds: set.durationSeconds,
          rpe: set.rpe,
          note: set.note,
        }));
      });
      const { error: setLogError } = setRows.length ? await supabase.from("workout_set_logs").insert(setRows) : { error: null };
      if (setLogError) {
        await supabase.from("workout_exercise_logs").delete().in("id", exerciseRows.map((row) => row.id));
        return;
      }

      // Kişisel rekor kutlaması: bu seansın setleri, AYNI hareketlerin daha
      // önceki setleriyle karşılaştırılır. Sorgu bu seansı hariç tutar, aksi
      // halde yeni eklenen setler kendi kendinin rekoru sayılırdı.
      void (async () => {
        const exerciseKeys = exerciseLogs.map((log) => log.exerciseKey);
        if (!exerciseKeys.length) return;
        const { data: priorRows } = await supabase
          .from("workout_set_logs")
          .select("weight_kg, reps, workout_exercise_logs!inner(exercise_key, exercise_name, completed_at)")
          .eq("user_id", user.id)
          .neq("session_id", record.id)
          .in("workout_exercise_logs.exercise_key", exerciseKeys);
        const priorSets = (priorRows || []).flatMap((row) => {
          const log = (row as { workout_exercise_logs?: { exercise_key?: string; exercise_name?: string; completed_at?: string } }).workout_exercise_logs;
          if (!log?.exercise_key) return [];
          return [{
            exerciseKey: String(log.exercise_key),
            exerciseName: String(log.exercise_name || log.exercise_key),
            completedAt: String(log.completed_at || record.completedAt),
            weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
            reps: row.reps === null ? null : Number(row.reps),
          }];
        });
        const sessionSets = exerciseLogs.flatMap((log) => log.sets.map((set) => ({
          exerciseKey: log.exerciseKey,
          exerciseName: log.exerciseName,
          completedAt: record.completedAt,
          weightKg: set.weightKg === null ? null : unitToKg(set.weightKg, weightUnit),
          reps: set.reps,
        })));
        const records = detectNewPersonalRecords(sessionSets, priorSets);
        if (records.length) setNewRecords(records);
      })();

      setPreviousPerformances((current) => {
        const next = { ...current };
        exerciseLogs.forEach((log) => {
          const exerciseRow = exerciseRowByOrder.get(log.exerciseOrder);
          if (!exerciseRow) return;
          next[log.exerciseKey] = { exerciseLogId: exerciseRow.id, exerciseName: log.exerciseName, completedAt: record.completedAt, isBodyweight: log.isBodyweight, sets: log.sets };
          requestedPerformanceKeys.current.add(log.exerciseKey);
        });
        return next;
      });
    } catch {
      // Bağlantı yoksa kayıt bu oturumun ilerleme ekranında kalır.
    }
  }

  async function createPlan() {
    setSaving(true);
    // Kişiselleştirme artık soru ekranının altında değil, kendi tam ekranında
    // gösterilir: son soruda kalıp bekletmek "takıldı mı?" hissi veriyordu.
    setStep(STEP.building);
    // Hedef planı, test cevaplarıyla birlikte burada kurulur. Haftalık gün ve
    // seans süresi zaten teste soruldu; ikinci kez sormak yerine oradan alınır.
    const targetKg = readMeasure(shownTargetWeight, WEIGHT_RANGE, 0);
    const currentKg = readMeasure(shownWeight, WEIGHT_RANGE, 0);
    if (targetKg > 0 && Math.abs(targetKg - currentKg) >= 0.5) {
      setStoredGoalPlan({
        targetWeightKg: targetKg,
        weeklyDays: extractWeeklyDays(history[QUESTION.availableDays] || history[QUESTION.recentFrequency]),
        sessionMinutes: extractSessionMinutes(history[QUESTION.sessionMinutes]),
        intensity: "steady",
      });
    }
    setAiStatus("scanning");
    setAiStage("profile");
    setAiError("");
    setAiWorkouts([]);
    setAiAnalysis(null);
    setAiSchedule([]);
    setAiProgression([]);
    setAiFingerprint("");
    try {
      const supabase = createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await saveProfileWithHistory(supabase, {
            displayName: name || "Sporcu",
            birthDate,
            gender,
            heightCm: Number(height) || null,
            weightKg: Number(weight) || null,
            environment: gym === "Salon" ? "Salon" : "Evde",
            equipmentText,
            goalText,
            requestedExercises,
            avatarPath,
          });
          await supabase.from("profiles").update({ history_answers: history, updated_at: new Date().toISOString() }).eq("id", user.id);
        }
      }
    } catch {
      // Profil kaydı başarısız olsa bile AI planı üretmeye devam eder.
    }
    setAiStage("history");
    try {
      const exerciseCatalog = getExercisesForAI();
      setAiStage("planning");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 45_000);
      const trainingHistory = sessionHistory.slice(0, 8).map((session) => ({ completedAt: session.completedAt, completedExercises: session.completedExercises, totalExercises: session.totalExercises, difficulty: session.difficulty, fatigue: session.fatigue, painAreas: session.painAreas, feedbackNote: session.feedbackNote }));
      const aiResponse = await authorizedFetch("/api/generate-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, birthDate, age, gender, height, weight, environment: gym, equipment: equipmentText, goal: goalText, requestedExercises, history, trainingHistory, adaptation, exerciseCatalog, photoDataUrl, locale, goalPlan: storedGoalPlan }), signal: controller.signal }).finally(() => window.clearTimeout(timeout));
      if (aiResponse.ok) {
        const aiPlan = await aiResponse.json() as { workouts?: Array<{ id: string; name: string; english: string; area: string; sets: number; reps: string; restSeconds: number; instructions?: string }>; rationale?: string; safetyNote?: string; analysis?: AiPlanAnalysis; weeklySchedule?: AiScheduleDay[]; progression?: string[]; profileFingerprint?: string };
        const normalizedWorkouts = aiPlan.workouts?.length ? normalizeAiWorkouts(aiPlan.workouts) : [];
        const personalizedWorkouts = personalizeAiWorkouts(normalizedWorkouts, gym, equipmentText, history, goalText, requestedExercises, sessionHistory.length);
        if (personalizedWorkouts.length) setAiWorkouts(personalizedWorkouts);
        setAiRationale(aiPlan.rationale || "");
        setAiSafetyNote(aiPlan.safetyNote || "");
        setAiAnalysis(aiPlan.analysis || fallbackAnalysis(gym, equipmentText, history, goalText));
        setAiSchedule(Array.isArray(aiPlan.weeklySchedule) ? aiPlan.weeklySchedule : []);
        setAiProgression(Array.isArray(aiPlan.progression) ? aiPlan.progression : []);
        setAiFingerprint(aiPlan.profileFingerprint || "AI");
        setAiStage("complete");
        setAiStatus(personalizedWorkouts.length ? "complete" : "fallback");
      } else {
        const errorPayload = await aiResponse.json().catch(() => null) as { error?: string } | null;
        setAiError(errorPayload?.error || t.readyPrograms.aiUnavailableError);
        setAiAnalysis(fallbackAnalysis(gym, equipmentText, history, goalText));
        setAiProgression([t.readyPrograms.fallbackProgressionForm, t.readyPrograms.fallbackProgressionAdd, t.readyPrograms.fallbackProgressionRest, t.readyPrograms.fallbackProgressionIncrease]);
        setAiFingerprint("");
        setAiStatus("fallback");
      }
    } catch {
      setAiStatus("fallback");
      setAiError(t.readyPrograms.aiConnectionError);
      setAiAnalysis(fallbackAnalysis(gym, equipmentText, history, goalText));
      setAiProgression([t.readyPrograms.fallbackProgressionForm, t.readyPrograms.fallbackProgressionAdd, t.readyPrograms.fallbackProgressionRest, t.readyPrograms.fallbackProgressionIncrease]);
      setAiFingerprint("");
    }
    setAiStage("complete");
    setSaving(false);
    // Panele doğrudan atlamak yerine önce özet: kaç gün, kaç dakika, kaç
    // hareket ve kalori açığı/fazlası. Kullanıcı ne aldığını görmeden
    // uygulamanın içine düşüyordu.
    setPlanReport({
      weeklyDays: extractWeeklyDays(history[QUESTION.availableDays] || history[QUESTION.recentFrequency]),
      sessionMinutes: extractSessionMinutes(history[QUESTION.sessionMinutes]),
      exerciseCount: createPersonalPlan(gym, equipmentText, history, goalText, requestedExercises, sessionHistory.length).length,
    });
    setStep(STEP.report);
  }

  // Hazır program/bölgesel liste ekipman filtresine göre üretilir (bkz.
  // browseExercises); burada yalnız o listeyi oynatıcıya kuyruk olarak veriyoruz.
  // Kişisel plana (aiWorkouts) dokunmaz, bu yüzden oynatıcıdan çıkınca kullanıcı
  // aynı listeye döner, kişisel planı bozulmaz.
  function startBrowseSession() {
    if (browseExercises.length) openWorkout(0, browseExercises.map(catalogItemToWorkout));
  }

  function startSingleExercise(item: typeof exerciseLibrary[number]) {
    setBrowseDetail(null);
    openWorkout(0, [catalogItemToWorkout(item)]);
  }

  async function saveCustomPlan(plan: EditableWorkout[]) {
    setAiWorkouts(plan);
    const supabase = createClient();
    if (!supabase || !authUser) return;
    await supabase.from("workout_plans").upsert({ user_id: authUser.id, workouts: plan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }

  async function resetCustomPlan() {
    setAiWorkouts([]);
    const supabase = createClient();
    if (!supabase || !authUser) return;
    await supabase.from("workout_plans").delete().eq("user_id", authUser.id);
  }

  // Profil testine dönüş. Cevaplar korunur (hazır gelir), yalnız soru akışı
  // yeniden açılır; antrenman ve beslenme kayıtlarına dokunulmaz.
  function retakeProfileTest() {
    setQuestionIndex(0);
    setStep(STEP.test);
    setActiveView("plan");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetSavedProgress() {
    setSessionHistory([]);
    setPreviousPerformances({});
    requestedPerformanceKeys.current.clear();
    setPendingSession(null);
    setPendingExerciseLogs([]);
    setExerciseSetDrafts({});
    // Serimiz ve takvim, görünüm değişse de mount kalır ve kendi çektikleri
    // veriyi tutar; yalnız buradaki state'i temizlemek onları eski kayıtları
    // göstermeye devam ederken bırakıyordu (ör. sıfırlama sonrası hâlâ görünen
    // son antrenman). Sunucudan yeniden okumaları için haber veriyoruz.
    window.dispatchEvent(new CustomEvent("fit-ai-progress-reset"));
  }

  function handleSignedIn(user: User) {
    if (!isVerifiedAuthUser(user)) {
      setAuthUser(null);
      setAccountStatus("active");
      setAuthStatus("anonymous");
      return;
    }
    setAuthUser(user);
    setAccountStatus("loading");
    setAuthStatus("authenticated");
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    setAuthUser(null);
    setAuthStatus("anonymous");
    setStep(STEP.profile);
    setName("");
    setBirthDate("");
    setHeight("");
    setWeight("");
    setGender("Kadın");
    setGym("Evde");
    setEquipmentText("");
    setGoalText("");
    setRequestedExercises("");
    setHistory(emptyHistory());
    setSessionHistory([]);
    setExerciseSetDrafts({});
    setPreviousPerformances({});
    requestedPerformanceKeys.current.clear();
    setPendingExerciseLogs([]);
    setAiWorkouts([]);
    setActiveView("plan");
    setAvatarPath(null);
    setAvatarUrl(null);
    setAccountStatus("active");
  }

  function applySavedProfile(profile: EditableProfile, nextAvatarUrl: string | null) {
    setName(profile.displayName);
    setBirthDate(profile.birthDate);
    setGender(profile.gender);
    setHeight(profile.heightCm === null ? "" : String(profile.heightCm));
    setWeight(profile.weightKg === null ? "" : String(profile.weightKg));
    setGoalText(profile.goalText);
    setGym(profile.environment);
    setEquipmentText(profile.equipmentText);
    setRequestedExercises(profile.requestedExercises);
    setAvatarPath(profile.avatarPath);
    setAvatarUrl(nextAvatarUrl);
  }

  function clearDeletedAccount() {
    setAuthUser(null);
    setAuthStatus("anonymous");
    setAccountStatus("active");
    setStep(STEP.profile);
  }

  if (authStatus !== "authenticated" || !authUser) {
    return <><MobileRuntime /><AuthScreen status={authStatus === "authenticated" ? "loading" : authStatus} onSignedIn={handleSignedIn} /></>;
  }

  if (accountStatus === "loading") {
    return <SportyLoader title={t.auth.profileLoadingTitle} body={t.auth.profileLoadingBody} />;
  }

  if (accountStatus === "frozen") {
    return <FrozenAccountScreen user={authUser} onReactivated={() => setAccountStatus("active")} onSignOut={handleSignOut} />;
  }

  return (
    <main className="app-shell">
      <MobileRuntime />
      <PreferenceSync userId={authUser?.id} />
      {step === STEP.dashboard && <nav className="topbar">
        <div className="brand"><span className="brand-mark">↗</span><span>Hede<span className="brand-letter-gradient">f</span><span className="brand-dot">it</span></span></div>
        <div className="top-links" ref={topLinksRef}><button type="button" aria-pressed={activeView === "plan"} className={activeView === "plan" ? "active" : ""} onClick={() => setActiveView("plan")}>{t.nav.home}</button><button type="button" aria-pressed={activeView === "workout"} className={activeView === "workout" ? "active" : ""} onClick={() => setActiveView("workout")}>{t.nav.workout}</button><button type="button" aria-pressed={activeView === "nutrition"} className={activeView === "nutrition" ? "active" : ""} onClick={() => setActiveView("nutrition")}>{t.nav.nutrition}</button><button type="button" aria-pressed={activeView === "progress"} className={activeView === "progress" ? "active" : ""} onClick={() => setActiveView("progress")}>{t.nav.progress}</button><button type="button" aria-pressed={activeView === "calendar"} className={activeView === "calendar" ? "active" : ""} onClick={() => setActiveView("calendar")}>{t.nav.calendar}</button><button type="button" aria-pressed={activeView === "library"} className={activeView === "library" ? "active" : ""} onClick={() => setActiveView("library")}>{t.nav.library}</button></div>
        <div className="top-actions"><LanguageToggle /><ThemeToggle /><button type="button" className={activeView === "profile" ? "profile-mini active" : "profile-mini"} aria-pressed={activeView === "profile"} onClick={() => step === STEP.dashboard && setActiveView("profile")}><span className="mini-avatar">{avatarUrl ? <Image src={avatarUrl} alt="" width={30} height={30} unoptimized /> : name ? name.charAt(0).toUpperCase() : "E"}</span><span>{t.nav.profile}</span></button></div>
      </nav>}
      {step < STEP.dashboard && <div className="toggle-row onboarding-toggle-row"><LanguageToggle /><ThemeToggle /></div>}

      {step < STEP.dashboard ? (
        <section className="onboarding-wrap">
          <div className="progress-row"><span className="progress-label">{step === STEP.test ? t.onboarding.stepLabelHistory : t.onboarding.stepLabelProfile}</span><span>{t.onboarding.stepCounter(Math.min(step, FORM_STEP_COUNT))}</span></div>
          <div className="progress-track"><span style={{ width: `${(Math.min(step, FORM_STEP_COUNT) / FORM_STEP_COUNT) * 100}%` }} /></div>

          {step === STEP.profile && <div className="step-content">
            <div className="eyebrow">{t.onboarding.step1Eyebrow}</div><h1>{t.onboarding.step1TitleLine1}<br /><em>{t.onboarding.step1TitleEm}</em></h1><p className="lead">{t.onboarding.step1Lead}</p>
            <div className="form-grid">
              <label className="wide">{t.onboarding.nameLabel}<input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.onboarding.namePlaceholder} /></label>
              <label className="wide">{t.onboarding.birthDateLabel}<input type="date" min="1905-01-01" max={new Date().toISOString().slice(0, 10)} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /><small>{age ? t.onboarding.birthDateHintKnown(age) : t.onboarding.birthDateHintUnknown}</small></label>
            </div>
            <BodyMetrics gender={gender} onGenderChange={setGender} height={shownHeight} onHeightChange={setHeight} weight={shownWeight} onWeightChange={setWeight} targetWeight={shownTargetWeight} onTargetWeightChange={setTargetWeightDraft} />
            {/* Kaydırıcı hiç dokunulmasa bile bir değer GÖSTERİR; ekranda 170 cm
                yazarken devam düğmesinin kapalı kalması kullanıcıyı kilitliyordu.
                Gösterilen değeri devam ederken yazıyoruz, böylece ekranda görünen
                ile kaydedilen her zaman aynı olur. */}
            <div className="action-row"><button className="primary-btn" type="button" disabled={!name.trim() || !isValidBirthDate(birthDate)} onClick={() => { setHeight(shownHeight); setWeight(shownWeight); setStep(STEP.place); }}>{t.common.continueLabel} <span>→</span></button></div>
          </div>}

          {step === STEP.place && <div className="step-content equipment-step">
            <div className="eyebrow">{t.onboarding.step2Eyebrow}</div><h1>{t.onboarding.step2TitleLine1}<br /><em>{t.onboarding.step2TitleEm}</em></h1><p className="lead">{t.onboarding.step2Lead}</p>
            <TrainingPlaceSwitch value={gym === "Salon" ? "Salon" : "Evde"} onChange={setGym} label={t.onboarding.trainingPlaceLabel} homeLabel={t.onboarding.homeLabel} homeHint={t.onboarding.homeHint} gymLabel={t.onboarding.gymLabel} gymHint={t.onboarding.gymHint} />
            <label className="textarea-label">{t.onboarding.equipmentLabel} <small>{t.onboarding.optionalHint}</small><textarea value={equipmentText} onChange={(e) => setEquipmentText(e.target.value)} placeholder={t.onboarding.equipmentPlaceholder(gender)} /></label>
            <GoalPicker value={goalText} onChange={setGoalText} />
            <label className="textarea-label">{t.onboarding.goalLabel} <small>{t.onboarding.goalHint}</small><textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder={t.onboarding.goalPlaceholder(gender)} /></label>
            <label className="textarea-label">{t.onboarding.requestedExercisesLabel} <small>{t.onboarding.optionalHint}</small><textarea value={requestedExercises} onChange={(e) => setRequestedExercises(e.target.value)} placeholder={t.onboarding.requestedExercisesPlaceholder(gender)} /></label>
            <div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(STEP.profile)}>{t.common.back}</button><button className="primary-btn" type="button" onClick={() => setStep(STEP.photo)}>{t.common.continueLabel} <span>→</span></button></div>
          </div>}

          {step === STEP.photo && <div className="step-content photo-step">
            <div className="eyebrow">{t.onboarding.step3Eyebrow}</div><h1>{t.onboarding.step3TitleLine1}<br /><em>{t.onboarding.step3TitleEm}</em></h1><p className="lead">{t.onboarding.step3Lead}</p>
            <label className="upload-box">{photo ? <Image src={photo} alt={t.onboarding.uploadAlt} width={300} height={160} unoptimized /> : <><span className="upload-icon">＋</span><strong>{t.onboarding.uploadTitle}</strong><small>{t.onboarding.uploadHint}</small></>}<input type="file" accept="image/*" onChange={handlePhoto} /></label>
            <div className="privacy-note"><span>⌁</span> {t.onboarding.privacyNoteAnalysis}</div><div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(STEP.place)}>{t.common.back}</button><button className="primary-btn" type="button" onClick={() => setStep(STEP.test)}>{t.onboarding.startTest} <span>→</span></button></div>
          </div>}

          {step === STEP.test && <div className="step-content history-step">
            {/* Sayaç ve çubuk doğrudan sorunun üstünde: uzun başlık ve lead
                arada kalınca kullanıcı kaçıncı soruda olduğunu göremiyordu. */}
            <div className="question-progress"><div className="question-counter"><b>{questionIndex + 1}</b><span>/{QUESTION_COUNT}</span></div><div className="question-progress-bar" role="progressbar" aria-valuenow={questionIndex + 1} aria-valuemin={1} aria-valuemax={QUESTION_COUNT}><i style={{ width: `${((questionIndex + 1) / QUESTION_COUNT) * 100}%` }} /></div></div>
            <div className="question-card"><h2>{t.onboarding.historyQuestions[questionIndex]}</h2>{(answerOptions[questionIndex] ?? []).length > 0 && <p className="multi-select-note">{t.onboarding.multiSelectNote}</p>}<div className="answer-grid">{(answerOptions[questionIndex] ?? []).map((answer, answerIndex) => { const label = (t.onboarding.answerOptions[questionIndex] ?? [])[answerIndex] ?? answer; const selected = (history[questionIndex] || "").split(" · ").includes(answer); return <button type="button" key={answer} aria-pressed={selected} className={selected ? "answer selected" : "answer"} onClick={() => toggleAnswer(answer)}>{label}</button>; })}</div>{FREE_TEXT_QUESTIONS.includes(questionIndex) && <textarea className="question-note" aria-label={t.onboarding.historyQuestions[questionIndex]} value={history[questionIndex]} onChange={(e) => setFreeAnswer(e.target.value)} rows={4} />}</div>
            <div className="action-row"><button className="back-btn" type="button" onClick={() => questionIndex ? setQuestionIndex(questionIndex - 1) : setStep(STEP.photo)}>{t.common.back}</button>{questionIndex < QUESTION_COUNT - 1 ? <button className="primary-btn" type="button" onClick={() => setQuestionIndex(questionIndex + 1)}>{t.onboarding.next} <span>→</span></button> : <button className="primary-btn" type="button" onClick={createPlan} disabled={saving}>{t.onboarding.buildPlan} <span>→</span></button>}</div>
          </div>}

          {step === STEP.building && <div className="step-content building-step">
            <AiScanFigure status="scanning" stage={aiStage} />
            <h1>{t.onboarding.buildingTitle}<br /><em>{t.onboarding.buildingTitleEm}</em></h1>
            <p className="lead">{t.onboarding.buildingLead}</p>
          </div>}

          {step === STEP.report && planReport && <div className="step-content report-step">
            <div className="eyebrow">{t.onboarding.reportEyebrow}</div>
            <h1>{t.onboarding.reportTitle}<br /><em>{t.onboarding.reportTitleEm}</em></h1>
            <p className="lead">{aiRationale || t.onboarding.reportLead}</p>
            <div className="report-grid">
              <div><span>{t.onboarding.reportWeeklyDays}</span><strong>{planReport.weeklyDays}</strong><small>{t.onboarding.reportWeeklyDaysHint(planReport.sessionMinutes)}</small></div>
              <div><span>{t.onboarding.reportExercises}</span><strong>{planReport.exerciseCount}</strong><small>{t.onboarding.reportExercisesHint}</small></div>
              {reportEnergy && <div><span>{reportEnergy.losing ? t.onboarding.reportDeficit : t.onboarding.reportSurplus}</span><strong>{reportEnergy.dailyDeltaKcal} <small>kcal</small></strong><small>{t.onboarding.reportEnergyHint(reportEnergy.weeks)}</small></div>}
            </div>
            {aiSafetyNote && <div className="ai-safety"><strong>{t.dashboard.safetyNoteLabel}</strong><span>{aiSafetyNote}</span></div>}
            {aiError && <div className="ai-error">{aiError}</div>}
            <p className="report-disclaimer">{t.goalPlan.disclaimer}</p>
            <div className="action-row"><button className="primary-btn" type="button" onClick={() => setStep(STEP.dashboard)}>{t.onboarding.reportContinue} <span>→</span></button></div>
          </div>}
          <aside className="side-note"><div className="orb"><span>✦</span></div><p><strong>{t.onboarding.sideNoteTitle}</strong><br />{t.onboarding.sideNoteBody}</p></aside>
        </section>
      ) : (
        <section className="dashboard">
<WorkoutCalendar active={activeView === "calendar"} userId={authUser?.id} onStartWorkout={() => setActiveView("workout")} />{activeView === "calendar" ? null : activeView === "profile" ? <ProfileManager user={authUser} profile={{ displayName: name, birthDate, gender, heightCm: Number(height) || null, weightKg: Number(weight) || null, goalText, environment: gym === "Salon" ? "Salon" : "Evde", equipmentText, requestedExercises, avatarPath }} avatarUrl={avatarUrl} onSaved={applySavedProfile} onFrozen={() => setAccountStatus("frozen")} onDeleted={clearDeletedAccount} onProgressReset={resetSavedProgress} onRetakeTest={retakeProfileTest} onSignOut={handleSignOut} /> : activeView === "progress" ? <><PersonalRecordCelebration records={newRecords} unit={weightUnit} onDismiss={() => setNewRecords([])} /><ProgressView name={name} sessions={sessionHistory} referenceTime={progressReferenceTime} energyMetrics={energyMetrics} userId={authUser?.id} goalText={goalText || planGoal} /></> : activeView === "nutrition" ? <CalorieTracker userId={authUser?.id} bmr={energyMetrics?.bmr} tdee={energyMetrics?.tdee} weightKg={Number(weight) || undefined} activityFactor={energyMetrics?.activityFactor} workoutDays={inferWorkoutDays(history[QUESTION.availableDays] || history[QUESTION.recentFrequency])} profileGoal={goalText || planGoal} /> : activeView === "library" ? <LibraryView onOpenWorkout={(exercise) => openWorkout(0, [exercise])} onAddWorkout={(exercise) => setAiWorkouts((current) => current.some((item) => item.id === exercise.id) ? current : [...current, exercise])} /> : <>
          {activeView === "workout" && activeWorkout !== null && currentWorkout && currentGuide && currentPrescription ? <div className="workout-player">
            <button className="back-btn" type="button" onClick={() => { setIsRunning(false); setActiveWorkout(null); }}>{t.workoutPlayer.backToPlan}</button>
            <div className="workout-session-progress" aria-label={t.workoutPlayer.progressLabel}>{playerQueue.map((exercise, index) => <span key={`${exercise.name}-${index}`} className={completedExercises.includes(index) ? "complete" : skippedExercises.includes(index) ? "skipped" : index === activeWorkout ? "active" : ""} />)}</div>
            <ExerciseAnimation exercise={currentWorkout} />
            <div className="player-title-row"><div><div className="eyebrow">{t.workoutPlayer.movementLabel(activeWorkout + 1, playerQueue.length)}</div><h1>{currentWorkout.name}</h1></div><span className={`phase-badge ${workoutPhase}`}>{workoutPhase === "rest" ? t.workoutPlayer.phaseRest : workoutPhase === "done" ? t.workoutPlayer.phaseDone : t.workoutPlayer.phaseSet(currentSet, currentPrescription.totalSets)}</span><button type="button" className="swap-trigger" onClick={() => setSwapOpen((open) => !open)} aria-expanded={swapOpen}>{t.exerciseSwap.trigger}</button></div>
            {swapOpen && <div className="swap-panel"><div className="eyebrow">{t.exerciseSwap.title}</div><p>{t.exerciseSwap.hint}</p>{swapOptions.length ? <div className="swap-options">{swapOptions.map((option) => <button type="button" key={option.name} onClick={() => swapCurrentExercise(option.name)}>{option.name} <small>{option.area}</small></button>)}</div> : <p className="swap-empty">{t.exerciseSwap.empty}</p>}<button type="button" className="swap-cancel" onClick={() => setSwapOpen(false)}>{t.exerciseSwap.cancel}</button></div>}
            <div className="movement-guide"><div className="guide-heading"><span>{t.workoutPlayer.guideHeading}</span><strong>{currentGuide.focus}</strong></div><ol><li>{currentGuide.start}</li><li>{currentWorkout.instructions}</li><li>{currentGuide.finish}</li></ol></div>
            <div className="form-cues"><div><span>{t.workoutPlayer.breatheLabel}</span><strong>{currentGuide.breathe}</strong></div><div className="warning"><span>{t.workoutPlayer.mistakeLabel}</span><strong>{currentGuide.mistake}</strong></div></div>
            <div className={`timer-card phase-${workoutPhase}`}><span>{isRunning ? workoutPhase === "rest" ? t.workoutPlayer.timerActiveRest : t.workoutPlayer.timerActiveSet : workoutPhase === "done" ? t.workoutPlayer.timerDoneLabel : workoutPhase === "rest" ? t.workoutPlayer.timerReadyRest : t.workoutPlayer.timerReady}</span><strong>{formatClock(timer)}</strong><small>{workoutPhase === "rest" ? t.workoutPlayer.nextSet(Math.min(currentSet + 1, currentPrescription.totalSets)) : t.workoutPlayer.targetSummary(currentPrescription.target, displayedSessionCalories)}</small></div>
            <div className="set-tracker"><div><span>{t.workoutPlayer.setsLabel}</span><strong>{currentSet} / {currentPrescription.totalSets}</strong></div><div className="set-dots">{Array.from({ length: currentPrescription.totalSets }, (_, index) => <i key={index} className={index + 1 < currentSet || workoutPhase === "done" ? "complete" : index + 1 === currentSet ? "active" : ""} />)}</div><small>{currentWorkout.rest}</small></div>
            <WorkoutSetLogger exerciseName={currentWorkout.name} activeSet={currentSet} isBodyweight={currentIsBodyweight} sets={currentSetDrafts} previous={currentPreviousPerformance} loadingPrevious={Boolean(currentWorkoutKey) && !(currentWorkoutKey in previousPerformances)} unit={weightUnit} onChange={(setNumber, patch) => activeWorkout !== null && updateExerciseSetDraft(activeWorkout, setNumber, patch)} />
            <div className="player-tools"><button type="button" onClick={() => activeWorkout > 0 && goToWorkout(activeWorkout - 1)} disabled={activeWorkout === 0}>{t.workoutPlayer.previousLabel}</button>{workoutPhase !== "done" && <button type="button" onClick={completeCurrentPhase}>{workoutPhase === "rest" ? t.workoutPlayer.skipRest : t.workoutPlayer.completeSet}</button>}<button type="button" onClick={skipExercise}>{t.workoutPlayer.skipExercise}</button></div>
            <div className="player-actions"><button className="start-btn" type="button" onClick={() => workoutPhase === "done" ? activeWorkout < playerQueue.length - 1 ? goToWorkout(activeWorkout + 1) : void finishWorkout() : setIsRunning((running) => !running)}>{workoutPhase === "done" ? activeWorkout < playerQueue.length - 1 ? t.workoutPlayer.nextExercise : t.workoutPlayer.saveWorkout : isRunning ? t.workoutPlayer.pause : workoutPhase === "rest" ? t.workoutPlayer.startRest : t.workoutPlayer.startSet} <span>→</span></button></div>
            <button className="finish-btn" type="button" onClick={() => void finishWorkout()}>{t.workoutPlayer.finishAndSave}</button>
          </div> : activeView === "workout" ? <>
          <div className="ready-programs" id="ready-programs">
            {browseProgram ? <>
              <div className="section-title"><div><div className="eyebrow">{t.readyPrograms.eyebrow}</div><h2>{browseProgram.title}</h2></div><button type="button" className="back-btn" onClick={() => setBrowseProgram(null)}>{t.workoutBrowse.backToPrograms}</button></div>
              <p className="ready-note">{equipmentProfileLabel(t, browseProgram.profile)}</p>
              {browseExercises.length ? <>
                <button type="button" className="start-btn" onClick={startBrowseSession}>{t.workoutBrowse.startSession} <span>→</span></button>
                <div className="database-exercise-grid">{browseExercises.map((item) => <article className="database-exercise-card" key={item.name}><ExerciseAnimation exercise={item} compact autoplay={false} /><div className="database-card-copy"><div className="database-card-top"><span>{item.area}</span></div><h3>{item.name}</h3><div className="exercise-facts"><span>{item.bodyweight ? t.dashboard.noEquipment : (item.requires[0] || item.area)}</span></div><button type="button" className="exercise-detail-button" onClick={() => setBrowseDetail(item)}>{t.exerciseLibrary.viewDetails} →</button></div></article>)}</div>
              </> : <div className="library-empty"><strong>{t.workoutBrowse.emptyTitle}</strong><p>{t.workoutBrowse.emptyBody}</p></div>}
            </> : regionPickerOpen ? <>
              <div className="section-title"><div><div className="eyebrow">{t.readyPrograms.eyebrow}</div><h2>{t.workoutBrowse.regionPickerTitle}</h2></div><button type="button" className="back-btn" onClick={() => setRegionPickerOpen(false)}>{t.workoutBrowse.regionPickerBack}</button></div>
              {/* Ev/Salon burada ayrıca sorulur: kullanıcı profilinde "Evde"
                  yazsa bile bugün salona gitmiş olabilir. Seçim yalnız bu
                  taramayı etkiler, profili değiştirmez. */}
              <div className="metric-legend">{t.workoutBrowse.placeLabel}</div>
              <div className="region-place" role="group" aria-label={t.workoutBrowse.placeLabel}>
                <button type="button" aria-pressed={regionPlace === "home"} className={regionPlace === "home" ? "equipment selected" : "equipment"} onClick={() => setRegionPlace("home")}>{t.onboarding.homeLabel}</button>
                <button type="button" aria-pressed={regionPlace === "gym"} className={regionPlace === "gym" ? "equipment selected" : "equipment"} onClick={() => setRegionPlace("gym")}>{t.onboarding.gymLabel}</button>
              </div>
              <div className="metric-legend region-areas-legend">{t.workoutBrowse.regionAreasLabel}</div>
              <div className="equipment-list">{BODY_REGIONS.map((area) => <button type="button" key={area} className="equipment" onClick={() => { setRegionPickerOpen(false); setBrowseProgram({ title: regionLabel(t, area), profile: regionProfile, area }); }}>{regionLabel(t, area)}</button>)}</div>
            </> : <>
              <div className="section-title"><div className="eyebrow">{t.readyPrograms.eyebrow}</div><span className="ready-note">{t.readyPrograms.note}</span></div>
              <div className="ready-grid">
                <article className="ready-card"><div><h3>{t.workoutBrowse.aiCardTitle}</h3><p>{t.workoutBrowse.aiCardDetail(equipmentProfileLabel(t, autoEquipmentProfile))}</p></div><button type="button" onClick={() => setBrowseProgram({ title: t.workoutBrowse.aiCardTitle, profile: autoEquipmentProfile })}>{t.workoutBrowse.start} →</button></article>
                <article className="ready-card"><div><h3>{t.readyPrograms.gymTitle}</h3><p>{t.readyPrograms.gymDetail}</p></div><button type="button" onClick={() => setBrowseProgram({ title: t.readyPrograms.gymTitle, profile: "gym" })}>{t.workoutBrowse.start} →</button></article>
                <article className="ready-card"><div><h3>{t.readyPrograms.equipmentFreeTitle}</h3><p>{t.readyPrograms.equipmentFreeDetail}</p></div><button type="button" onClick={() => setBrowseProgram({ title: t.readyPrograms.equipmentFreeTitle, profile: "equipmentFree" })}>{t.workoutBrowse.start} →</button></article>
              </div>
              <button type="button" className="region-launch-btn" onClick={() => setRegionPickerOpen(true)}>{t.workoutBrowse.regionButton}</button>
            </>}
          </div>
          {browseDetail && <div className="exercise-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="workout-browse-detail-title" onMouseDown={(event) => event.target === event.currentTarget && setBrowseDetail(null)}><article className="exercise-detail"><button type="button" className="detail-close" aria-label={t.workoutBrowse.detailClose} onClick={() => setBrowseDetail(null)} autoFocus>×</button><ExerciseAnimation exercise={browseDetail} /><div className="detail-copy"><div className="eyebrow">{browseDetail.area}</div><h2 id="workout-browse-detail-title">{browseDetail.name}</h2><div className="detail-tags"><span>{browseDetail.area}</span><span>{browseDetail.bodyweight ? t.dashboard.noEquipment : browseDetail.requires.join(" · ")}</span></div><section className="detail-instructions"><h3>{t.dashboard.howTo}</h3><ol><li>{getMotionGuide(browseDetail).start}</li><li>{browseDetail.instructions}</li><li>{getMotionGuide(browseDetail).finish}</li></ol></section><div className="detail-actions"><button type="button" className="detail-open" onClick={() => startSingleExercise(browseDetail)}>{t.workoutBrowse.startSingle}</button></div></div></article></div>}
          {!browseProgram && !regionPickerOpen && <>
          <div className="plan-explanation"><div><div className="eyebrow">{t.dashboard.planWhyEyebrow}</div><h2>{planLevel} · {planGoal}</h2><p>{aiRationale || t.dashboard.planWhyDefault}</p>{aiSafetyNote && <div className="ai-safety"><strong>{t.dashboard.safetyNoteLabel}</strong><span>{aiSafetyNote}</span></div>}{aiError && <div className="ai-error">{aiError}</div>}</div></div>
          <AdaptivePlanCard adaptation={adaptation} sessionCount={sessionHistory.length} />
          {aiAnalysis && <AiPlanInsights analysis={aiAnalysis} schedule={aiSchedule} progression={aiProgression} fingerprint={aiFingerprint} />}
          <div className="workout-layout" id="workout-plan-list"><div className="workout-main"><div className="section-title"><div><div className="eyebrow">{t.dashboard.todayEyebrow}</div><h2>{t.dashboard.myWorkout(planLevel)}</h2></div><div className="plan-stage"><span>{t.dashboard.stageLabel(progressionBlock + 1)}</span><strong>{[t.dashboard.stageIntro, t.dashboard.stageVolume, t.dashboard.stageStrength, t.dashboard.stageIntensity][progressionBlock]}</strong><small>{progressionBlock >= 3 ? t.dashboard.stageMaxHint : t.dashboard.stageHint([3, 7, 12][progressionBlock] - sessionHistory.length)}</small></div></div><PlanEditor workouts={aiWorkouts.length ? aiWorkouts : localPlan} exerciseOptions={planExerciseOptions} onSave={saveCustomPlan} onReset={resetCustomPlan} /><div className="workout-list">{workouts.map((workout, index) => { const guide = getMotionGuide(workout); return <article className="workout-card" key={workout.name}><ExerciseAnimation exercise={workout} compact autoplay={false} /><div className="exercise-info"><div className="exercise-labels"><div className="pill">{workout.level}</div><span>{guide.action}</span></div><h3>{workout.name} <small>{workout.english}</small></h3><p>{workout.sets} · {workout.rest}</p><details className="how-to"><summary>{t.dashboard.howTo}</summary><ol className="mini-steps"><li>{guide.start}</li><li>{workout.instructions}</li><li>{guide.finish}</li></ol></details></div><button className="play-btn" type="button" aria-label={t.dashboard.openWorkoutLabel(workout.name)} onClick={() => openWorkout(index)}><span>▶</span><small>{t.dashboard.openShort}</small></button></article>; })}</div><button className="start-btn" type="button" onClick={() => openWorkout(0)}>{t.dashboard.startWorkout} <span>→</span></button></div><aside className="coach-card"><div className="coach-top"><span className="spark">✦</span><span>{t.dashboard.coachBrand}</span></div><h2>{t.dashboard.coachTitleLine1}<br /><em>{t.dashboard.coachTitleEm}</em> {t.dashboard.coachTitleRest}</h2><p>{t.dashboard.coachBody}</p><div className="coach-line" /><small>{t.dashboard.coachSignoff(name || t.dashboard.defaultName)}</small></aside></div></>}</>
          : <>
          <div className="dashboard-head"><div><div className="eyebrow">{t.dashboard.todaysPlan}</div><h1>{t.dashboard.greeting(name || t.dashboard.defaultName)}<em>{t.dashboard.greetingEm}</em></h1></div><ActivityStreak userId={authUser.id} /></div>
          <div className="stats-row"><div><span>{t.dashboard.bmiLabel}</span><strong>{bmi}</strong><small>{t.dashboard.bmiHint}</small></div><div><span>{t.dashboard.goalLabel}</span><strong>{goalText ? t.dashboard.goalPersonal : t.dashboard.goalDefault}</strong><small>{t.dashboard.goalHint}</small></div><div><span>{t.dashboard.environmentLabel}</span><strong>{gym === "Salon" ? t.onboarding.gymLabel : t.onboarding.homeLabel}</strong><small>{equipmentText || t.dashboard.noEquipment}</small></div></div>
          <button type="button" className="activity-open" onClick={() => setActivityOpen(true)}><span className="activity-open-icon">🏃</span><span className="activity-open-text"><span className="eyebrow">{t.dashboard.activityEyebrow}</span><strong>{t.dashboard.activityTitle}</strong><small>{t.dashboard.activityBody}</small></span><span className="activity-open-cta">{t.dashboard.activityOpen} →</span></button>
          {activityOpen && <div className="activity-overlay" role="dialog" aria-modal="true" aria-label={t.dashboard.activityDialogLabel} onClick={(event) => { if (event.target === event.currentTarget) setActivityOpen(false); }}><div className="activity-modal"><button type="button" className="activity-modal-close" onClick={() => setActivityOpen(false)} aria-label={t.dashboard.activityCloseLabel}>×</button><ActivityLogger userId={authUser.id} weightKg={Number(weight) || 70} /></div></div>}
          <QuickActions onNavigate={navigateFromQuickAction} />
          <GoalPlanCard userId={authUser?.id} currentWeightKg={Number(weight) || null} />
          <div className="wellness-row"><div className="wellness-card calorie-card"><div><span>{t.dashboard.todaysEnergy}</span><strong>{displayedSessionCalories} <small>kcal</small></strong><p>{t.dashboard.todaysEnergyBody}</p></div><div className="calorie-ring"><i>{displayedSessionCalories}</i></div><div className="calorie-note"><span>{t.dashboard.trackingLabel}</span><strong>{t.dashboard.trackingValue}</strong><small>{t.dashboard.trackingHint}</small></div></div></div>
          {energyMetrics && <div className="energy-dashboard"><article><span>{t.dashboard.bmrLabel}</span><strong>{energyMetrics.bmr} <small>kcal/gün</small></strong><p>{t.dashboard.bmrBody}</p></article><article><span>{t.dashboard.tdeeLabel}</span><strong>{energyMetrics.tdee} <small>kcal/gün</small></strong><p>{t.dashboard.tdeeBody(energyMetrics.activityLabel)}</p></article><div><strong>{t.dashboard.approxTitle}</strong><p>{t.dashboard.approxBody}</p></div></div>}</>}
          </>}
        </section>
      )}
      {pendingSession && <div className="feedback-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><div className="feedback-dialog"><div className="feedback-check">✓</div><div className="eyebrow">{t.feedback.completedEyebrow}</div><h2 id="feedback-title">{t.feedback.titleLine1}<br /><em>{t.feedback.titleEm}</em></h2><p>{t.feedback.body}</p><fieldset><legend>{t.feedback.difficultyLegend}</legend><div className="feedback-options">{(["Kolay", "Uygun", "Zor"] as WorkoutDifficulty[]).map((option) => <button type="button" aria-pressed={feedbackDifficulty === option} className={feedbackDifficulty === option ? "selected" : ""} onClick={() => setFeedbackDifficulty(option)} key={option}>{option === "Kolay" ? t.feedback.difficultyEasy : option === "Uygun" ? t.feedback.difficultySuitable : t.feedback.difficultyHard}</button>)}</div></fieldset><fieldset><legend>{t.feedback.fatigueLegend}</legend><div className="fatigue-scale">{[1, 2, 3, 4, 5].map((value) => <button type="button" aria-pressed={feedbackFatigue === value} className={feedbackFatigue === value ? "selected" : ""} onClick={() => setFeedbackFatigue(value)} key={value}><strong>{value}</strong><small>{value === 1 ? t.feedback.fatigueVeryLow : value === 3 ? t.feedback.fatigueMedium : value === 5 ? t.feedback.fatigueVeryHigh : ""}</small></button>)}</div></fieldset><fieldset><legend>{t.feedback.painLegend}</legend><div className="feedback-options pain-options">{["Yok", "Bel", "Diz", "Omuz", "Diğer"].map((area) => <button type="button" aria-pressed={feedbackPainAreas.includes(area)} className={feedbackPainAreas.includes(area) ? "selected" : ""} onClick={() => toggleFeedbackPain(area)} key={area}>{area === "Yok" ? t.feedback.painNone : area === "Bel" ? t.feedback.painLowerBack : area === "Diz" ? t.feedback.painKnee : area === "Omuz" ? t.feedback.painShoulder : t.feedback.painOther}</button>)}</div></fieldset><label className="feedback-note">{t.feedback.noteLabel} <small>{t.onboarding.optionalHint}</small><textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder={t.feedback.notePlaceholder} /></label><div className="feedback-summary"><span>{t.feedback.nextStepLabel}</span><strong>{feedbackPainAreas.some((area) => area !== "Yok") || feedbackDifficulty === "Zor" || feedbackFatigue >= 4 ? t.feedback.nextStepRecovery : feedbackDifficulty === "Kolay" && feedbackFatigue <= 2 ? t.feedback.nextStepIncrease : t.feedback.nextStepBalanced}</strong></div><button className="primary-btn feedback-save" type="button" onClick={() => void saveWorkoutFeedback()}>{t.feedback.save} <span>→</span></button></div></div>}
      {step === STEP.dashboard && <AiCoachChat context={coachContext} />}
      <footer><span>{t.common.footerTagline}</span><span>© 2026</span></footer>
    </main>
  );
}
