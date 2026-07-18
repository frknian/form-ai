export type FitnessSource = {
  title: string;
  url: string;
  useFor: string[];
  notes: string[];
};

/**
 * The planner uses these sources as a reviewed reference layer. We store
 * principles and links, not copied article text, so the LLM can cite the
 * origin without reproducing copyrighted content.
 */
export const fitnessSources: FitnessSource[] = [
  {
    title: "MACFit — A'dan Z'ye Adım Adım Fitness Antrenman Programı",
    url: "https://www.macfit.com/blog/fitness/fitness-antrenman-programi",
    useFor: ["seviye uyarlaması", "ev/salon ve ekipman uyarlaması", "hedefe göre program"],
    notes: ["Tüm vücudu dengeli çalıştır", "Isınma, mobilite ve dinlenme ekle", "Başlangıçta temel hareketleri düşük yoğunlukla seç"],
  },
  {
    title: "Berkay Türkkan — Antrenman Programı Hazırlama Rehberi",
    url: "https://berkayturkkan.com/antrenman-programi-hazirlama-rehberi",
    useFor: ["program tasarımı", "antrenman hacmi ve yoğunluğu", "kişiselleştirme"],
    notes: ["Programı kişinin hedefi, seviyesi ve toparlanmasına göre kur", "İlerlemeyi yalnızca ağırlıkla değil tekrar, set ve form ile de izle"],
  },
  {
    title: "Ağırsağlam — Yeni Başlayanlar İçin Fitness",
    url: "https://www.agirsaglam.com/yeni-baslayanlar-icin-fitness/",
    useFor: ["başlangıç güvenliği", "temel hareket seçimi", "form eğitimi"],
    notes: ["Yeni başlayanlar için hareket varyasyonunu kolaylaştır", "Form bozulduğunda yoğunluğu azalt veya hareketi durdur"],
  },
  {
    title: "Ağırsağlam — Hesaplama Kategorisi",
    url: "https://www.agirsaglam.com/kategori/hesaplama/",
    useFor: ["BMI ve yardımcı hesaplamalar", "ölçüm açıklamaları"],
    notes: ["Hesaplamaları tahmin olarak etiketle", "BMI ve fotoğraf gözlemini tıbbi teşhis veya kesin yağ oranı olarak sunma"],
  },
  {
    title: "Ağırsağlam — Fitness Antrenman Programları",
    url: "https://www.agirsaglam.com/fitness-antrenman-programlari/",
    useFor: ["5x5 ve 3x5 örnekleri", "split program mantığı", "set/tekrar/dinlenme örnekleri"],
    notes: ["İleri programları yalnızca uygun seviye ve hareket formu doğrulandıktan sonra öner", "Yeni başlayanlarda daha kolay varyasyon kullan"],
  },
  {
    title: "Forbes Health — Best Workout And Fitness Apps",
    url: "https://www.forbes.com/health/weight-loss/best-fitness-apps/",
    useFor: ["ürün özellikleri", "ilerleme takibi", "sağlık verisi entegrasyonu", "video hareket anlatımı"],
    notes: ["Kişiselleştirme, hareket videosu, ilerleme takibi ve sağlık veri entegrasyonunu ürün gereksinimi olarak koru"],
  },
];

export const fitnessPlannerRules = [
  "Programı hedef, seviye, spor geçmişi, süre, ortam, ekipman ve sakatlık kısıtlarına göre oluştur.",
  "Her programda ısınma, ana bölüm, dinlenme ve soğuma adımı bulunmalı.",
  "Her hareket için İngilizce isim, Türkçe açıklama, set, tekrar veya süre, dinlenme ve animasyon bulunmalı.",
  "Sakatlık veya sağlık kısıtı varsa güvenli varyasyon öner ve gerektiğinde sağlık uzmanına yönlendir.",
  "Fotoğraf analizi yalnızca yaklaşık vücut kompozisyonu gözlemi sağlar; kesin yağ oranı veya tıbbi tanı üretme.",
];
