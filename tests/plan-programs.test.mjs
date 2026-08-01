import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { extractWeeklyDays } from "../lib/training-profile.ts";
import { EQUIPMENT_PROFILES, buildReadyProgram } from "../lib/ready-programs.ts";

const appSource = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");

// Hazır programlar artık katalogdan üretiliyor, sabit liste değil. Bu yüzden
// kaynağı regex'lemek yerine gerçek katalogla üretimi çalıştırıyoruz — böylece
// test, kataloğa hareket eklendiğinde de anlamını koruyor.
function parseCatalog() {
  const block = (name) => {
    const start = appSource.indexOf(`const ${name}`);
    return appSource.slice(start, appSource.indexOf("\n];", start));
  };
  const core = [...block("coreExerciseLibrary").matchAll(
    /name: "([^"]+)"[^}]*?area: "([^"]+)"[^}]*?requires: \[([^\]]*)\], bodyweight: (true|false)/g,
  )];
  const extra = [...block("additionalExerciseDefinitions").matchAll(
    /^\s*\["([^"]+)", "[^"]+", "([^"]+)", "[^"]+", \[([^\]]*)\], (true|false)/gm,
  )];
  return [...core, ...extra].map((match) => ({
    name: match[1],
    area: match[2],
    requires: [...match[3].matchAll(/"([^"]+)"/g)].map((r) => r[1]),
    bodyweight: match[4] === "true",
  }));
}

const catalog = parseCatalog();

test("katalog testin okuyabileceği biçimde ayrıştırılabiliyor", () => {
  // Bu bozulursa aşağıdaki testler sessizce boş listeyle geçer hâle gelirdi.
  assert.ok(catalog.length > 100, `beklenenden az hareket: ${catalog.length}`);
  assert.ok(catalog.some((exercise) => exercise.bodyweight));
  assert.ok(catalog.some((exercise) => exercise.requires.includes("dambıl")));
});

test("her ekipman profili tam 5 benzersiz hareket üretir", () => {
  for (const profile of EQUIPMENT_PROFILES) {
    const names = buildReadyProgram(catalog, profile).map((exercise) => exercise.name);
    assert.equal(names.length, 5, `${profile}: 5 bekleniyor, gelen ${names.length}`);
    assert.equal(new Set(names).size, 5, `${profile}: aynı hareket iki kez`);
  }
});

test("ekipmansız program hiçbir ekipmanlı hareket içermez", () => {
  // Bildirilen hata: ekipmansız programda dambıl çıkıyordu.
  for (const exercise of buildReadyProgram(catalog, "equipmentFree")) {
    assert.equal(exercise.bodyweight, true, `ekipmanlı hareket sızdı: ${exercise.name}`);
  }
});

test("ekipmanlı profiller kendi ekipmanıyla yapılabilir hareketler verir", () => {
  // requires bir VEYA listesidir: ["dambıl","makine","salon"] olan bir hareket
  // dambılla da yapılabilir, o yüzden "salon" kelimesinin geçmesi kusur değil.
  // Aranan şey, ekipmansız olmayan her hareketin O profille yapılabilir olması.
  const doableWith = (exercise, tokens) => exercise.requires.some((r) => tokens.some((token) => r.includes(token)));

  const dumbbell = buildReadyProgram(catalog, "dumbbell");
  assert.ok(dumbbell.some((exercise) => !exercise.bodyweight), "hiç dambıl hareketi yok");
  for (const exercise of dumbbell.filter((e) => !e.bodyweight)) {
    assert.ok(doableWith(exercise, ["dambıl", "kettlebell"]), `dambılla yapılamaz: ${exercise.name}`);
  }

  for (const exercise of buildReadyProgram(catalog, "band").filter((e) => !e.bodyweight)) {
    assert.ok(doableWith(exercise, ["band", "lastik"]), `bantla yapılamaz: ${exercise.name}`);
  }
});

test("kişisel plan hazır program hareketlerini son sıraya iter", () => {
  // Aksi halde "hemen başla" şablonu ile kişisel plan neredeyse aynı listeyi gösterir.
  assert.match(appSource, /const READY_PROGRAM_NAMES = new Set\(readyPrograms\.flatMap/);
  assert.match(appSource, /READY_PROGRAM_NAMES\.has\(item\.name\) \? 3 : 2/);
});

test("antrenman ekranı hazır programları en üstte, hareket listesi olarak gösterir", () => {
  // Eski tab tabanlı widget "Kullan" deyip kişisel planı değiştiriyordu;
  // yeni ekran 3 kart + bölgesel tarama ile "hareket listesi"ne geçiş yapar.
  assert.doesNotMatch(appSource, /function ReadyPrograms\(/, "eski widget kaldırılmalı");
  assert.doesNotMatch(appSource, /function applyReadyProgram\(/, "eski 'Kullan' akışı kaldırılmalı");
  assert.match(appSource, /activeView === "workout" \? <>\s*<div className="ready-programs" id="ready-programs">/, "hazır programlar workout sekmesinin en üstünde olmalı");
  assert.match(appSource, /setBrowseProgram\(\{ title: t\.workoutBrowse\.aiCardTitle, profile: autoEquipmentProfile \}\)/);
  assert.match(appSource, /setBrowseProgram\(\{ title: t\.readyPrograms\.gymTitle, profile: "gym" \}\)/);
  assert.match(appSource, /setBrowseProgram\(\{ title: t\.readyPrograms\.equipmentFreeTitle, profile: "equipmentFree" \}\)/);
});

test("bölgesel çalış kataloğun gerçek bölgelerini kullanır ve ekipman filtresi uygular", () => {
  assert.match(appSource, /const BODY_REGIONS = \["Göğüs", "Sırt", "Bacak", "Kalça", "Omuz", "Kol", "Core"\] as const;/);
  assert.match(appSource, /matchesProfile\(item, browseProgram\.profile\)/, "bölgesel liste de ekipmana göre filtrelenmeli");
});

test("hareket detayından çıkmak seçilen programın listesine döner, başa değil", () => {
  // setBrowseDetail(null) yalnız modali kapatmalı; browseProgram'a dokunmamalı,
  // aksi halde kullanıcı program seçim ekranına geri fırlatılırdı.
  assert.doesNotMatch(appSource, /onClick=\{\(\) => setBrowseDetail\(null\)\}[^}]*setBrowseProgram\(null\)/);
  assert.match(appSource, /onClick=\{\(\) => setBrowseDetail\(null\)\}/);
});

test("plan hareket sayısı süreye ve haftalık sıklığa göre değişir", () => {
  // İndeksler artık lib/onboarding-questions.ts'te adlandırılır; sihirli sayı
  // kullanmak soru sırası değişince sessizce yanlış alanı okutuyordu.
  assert.match(appSource, /extractWeeklyDays\(history\[QUESTION\.availableDays\]/);
  assert.match(appSource, /weeklyDays >= 5 \? -1 : weeklyDays <= 2 \? 1 : 0/);
});

test("hareket seçimi sabittir, değişen yüktür", () => {
  // Plan bir dönem her gün döndürülüyordu; aynı hareketteki ilerlemeyi izlemek
  // imkânsızlaştığı için "stabil değil" hissi veriyordu. Seçim profile göre
  // sabit kalmalı, zamanla yalnız set/tekrar/dinlenme ilerlemeli.
  assert.doesNotMatch(appSource, /dayIndex/);
  assert.doesNotMatch(appSource, /planDayIndex/);
  assert.match(appSource, /const score = \(name: string\) => \[\.\.\.name\][^\n]*seed\) % 997/);
  assert.match(appSource, /planProgressionBlock\(completedSessions\)/);
});

test("haftalık sıklık cevabı gün sayısına çevrilir", () => {
  assert.equal(extractWeeklyDays("5+ gün"), 5);
  assert.equal(extractWeeklyDays("3–4 gün"), 3);
  assert.equal(extractWeeklyDays("3-4 gün"), 3);
  assert.equal(extractWeeklyDays("0 gün"), 2);
  assert.equal(extractWeeklyDays("1–2 gün"), 2);
  assert.equal(extractWeeklyDays(undefined), 2);
});

test("hareket kütüphanesi kartı harekete girilmeden animasyon oynatmaz", async () => {
  const card = await readFile(new URL("../components/exercises/ExerciseCard.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/exercises/ExerciseDetail.tsx", import.meta.url), "utf8");
  assert.match(card, /<ExerciseAnimation[^/]*autoplay=\{false\}/);
  // Detayda ise oynamalı; orada autoplay kapatılmamış olmalı.
  assert.doesNotMatch(detail, /<ExerciseAnimation[^/]*autoplay=\{false\}/);
});

test("profil testinde tüm seçenekli sorular çoklu seçimdir", () => {
  // Tek seçim, otomatik ilerleme ve sakatlığa özel dal kaldırıldı.
  assert.match(appSource, /function toggleAnswer\(answer: string\)/);
  assert.doesNotMatch(appSource, /function setAnswer\(/);
  assert.doesNotMatch(appSource, /toggleInjury/);
  // Seçili durum birleşik değerden okunmalı, tam eşitlikle değil.
  assert.match(appSource, /\(history\[questionIndex\] \|\| ""\)\.split\(" · "\)\.includes\(answer\)/);
  // "Yok" gibi dışlayıcı cevaplar diğerleriyle birlikte işaretlenemez.
  assert.match(appSource, /EXCLUSIVE_ANSWERS = new Set\(\["Yok", "Hayır", "0 gün"\]\)/);
});

test("birleşik cevaplar aşağı akışta tam eşitlikle okunmaz", () => {
  // "Yeni başlıyorum · Orta seviye" gibi değerler tam eşitliği kaçırırdı.
  assert.doesNotMatch(appSource, /history\[\d+\] === "Yeni başlıyorum"/);
  assert.match(appSource, /history\[QUESTION\.level\]\.includes\("Yeni başlıyorum"\)/);
  // Hiçbir yerde çıplak sayısal indeks kalmamalı.
  assert.doesNotMatch(appSource, /history\[\d+\]/);
});

test("profil testi soruları telefon genişliğine uyarlanmıştır", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  // Sabit 650px, 375px ekranda yatay taşma yapıyordu.
  assert.doesNotMatch(css, /\.history-step \{ width:650px; \}/);
  assert.match(css, /\.history-step \{ width:100%; max-width:650px; \}/);
  assert.match(css, /@media \(max-width:600px\)[^]*?\.answer-grid \{ display:grid/);
});

test("kalori halkasındaki metin diskin ortasında toplanır", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  // place-items yalnız satır içinde ortalar; align-content olmadan satır izleri
  // gerilip metni diskin kenarlarına, yani halkanın yayına yapıştırıyordu.
  assert.match(css, /\.calorie-progress > div \{ display:grid; place-items:center; align-content:center;/);
  // İç disk kart arka planıyla (#22221f) aynı renkte olmamalı, yoksa görünmez.
  assert.doesNotMatch(css, /\.calorie-progress > div \{[^}]*background:#22221f/);
});

test("hazır programlar tek başlık altında toplanır, AI programı full body'dir", async () => {
  // "İstersen hemen başla" + "Full body · seviye" + "AI Programı" üç ayrı
  // program varmış izlenimi veriyordu; hepsi aynı listeyi anlatıyor.
  assert.doesNotMatch(appSource, /t\.readyPrograms\.title/, "kaldırılan başlık hâlâ kullanılıyor");
  assert.doesNotMatch(appSource, /t\.dashboard\.fullBody/, "antrenman listesinde full body başlığı kalmış");
  assert.match(appSource, /t\.dashboard\.myWorkout\(planLevel\)/);

  const tr = await readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8");
  // Full body bilgisi artık AI kartının açıklamasında duruyor.
  assert.match(tr, /aiCardDetail: \(equipment: string\) => `Full body/);
});

test("bölgesel çalışta yer ayrıca seçilir ve hareketleri belirler", () => {
  // Profilde "Evde" yazan biri bugün salona gitmiş olabilir; seçim yalnız
  // bu taramayı etkiler, profili değiştirmez.
  assert.match(appSource, /const \[regionPlace, setRegionPlace\] = useState<"home" \| "gym">\("home"\)/);
  assert.match(appSource, /regionPlace === "gym" \? "gym" : detectUserEquipmentProfile\(false, equipmentText\)/);
  assert.match(appSource, /setBrowseProgram\(\{ title: regionLabel\(t, area\), profile: regionProfile, area \}\)/);
  assert.doesNotMatch(appSource, /profile: autoEquipmentProfile, area/, "bölge taraması hâlâ profildeki yeri kullanıyor");
});

test("beslenme ekranında öğün ekleme hedef panelinin önünde gelir", async () => {
  const tracker = await readFile(new URL("../components/CalorieTracker.tsx", import.meta.url), "utf8");
  const entryPanel = tracker.indexOf('className="food-entry-panel"');
  const goalsPanel = tracker.indexOf("<NutritionGoalsPanel");
  assert.ok(entryPanel > 0 && goalsPanel > 0, "iki bölüm de bulunmalı");
  assert.ok(entryPanel < goalsPanel, "günlük iş olan öğün ekleme, ayar niteliğindeki hedef panelinin üstünde olmalı");
});

test("ilerleme ekranı bel/göğüs/bacak ölçülerini adıyla duyurur", async () => {
  // Bölüm zaten bu alanları kaydediyordu ama başlığı hangi ölçüler olduğunu
  // söylemediği için bulunamıyordu.
  const app = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
  assert.match(app, /<BodyMeasurements userId=\{userId\}/, "ölçümler ilerleme ekranında olmalı");
  const tr = await readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8");
  const block = tr.slice(tr.indexOf('eyebrow: "VÜCUT ÖLÇÜMLERİ"'), tr.indexOf('addFirst:'));
  for (const area of ["bel", "göğüs", "bacak"]) {
    assert.ok(block.toLocaleLowerCase("tr-TR").includes(area), `ölçüm metni "${area}" bölgesinden söz etmiyor`);
  }
});

test("profil testinde panele ait ağır hesaplar çalışmaz", () => {
  // Bildirilen hata: sorularda yazarken ve şık seçerken uygulama kasıyordu.
  // Sebep, panele ait dört useMemo'nun bağımlılığında `history` olmasıydı:
  // her tuş vuruşu 170 hareketlik katalogda ekipman eşleşmesi (regex), plan
  // üretimi ve JSON.stringify tetikliyordu. Hepsi onDashboard ile kapatıldı.
  assert.match(appSource, /const onDashboard = step === STEP\.dashboard;/);
  for (const memo of ["localPlan", "workouts", "planExerciseOptions"]) {
    const block = appSource.match(new RegExp(`const ${memo} = useMemo\\(([^]*?)\\n  \\);`))?.[1] ?? "";
    assert.ok(block.length > 0, `${memo} memo'su bulunamadı`);
    // Kapı iki biçimde yazılabiliyor: tek satırda "onDashboard ? …" ya da
    // koşulun satır sonunda kaldığı çok satırlı ternary.
    assert.match(block, /onDashboard\s*(\?|\n\s*\?)/, `${memo} panel dışında da hesaplanıyor`);
    assert.match(block, /\[onDashboard,/, `${memo} bağımlılık listesinde onDashboard yok`);
  }
  assert.match(appSource, /const coachContext = useMemo\(\(\) => !onDashboard \? "" :/);
});

test("onboarding adımları adlandırılmıştır ve panel sonuncudur", () => {
  // Araya "kişiselleştiriliyor" ve "rapor" ekranları girdi; çıplak sayı
  // karşılaştırmaları (step === 5) sessizce yanlış ekranı gösterirdi.
  assert.match(appSource, /const STEP = \{ profile: 1, place: 2, photo: 3, test: 4, building: 5, report: 6, dashboard: 7 \} as const;/);
  assert.doesNotMatch(appSource, /step === 5|step < 5|setStep\(5\)/, "çıplak adım numarası kalmış");
});

test("son sorudan sonra kişiselleştirme ve rapor ekranı gelir", () => {
  // Eskiden son soruda beklenip doğrudan panele atlanıyordu.
  assert.match(appSource, /setStep\(STEP\.building\)/, "kişiselleştirme ekranına geçilmiyor");
  assert.match(appSource, /setStep\(STEP\.report\)/, "rapor ekranına geçilmiyor");
  assert.match(appSource, /step === STEP\.building &&/);
  assert.match(appSource, /step === STEP\.report && planReport &&/);
  // Rapor panele ancak kullanıcı düğmeye basınca geçmeli.
  assert.match(appSource, /onClick=\{\(\) => setStep\(STEP\.dashboard\)\}/);
});

test("hedef kilo profil testinden önce sorulur ve plana yazılır", () => {
  assert.match(appSource, /targetWeight=\{shownTargetWeight\} onTargetWeightChange=\{setTargetWeightDraft\}/);
  // Haftalık gün ve süre teste zaten soruldu; ikinci kez sorulmaz.
  assert.match(appSource, /setStoredGoalPlan\(\{[^]*?weeklyDays: extractWeeklyDays\(history\[QUESTION\.availableDays\]/);
});

test("soru sayacı sorunun üstünde ve şıklar eşit boyutta", async () => {
  assert.match(appSource, /<div className="question-counter"><b>\{questionIndex \+ 1\}<\/b><span>\/\{QUESTION_COUNT\}<\/span><\/div>/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const grid = css.match(/\.answer-grid \{ display:grid; grid-template-columns:repeat\(auto-fit,minmax\(150px,1fr\)\); ([^}]*)\}/)?.[1] ?? "";
  assert.ok(grid.length > 0, "şıklar eşit sütunlu grid'e alınmamış");
  assert.match(css, /\.answer-grid \.answer \{[^}]*min-height:56px/, "şıkların yüksekliği eşitlenmemiş");
});
