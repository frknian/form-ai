// Onboarding 2. adımdaki hızlı hedef kartları.
//
// Hedef daha önce yalnız boş bir metin kutusuydu; kullanıcıların çoğu boş
// bırakıyor ya da plan üretiminin okuyamadığı bir cümle yazıyordu. Kartlar
// tek dokunuşla kanonik bir cümle yazar, kullanıcı isterse üstüne ekler.
//
// DİKKAT: `text` alanları veritabanına yazılan ve plan üretiminin okuduğu
// KANONİK Türkçe değerlerdir. Arayüz dili ne olursa olsun bunlar değişmez;
// yalnız kartın etiketi çevrilir (lib/i18n .goalPresets). Metinlerdeki
// "kilo / yağ / kas / kondisyon" kelimeleri app/api/generate-plan'daki
// primaryGoal eşleşmesini besler — değiştirirken testlere bak.

import type { OnboardingIconName } from "@/components/onboarding/OnboardingIcon";

export type GoalPresetId = "lose" | "fat" | "muscle" | "strength" | "condition" | "health";

export type GoalPreset = { id: GoalPresetId; icon: OnboardingIconName; text: string };

export const GOAL_PRESETS: GoalPreset[] = [
  { id: "lose", icon: "weightLoss", text: "Kilo vermek ve daha hafif hissetmek istiyorum." },
  { id: "fat", icon: "fatBurn", text: "Yağ oranımı düşürüp daha tanımlı görünmek istiyorum." },
  { id: "muscle", icon: "muscle", text: "Kas kütlemi artırmak istiyorum." },
  { id: "strength", icon: "strength", text: "Daha güçlü olmak ve kaldırdığım ağırlığı artırmak istiyorum." },
  { id: "condition", icon: "condition", text: "Kondisyonumu artırıp daha çabuk yorulmamak istiyorum." },
  { id: "health", icon: "health", text: "Sağlıklı kalmak ve düzenli hareket etmek istiyorum." },
];

/**
 * Kullanıcının yazdığı metne karşılık gelen kart (varsa).
 *
 * Kart seçildikten sonra metin kutusuna ekleme yapılırsa seçim düşer; bu
 * bilinçli: artık gösterilen cümle kartın cümlesi değildir.
 */
export function matchGoalPreset(goalText: string): GoalPresetId | null {
  const normalized = goalText.trim();
  return GOAL_PRESETS.find((preset) => preset.text === normalized)?.id ?? null;
}
