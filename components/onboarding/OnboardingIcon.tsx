// Onboarding kartlarının çizgi ikonları.
//
// Emoji yerine SVG: emoji her platformda başka görünür (Android'de dolgulu ve
// renkli, macOS'ta bambaşka) ve uygulamanın renk paletini bozar. Bu ikonlar
// `currentColor` kullanır, böylece açık/koyu temada kartın metniyle aynı
// rengi alır ve palete hiç dokunmadan çalışır.

export type OnboardingIconName =
  | "female" | "male" | "neutral"
  | "weightLoss" | "fatBurn" | "muscle" | "strength" | "condition" | "health"
  | "height" | "weight";

const PATHS: Record<OnboardingIconName, string> = {
  // Cinsiyet: 24 px'te ayırt edilebilmesi için gövde SİLUETİ farklı — üçgen
  // elbise, dikdörtgen gövde, yuvarlak omuz. İnce detaylar bu boyutta birbirine
  // benziyordu, bu yüzden fark ana hatta verildi.
  female: "M12 3.3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12 8.6 8.3 15.6h7.4ZM10.5 15.6 10.1 20.7M13.5 15.6l.4 5.1",
  male: "M12 3.3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM9.2 9h5.6v5.3H9.2ZM10.6 14.3v6.4M13.4 14.3v6.4",
  neutral: "M12 3.3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12 9c-2.4 0-3.6 1.2-3.6 3.4v2.5h1.5v5.8h4.2v-5.8h1.5v-2.5C15.6 10.2 14.4 9 12 9Z",
  // Hedefler
  weightLoss: "M12 3v11m0 0 4-4m-4 4-4-4M5 20h14",
  fatBurn: "M12 3.2c3 3.1 4.6 5.6 4.6 8.1a4.6 4.6 0 0 1-9.2 0c0-1.2.4-2.3 1.1-3.4.5 1 1.1 1.6 1.8 1.9-.1-2.4.5-4.5 1.7-6.6ZM12 20.8a3 3 0 0 1-3-3c0-1.3.9-2.4 3-4 2.1 1.6 3 2.7 3 4a3 3 0 0 1-3 3Z",
  muscle: "M4 16.5c0-3.4 1.4-5.6 4.2-6.6L9.4 5.2 13 6.4c3.4 1.1 5.2 3.5 5.4 7.2.1 2.2-1.2 3.8-3.4 4.2-2 .4-3.6-.3-4.8-2M4 16.5c1.9 1.7 4 2.3 6.2 1.3",
  strength: "M4 12h2m12 0h2M6.5 8.5v7m11-7v7M9.5 10v4m5-4v4M9.5 12h5",
  condition: "M3 12.5h3.5l2-4.5 3 9 2.5-6 1.5 3H21",
  health: "M12 20.4S4.4 16.2 4.4 10.6A4.1 4.1 0 0 1 12 8.3a4.1 4.1 0 0 1 7.6 2.3c0 5.6-7.6 9.8-7.6 9.8Z",
  // Ölçü kartı başlıkları
  height: "M12 3v18M12 3 9 6m3-3 3 3M12 21l-3-3m3 3 3-3M4 3v18m16-18v18",
  weight: "M6.2 8.4h11.6l1.8 11.4H4.4ZM9.4 8.4a2.6 2.6 0 1 1 5.2 0",
};

export function OnboardingIcon({ name, className = "" }: { name: OnboardingIconName; className?: string }) {
  return (
    <svg
      className={`onboarding-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
