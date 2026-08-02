// Profil testinin soru şeması.
//
// Cevaplar `history` dizisinde SIRAYA göre saklanır ve plan üretimi bu diziden
// okur. Daha önce bu okumalar dosyaların içine dağılmış sihirli sayılardı
// (history[4], history[6] …); soru sırası değişince plan sessizce yanlış alanı
// okuyordu. Artık indeksler burada adlandırılır ve her okuyucu bu adları
// kullanır, böylece soru eklemek/çıkarmak derleme hatasıyla yakalanır.

export const QUESTION = {
  goal: 0,
  motivation: 1,
  barrier: 2,
  experience: 3,
  level: 4,
  recentFrequency: 5,
  availableDays: 6,
  sessionMinutes: 7,
  trainingStyles: 8,
  location: 9,
  equipment: 10,
  injuries: 11,
  dailyMovement: 12,
  sleep: 13,
  freeNote: 14,
} as const;

export const QUESTION_COUNT = Object.keys(QUESTION).length;

/** Serbest metin soruları: seçenek yerine yazı alanı gösterilir. */
export const FREE_TEXT_QUESTIONS: number[] = [QUESTION.motivation, QUESTION.freeNote];

/**
 * Eski 10 soruluk testten kaydedilmiş cevapları yeni 15'lik sıraya taşır.
 *
 * Sıra tamamen değiştiği için taşımadan okumak, kullanıcının hedefini "deneyim"
 * sanmak gibi sessiz ve kötü hatalar üretirdi. Eşleşmesi olmayan yeni sorular
 * boş kalır; kullanıcı testi açtığında onları doldurur.
 */
const LEGACY_TO_CURRENT: Record<number, number> = {
  0: QUESTION.experience,
  1: QUESTION.recentFrequency,
  2: QUESTION.level,
  3: QUESTION.sessionMinutes,
  4: QUESTION.goal,
  5: QUESTION.trainingStyles,
  6: QUESTION.injuries,
  7: QUESTION.dailyMovement,
  8: QUESTION.sleep,
  9: QUESTION.freeNote,
};

const LEGACY_LENGTH = 10;

export function emptyHistory(): string[] {
  return Array(QUESTION_COUNT).fill("");
}

/**
 * Kaydedilmiş cevapları güncel şemaya normalize eder.
 * Eski uzunluktaki kayıtlar taşınır, güncel olanlar boyuta oturtulur.
 */
export function normalizeHistory(saved: unknown): string[] {
  const answers = Array.isArray(saved) ? saved.map((value) => (typeof value === "string" ? value : "")) : [];
  if (!answers.length) return emptyHistory();

  if (answers.length === LEGACY_LENGTH) {
    const migrated = emptyHistory();
    for (const [from, to] of Object.entries(LEGACY_TO_CURRENT)) {
      migrated[to] = answers[Number(from)] ?? "";
    }
    // Eski testte haftalık uygunluk ayrı sorulmuyordu; en yakın bilgi son üç
    // ayki sıklıktır. Boş bırakmak planı varsayılana düşürürdü.
    if (!migrated[QUESTION.availableDays]) migrated[QUESTION.availableDays] = migrated[QUESTION.recentFrequency];
    return migrated;
  }

  return [...answers, ...emptyHistory()].slice(0, QUESTION_COUNT);
}

/**
 * Yapay zekâya gönderilen soru etiketleri.
 *
 * Sözlükteki soru metinleri kullanıcının diline göre değişir; plan istemi ise
 * her kullanıcı için aynı olmalı. Ayrıca çıplak bir cevap dizisi gönderildiğinde
 * model "Diz" cevabının hangi soruya ait olduğunu bilemiyordu — her cevap
 * sorusuyla birlikte gider.
 */
export const QUESTION_LABELS: Record<keyof typeof QUESTION, string> = {
  goal: "Ana hedef",
  motivation: "Hedefin kişisel nedeni",
  barrier: "Geçmişte onu durduran engel",
  experience: "Geçmişte düzenli spor yaptı mı",
  level: "Kendini gördüğü seviye",
  recentFrequency: "Son 3 ayda haftalık antrenman günü",
  availableDays: "Haftada ayırabileceği gün",
  sessionMinutes: "Bir seansa ayırabileceği süre",
  trainingStyles: "İlgi duyduğu antrenman türleri",
  location: "Antrenman yapacağı yer",
  equipment: "Erişebildiği ekipman",
  injuries: "Sakatlık veya ağrı bölgesi",
  dailyMovement: "Gün içi hareket düzeyi",
  sleep: "Uyku ve toparlanma düzeni",
  freeNote: "Serbest not",
};

/** Cevapları soru etiketleriyle eşleştirir; boş cevaplar listeye girmez. */
export function labelledAnswers(history: string[]): { question: string; answer: string }[] {
  return Object.entries(QUESTION)
    .map(([name, index]) => ({ question: QUESTION_LABELS[name as keyof typeof QUESTION], answer: (history[index] || "").trim() }))
    .filter((entry) => entry.answer !== "");
}

/** Testin tamamlanmış sayılması için gereken asgari cevaplar. */
export const REQUIRED_QUESTIONS: number[] = [QUESTION.goal, QUESTION.level, QUESTION.availableDays, QUESTION.sessionMinutes];

export function isHistoryComplete(history: string[]): boolean {
  return REQUIRED_QUESTIONS.every((index) => Boolean(history[index]?.trim()));
}

/**
 * Profil testinin geçerli sürümü. Yağ kaybını kilo vermeden ayıran değişiklik
 * gibi, eski cevapların artık farklı yorumlanması gereken durumlarda bu sayı
 * artırılır — testi tamamlamış kullanıcılar bile bir sonraki açılışta testi
 * yeniden görür. `profiles.profile_test_version` bu sayıya eşit değilse test
 * tamamlanmamış sayılır (bkz. db/migrations/20260803_profile_test_version.sql).
 */
export const CURRENT_PROFILE_TEST_VERSION = 1;
