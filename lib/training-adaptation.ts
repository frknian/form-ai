export type WorkoutDifficulty = "Kolay" | "Uygun" | "Zor";

export type AdaptiveSession = {
  completedExercises: number;
  totalExercises: number;
  difficulty?: WorkoutDifficulty;
  fatigue?: number;
  painAreas?: string[];
};

export type TrainingAdaptation = {
  direction: "increase" | "maintain" | "deload";
  title: string;
  summary: string;
  reasons: string[];
  setDelta: number;
  repDelta: number;
  restDelta: number;
  painAreas: string[];
};

const neutral: TrainingAdaptation = {
  direction: "maintain",
  title: "Başlangıç planı",
  summary: "İlk antrenman geri bildiriminden sonra set, tekrar ve dinlenme süresi otomatik uyarlanacak.",
  reasons: ["Henüz yeterli antrenman geri bildirimi yok."],
  setDelta: 0,
  repDelta: 0,
  restDelta: 0,
  painAreas: [],
};

export function summarizeTrainingAdaptation(sessions: AdaptiveSession[]): TrainingAdaptation {
  const recent = sessions.filter((session) => session.difficulty || session.fatigue || session.painAreas?.length).slice(0, 3);
  if (!recent.length) return neutral;

  const completion = recent.reduce((total, session) => total + session.completedExercises / Math.max(1, session.totalExercises), 0) / recent.length;
  const fatigueValues = recent.map((session) => session.fatigue).filter((value): value is number => typeof value === "number");
  const averageFatigue = fatigueValues.length ? fatigueValues.reduce((total, value) => total + value, 0) / fatigueValues.length : 3;
  const hardCount = recent.filter((session) => session.difficulty === "Zor").length;
  const easyCount = recent.filter((session) => session.difficulty === "Kolay").length;
  const painAreas = [...new Set(recent.flatMap((session) => session.painAreas || []).filter((area) => area && area !== "Yok"))];

  if (painAreas.length || averageFatigue >= 4 || hardCount >= 2 || completion < 0.65) {
    const reasons = [];
    if (painAreas.length) reasons.push(`${painAreas.join(" ve ")} bölgesindeki ağrı bildirimi dikkate alındı.`);
    if (averageFatigue >= 4) reasons.push(`Son geri bildirimlerde ortalama yorgunluk ${averageFatigue.toFixed(1)}/5.`);
    if (hardCount >= 2) reasons.push("Son antrenmanların çoğu zor olarak işaretlendi.");
    if (completion < 0.65) reasons.push(`Hareketlerin yaklaşık %${Math.round(completion * 100)} kadarı tamamlandı.`);
    return {
      direction: "deload",
      title: "Toparlanma önceliği",
      summary: "Bir sonraki planın yükü azaltıldı; dinlenme uzatıldı ve ağrı bildirilen bölgeler korunuyor.",
      reasons,
      setDelta: -1,
      repDelta: -2,
      restDelta: 20,
      painAreas,
    };
  }

  if (recent.length >= 2 && easyCount >= 2 && averageFatigue <= 2.5 && completion >= 0.9) {
    return {
      direction: "increase",
      title: "Kontrollü ilerleme",
      summary: "Son antrenmanlar rahat ve yüksek tamamlama oranıyla bittiği için yük küçük bir adımla artırıldı.",
      reasons: [
        `Son ${recent.length} kayıtta tamamlama oranı %${Math.round(completion * 100)}.`,
        `Ortalama yorgunluk ${averageFatigue.toFixed(1)}/5 ve en az iki antrenman kolay işaretlendi.`,
      ],
      setDelta: 1,
      repDelta: 2,
      restDelta: -10,
      painAreas: [],
    };
  }

  return {
    direction: "maintain",
    title: "Yük dengede",
    summary: "Mevcut yük korunuyor; yeni geri bildirimler geldikçe bir sonraki küçük değişim belirlenecek.",
    reasons: [`Son kayıtlarda tamamlama oranı %${Math.round(completion * 100)}, ortalama yorgunluk ${averageFatigue.toFixed(1)}/5.`],
    setDelta: 0,
    repDelta: 0,
    restDelta: 0,
    painAreas: [],
  };
}

export function adaptPrescription(sets: number, reps: number, restSeconds: number, adaptation: TrainingAdaptation) {
  return {
    sets: Math.min(5, Math.max(1, sets + adaptation.setDelta)),
    reps: Math.min(20, Math.max(4, reps + adaptation.repDelta)),
    restSeconds: Math.min(180, Math.max(30, restSeconds + adaptation.restDelta)),
  };
}
