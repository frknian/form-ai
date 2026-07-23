import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the secure form.ai account entry", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>form\.ai — Sana özel antrenman<\/title>/i);
  assert.match(html, /Güvenli hesabın hazırlanıyor/i);
  assert.doesNotMatch(html, /class="topbar"/);
  assert.doesNotMatch(html, />Antrenmanım</);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("keeps adaptive plan, meal entry and training-place controls dark", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.dark \.adaptive-card,/);
  assert.match(styles, /\.dark \.adaptive-icon \{ background:#303a23/);
  assert.match(styles, /\.dark \.entry-workspace \{ background:var\(--surface-soft\)/);
  assert.match(styles, /\.dark \.entry-workspace select,/);
  assert.match(styles, /\.dark \.choice\.selected \{ background:#303a23/);
  assert.match(styles, /\.dark \.training-place-switch/);
  assert.match(styles, /\.dark \.meal-ai-advice/);
});

test("keeps email verification and Google authentication wired into profile creation", async () => {
  const [page, profileManager, authScreen, callback, mobileRuntime, mobileConfig, androidManifest, iosInfo] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ProfileManager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AuthScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/mobile.ts", import.meta.url), "utf8"),
    readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
    readFile(new URL("../ios/App/App/Info.plist", import.meta.url), "utf8"),
  ]);

  assert.match(page, /onAuthStateChange/);
  assert.match(page, /auth\.signOut/);
  assert.match(profileManager, /DOĞRULANMIŞ HESAP/);
  assert.match(authScreen, /auth\.signUp/);
  assert.match(authScreen, /emailRedirectTo/);
  assert.match(authScreen, /auth\.resend/);
  assert.match(authScreen, /isVerifiedAuthUser/);
  assert.match(authScreen, /signInWithPassword/);
  assert.match(authScreen, /signInWithOAuth/);
  assert.match(authScreen, /provider: "google"/);
  assert.match(authScreen, /E-posta adresin/);
  assert.match(authScreen, /status === "unavailable" &&/);
  assert.doesNotMatch(authScreen, /status === "unavailable" \? <div[^]*?\: <>/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /hasVerifiedSession/);
  assert.match(callback, /E-posta doğrulandı/);
  assert.match(page, /isVerifiedAuthUser/);
  assert.match(page, /MobileRuntime/);
  assert.match(authScreen, /skipBrowserRedirect: native/);
  assert.match(authScreen, /openNativeBrowser/);
  assert.match(mobileRuntime, /com\.fitai\.app:\/\/auth\/callback/);
  assert.match(mobileRuntime, /exchangeCodeForSession/);
  assert.match(mobileRuntime, /LocalNotifications\.schedule/);
  assert.match(mobileRuntime, /Camera\.getPhoto/);
  assert.match(mobileConfig, /appId: "com\.fitai\.app"/);
  assert.doesNotMatch(mobileConfig, /GEMINI_API_KEY|SUPABASE_ANON_KEY/);
  assert.match(androidManifest, /android:scheme="com\.fitai\.app"/);
  assert.match(iosInfo, /<string>com\.fitai\.app<\/string>/);
  assert.match(iosInfo, /NSCameraUsageDescription/);
});

test("keeps the AI plan and movement library wired into the product", async () => {
  const [page, route, weeklyRoute, layout, supabaseSchema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/generate-plan/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/weekly-review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/supabase-schema.sql", import.meta.url), "utf8"),
  ]);

  assert.match(page, /HAZIR PROGRAMLAR/i);
  assert.match(page, /AI verileri taradı/);
  assert.match(page, /nasıl yapılır/i);
  assert.match(page, /Yerde Dambıl Göğüs Presi/);
  assert.ok((page.match(/^  \["/gm) ?? []).length >= 100, "exercise library should contain 100+ additional movements");
  assert.match(page, /toggleInjury/);
  assert.match(page, /personalizeAiWorkouts/);
  assert.match(page, /isExerciseSafeForProfile/);
  assert.match(page, /exerciseCatalog/);
  assert.match(page, /getExercisesForAI/);
  assert.match(page, /getExerciseById/);
  assert.match(page, /ExerciseLibrary/);
  assert.match(page, /ExerciseAnimation/);
  assert.match(page, /floor-press/);
  assert.match(page, /trustedExerciseMedia/);
  assert.doesNotMatch(page, /MotionFigureAnimation/);
  assert.match(page, /"leg-machine"/);
  assert.match(page, /return "curl"/);
  assert.match(page, /return "triceps"/);
  assert.match(page, /return "raise"/);
  assert.match(page, /return "fly"/);
  assert.match(page, /NEFES/);
  assert.match(page, /SIK HATA/);
  assert.match(page, /Dinlenmeyi atla/);
  assert.match(page, /Antrenmanı bitir ve kaydet/);
  assert.match(page, /workout_sessions/);
  assert.match(page, /WorkoutSetLogger/);
  assert.match(page, /PlanEditor/);
  assert.match(page, /workout_plans/);
  assert.match(page, /workout_exercise_logs/);
  assert.match(page, /workout_set_logs/);
  assert.match(page, /BodyMeasurements/);
  assert.match(page, /WorkoutCalendar/);
  assert.match(page, /WeeklyAiReview/);
  assert.match(page, /CalorieTracker/);
  assert.match(page, /inferWorkoutDays/);
  assert.match(page, /activeView === "calendar"/);
  assert.match(page, /istanbulDateKey/);
  assert.match(page, /ZAMANLA UYARLANAN PROGRAM/);
  assert.match(page, /Kaydet ve programımı uyarla/);
  assert.match(page, /summarizeTrainingAdaptation/);
  assert.match(page, /trainingHistory/);
  assert.match(page, /calculateEnergyMetrics/);
  assert.match(page, /workoutMet/);
  assert.match(page, /AI KİŞİSELLEŞTİRME RAPORU/);
  assert.match(page, /AYLIK RAPOR/);
  assert.match(page, /BAZAL ENERJİ/);
  assert.match(page, /GÜNLÜK TOPLAM/);
  assert.match(page, /setAiWorkouts\(\[\]\)/);
  assert.match(route, /gemini-3\.5-flash/);
  assert.match(route, /gemini-3\.1-flash-lite/);
  assert.match(route, /KULLANICI VERİLERİ/);
  assert.match(route, /HAM KULLANICI VERİLERİ/);
  assert.match(route, /10 TEST CEVABININ ANALİZİ/);
  assert.match(route, /weeklySchedule/);
  assert.match(route, /progression/);
  assert.match(route, /profileFingerprint/);
  assert.match(route, /UYGULAMADA KULLANILABİLEN HAREKET KATALOĞU/);
  assert.match(route, /photoDataUrl/);
  assert.match(route, /katalogdaki id ve name alanlarını birebir kullan/);
  assert.match(route, /ÖNCEKİ ANTRENMANLAR VE KULLANICI GERİ BİLDİRİMLERİ/);
  assert.match(weeklyRoute, /Output\.object/);
  assert.match(weeklyRoute, /jsonSchema<WeeklyReview>/);
  assert.match(weeklyRoute, /validateWeeklySummary/);
  assert.match(weeklyRoute, /enforceWeeklySafety/);
  assert.match(weeklyRoute, /JSON\.stringify\(safeSummary\)/);
  assert.doesNotMatch(weeklyRoute, /payload\.(email|name|userId)/);
  assert.match(layout, /form\.ai — Sana özel antrenman/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /x-forwarded-host/);
  assert.doesNotMatch(page, /gymvisual|iframe/i);
  assert.doesNotMatch(page, /knowledge-sources|fitnessSources/);
  assert.doesNotMatch(route, /knowledge-sources|fitnessSources/);
  assert.match(supabaseSchema, /create table if not exists public\.workout_sessions/i);
  assert.match(supabaseSchema, /create table if not exists public\.workout_plans/i);
  assert.match(supabaseSchema, /Users can update own workout plans/i);
  assert.match(supabaseSchema, /create table if not exists public\.workout_exercise_logs/i);
  assert.match(supabaseSchema, /create table if not exists public\.workout_set_logs/i);
  assert.match(supabaseSchema, /create table if not exists public\.body_measurements/i);
  assert.match(supabaseSchema, /create table if not exists public\.workout_schedule/i);
  assert.match(supabaseSchema, /create table if not exists public\.reminder_preferences/i);
  assert.match(supabaseSchema, /create table if not exists public\.weekly_ai_reviews/i);
  assert.match(supabaseSchema, /create table if not exists public\.nutrition_goals/i);
  assert.match(supabaseSchema, /create table if not exists public\.user_streaks/i);
  assert.match(supabaseSchema, /create table if not exists public\.activity_logs/i);
  assert.match(page, /ActivityStreak/);
  assert.match(page, /ActivityLogger/);
  assert.match(page, /activeView === "profile"/);
  assert.match(page, /autoplay=\{false\}/);
  assert.match(supabaseSchema, /Users can read own nutrition goals/i);
  assert.match(supabaseSchema, /Users can update own nutrition goals/i);
  assert.match(supabaseSchema, /Users can read own weekly AI reviews/i);
  assert.match(supabaseSchema, /Users can read own workout schedule/i);
  assert.match(supabaseSchema, /Users can update own reminder preferences/i);
  assert.match(supabaseSchema, /Users can read own body measurements/i);
  assert.match(supabaseSchema, /Users can update own body measurements/i);
  assert.match(supabaseSchema, /Users can delete own body measurements/i);
  assert.match(supabaseSchema, /Users can read own workout exercise logs/i);
  assert.match(supabaseSchema, /Users can insert own workout set logs/i);
  assert.match(supabaseSchema, /rpe smallint check \(rpe between 1 and 10\)/i);
  assert.match(supabaseSchema, /Users can read own workout sessions/i);
  assert.match(supabaseSchema, /difficulty text/i);
  assert.match(supabaseSchema, /pain_areas jsonb/i);
});
