export type CoachMessage = { role: "user" | "assistant"; text: string };

export function localCoachReply(question: string, locale: "tr" | "en" = "tr") {
  if (locale === "en") {
    const normalized = question.toLocaleLowerCase("en-US");
    if (/pain|hurt|injur|dizz|chest/.test(normalized)) return "If you have sharp pain, dizziness, or chest pain, stop the workout. If the pain doesn't go away, see a health professional; today, avoid increasing load and consider only light, pain-free movements.";
    if (/rest|sleep|tired|fatigue/.test(normalized)) return "Don't increase load if fatigue is high. Rest 60–120 seconds between sets until your breathing returns to normal; focus today on controlled form and recovery rather than performance.";
    if (/easier|alternative|can'?t|cannot/.test(normalized)) return "Make the exercise easier with a shorter range of motion, lighter weight, or an assisted variation. If you can't keep control through the rep, end the set and switch to a pain-free alternative.";
    if (/easy|harder|increase|progress/.test(normalized)) return "If you've completed two workouts with good form at the same reps around RPE 6–7, increase only one variable: 1–2 reps or a small weight increase. Keep your current level if there's pain or high fatigue.";
    return "For today's program, warm up for 5–8 minutes first, perform the exercises with controlled form, and choose a load where the last 2 reps get noticeably harder without breaking form. Reduce intensity if there's pain or unusual fatigue.";
  }
  const normalized = question.toLocaleLowerCase("tr-TR");
  if (/ağrı|acı|yaralan|baş dön|göğüs/.test(normalized)) return "Keskin ağrı, baş dönmesi veya göğüs ağrısı varsa antrenmanı durdur. Ağrı geçmiyorsa bir sağlık uzmanına danış; bugün yük artırma ve yalnızca ağrısız, hafif hareketleri değerlendir.";
  if (/dinlen|uyku|yorgun/.test(normalized)) return "Yorgunluk yüksekse yükü artırma. Setler arasında nefesin normale yaklaşana kadar 60–120 saniye dinlen; bugün performanstan çok kontrollü form ve toparlanmaya odaklan.";
  if (/kolaylaştır|alternatif|yapam/.test(normalized)) return "Hareketi daha kısa hareket aralığı, daha düşük ağırlık veya destekli varyasyonla kolaylaştır. Tekrar boyunca kontrolü koruyamıyorsan seti bitir ve ağrısız alternatife geç.";
  if (/kolay|zorlaştır|artır|ilerle/.test(normalized)) return "Aynı tekrarları iyi formla ve RPE 6–7 civarında iki antrenman tamamladıysan yalnızca bir değişkeni artır: 1–2 tekrar veya küçük bir ağırlık artışı. Ağrı ya da yüksek yorgunluk varsa mevcut düzeyi koru.";
  return "Bugünkü programda önce 5–8 dakika ısın, hareketleri kontrollü formda uygula ve son 2 tekrar belirgin biçimde zorlaşsa da formun bozulmayacağı yükü seç. Ağrı veya olağandışı yorgunlukta yoğunluğu azalt.";
}
