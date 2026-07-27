import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function dispatch(request) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    request,
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function render() {
  return dispatch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
}

test("rejects unknown Supabase projects before loading the app router", async () => {
  const response = await dispatch(new Request("http://localhost/api/supabase-proxy/auth/v1/settings"));
  assert.equal(response.status, 403);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Unknown Supabase project." });
});

test("buffers Supabase proxy bodies for Safari and Cloudflare compatibility", async () => {
  const [browserClient, workerProxy] = await Promise.all([
    readFile(new URL("../lib/supabase/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/supabase-proxy.ts", import.meta.url), "utf8"),
  ]);

  assert.match(browserClient, /await source\.arrayBuffer\(\)/);
  assert.match(workerProxy, /await request\.arrayBuffer\(\)/);
  assert.doesNotMatch(workerProxy, /body:\s*request\.body/);
});

test("server-renders the secure form.ai account entry", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");

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
    readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8"),
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
  assert.match(profileManager, /t\.profileManager\.verifiedAccount/);
  assert.match(authScreen, /auth\.signUp/);
  assert.match(authScreen, /verifyOtp/);
  assert.match(authScreen, /type: "signup"/);
  assert.match(authScreen, /auth\.resend/);
  assert.match(authScreen, /isVerifiedAuthUser/);
  assert.match(authScreen, /signInWithPassword/);
  assert.match(authScreen, /signInWithOAuth/);
  assert.match(authScreen, /provider: "google"/);
  assert.match(authScreen, /t\.auth\.emailLabel/);
  assert.match(authScreen, /status === "unavailable" &&/);
  assert.doesNotMatch(authScreen, /status === "unavailable" \? <div[^]*?\: <>/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /hasVerifiedSession/);
  assert.match(callback, /E-posta doğrulandı/);
  assert.match(page, /isVerifiedAuthUser/);
  assert.match(page, /MobileRuntime/);
  assert.match(authScreen, /skipBrowserRedirect: native/);
  assert.match(authScreen, /openNativeBrowser/);
  const supabaseClient = await readFile(new URL("../lib/supabase/client.ts", import.meta.url), "utf8");
  assert.match(supabaseClient, /resilientSupabaseFetch/);
  assert.match(supabaseClient, /isUnexpectedAuthResponse/);
  assert.match(supabaseClient, /firstProxySource/);
  assert.match(supabaseClient, /retryProxySource/);
  assert.match(mobileRuntime, /com\.fitai\.app:\/\/auth\/callback/);
  assert.match(mobileRuntime, /exchangeCodeForSession/);
  assert.match(mobileRuntime, /LocalNotifications\.schedule/);
  assert.match(mobileRuntime, /Camera\.getPhoto/);
  assert.match(mobileConfig, /appId: "com\.fitai\.app"/);
  assert.doesNotMatch(mobileConfig, /AI_API_KEY|SUPABASE_ANON_KEY/);
  assert.match(androidManifest, /android:scheme="com\.fitai\.app"/);
  assert.match(iosInfo, /<string>com\.fitai\.app<\/string>/);
  assert.match(iosInfo, /NSCameraUsageDescription/);
});

test("keeps the AI plan and movement library wired into the product", async () => {
  const [page, route, weeklyRoute, layout, supabaseSchema] = await Promise.all([
    readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/generate-plan/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/weekly-review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/supabase-schema.sql", import.meta.url), "utf8"),
  ]);

  assert.match(page, /t\.readyPrograms\.eyebrow/);
  assert.match(page, /t\.aiScan\.completeTitle/);
  assert.match(page, /t\.dashboard\.howTo/);
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
  assert.match(page, /t\.workoutPlayer\.breatheLabel/);
  assert.match(page, /t\.workoutPlayer\.mistakeLabel/);
  assert.match(page, /t\.workoutPlayer\.skipRest/);
  assert.match(page, /t\.workoutPlayer\.finishAndSave/);
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
  assert.match(page, /localDateKey/);
  assert.match(page, /t\.insights\.adaptiveEyebrow/);
  assert.match(page, /t\.feedback\.save/);
  assert.match(page, /summarizeTrainingAdaptation/);
  assert.match(page, /trainingHistory/);
  assert.match(page, /calculateEnergyMetrics/);
  assert.match(page, /workoutMet/);
  assert.match(page, /t\.insights\.eyebrow/);
  assert.match(page, /t\.progress\.monthlyReportEyebrow/);
  assert.match(page, /t\.progress\.bmrRef/);
  assert.match(page, /t\.progress\.tdeeRef/);
  assert.match(page, /setAiWorkouts\(\[\]\)/);
  assert.match(route, /generateAiObject/);
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
  assert.match(weeklyRoute, /generateAiObject/);
  assert.match(weeklyRoute, /jsonSchema<WeeklyReview>/);
  assert.match(weeklyRoute, /validateWeeklySummary/);
  assert.match(weeklyRoute, /enforceWeeklySafety/);
  assert.match(weeklyRoute, /JSON\.stringify\(safeSummary\)/);
  assert.doesNotMatch(weeklyRoute, /payload\.(email|name|userId)/);
  assert.match(layout, /form\.ai — Sana özel antrenman/);
  assert.match(layout, /export const metadata/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /form-ai\.frknian\.workers\.dev/);
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

test("Android manifesti kamera, galeri ve bildirim izinlerini tanımlar", async () => {
  const manifest = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
  // Bu izinler olmadan barkod tarayıcının getUserMedia çağrısı ve targetSdk 33+
  // üzerinde antrenman hatırlatmaları sessizce çalışmaz.
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android\.permission\.READ_MEDIA_IMAGES/);
  // Kamerası olmayan cihazlarda kurulum engellenmemeli.
  assert.match(manifest, /uses-feature[^>]*android\.hardware\.camera[^>]*required="false"/);
});

test("veritabanı kurulum sırası belgelenmiştir", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/supabase-schema.sql", import.meta.url), "utf8");
  // profile_history yalnızca migration'da tanımlı; yalnız temel şemayı çalıştıran
  // biri eksik veritabanı elde eder, bu yüzden sıra README'de yazmalı.
  assert.doesNotMatch(schema, /create table if not exists public\.profile_history/);
  assert.match(readme, /## Veritabanı kurulumu/);
  assert.match(readme, /db\/migrations/);
});
