export type CoachMessage = { role: "user" | "assistant"; text: string };

export function coachModelCandidates(preferred?: string) {
  return [...new Set([preferred, "gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"].filter((model): model is string => Boolean(model?.trim())))];
}

export function localCoachReply(question: string) {
  const normalized = question.toLocaleLowerCase("tr-TR");
  if (/ağrı|acı|yaralan|baş dön|göğüs/.test(normalized)) return "Keskin ağrı, baş dönmesi veya göğüs ağrısı varsa antrenmanı durdur. Ağrı geçmiyorsa bir sağlık uzmanına danış; bugün yük artırma ve yalnızca ağrısız, hafif hareketleri değerlendir.";
  if (/dinlen|uyku|yorgun/.test(normalized)) return "Yorgunluk yüksekse yükü artırma. Setler arasında nefesin normale yaklaşana kadar 60–120 saniye dinlen; bugün performanstan çok kontrollü form ve toparlanmaya odaklan.";
  if (/kolaylaştır|alternatif|yapam/.test(normalized)) return "Hareketi daha kısa hareket aralığı, daha düşük ağırlık veya destekli varyasyonla kolaylaştır. Tekrar boyunca kontrolü koruyamıyorsan seti bitir ve ağrısız alternatife geç.";
  if (/kolay|zorlaştır|artır|ilerle/.test(normalized)) return "Aynı tekrarları iyi formla ve RPE 6–7 civarında iki antrenman tamamladıysan yalnızca bir değişkeni artır: 1–2 tekrar veya küçük bir ağırlık artışı. Ağrı ya da yüksek yorgunluk varsa mevcut düzeyi koru.";
  return "Bugünkü programda önce 5–8 dakika ısın, hareketleri kontrollü formda uygula ve son 2 tekrar belirgin biçimde zorlaşsa da formun bozulmayacağı yükü seç. Ağrı veya olağandışı yorgunlukta yoğunluğu azalt.";
}
