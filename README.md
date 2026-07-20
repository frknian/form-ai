# form.ai

Gemini destekli, kullanıcının profiline ve antrenman geri bildirimlerine göre zamanla uyarlanan fitness uygulaması. Next.js 16, React 19, strict TypeScript ve Vinext/Cloudflare çalışma ortamını kullanır.

## Geliştirme

Node.js `>=22.13.0` gereklidir.

```bash
npm install
npm run dev
npm test
npm run lint
```

`npm test` üretim derlemesini oluşturur ve Node test paketini çalıştırır.

## Egzersiz veri tabanı

Exercise data source:
https://github.com/yuhonas/free-exercise-db

Uygulama, `free-exercise-db` veri setinden öncelikli kas gruplarını kapsayan seçilmiş bir alt küme kullanır. Kaynak veri kullanıcı arayüzüne doğrudan verilmez; `lib/exercise-service.ts` içindeki normalize katmanı kimlik, metin, dizi ve yerel görsel yollarını doğrular.

- Normalize veri: `data/exercises.json`
- Kaynak lisansı: `data/FREE_EXERCISE_DB_LICENSE.md`
- Yerel görseller: `public/exercise-images/<exercise-id>/`
- TypeScript modeli: `types/exercise.ts`
- İçe aktarma aracı: `scripts/import-free-exercise-db.mjs`
- Liste API'si: `GET /api/exercises`
- Detay API'si: `GET /api/exercises/:id`

Liste API'si `search`, `muscle`, `equipment`, `level`, `category`, `page` ve `limit` parametrelerini destekler. `limit` en fazla 48 olabilir.

### Veri setini güncelleme

```bash
npm run data:import-exercises
```

Bu komut kaynak JSON'u ve lisansı indirir, hedef kas gruplarından deterministik bir alt küme seçer, ilk iki hareket karesini yerel statik klasöre kopyalar ve normalize JSON'u yeniden üretir. Değişiklikten sonra `npm test` ve `npm run lint` çalıştırılmalıdır.

### Yeni egzersiz ekleme

Kalıcı bir kaynak egzersiz eklemek için `scripts/import-free-exercise-db.mjs` içindeki kas/kota seçimini güncelleyin ve içe aktarma komutunu çalıştırın. Elle ekleme gerekiyorsa kayıt `Exercise` tipine uymalı, kimliği yalnızca harf/rakam/alt çizgi/tire içermeli ve görseller `/exercise-images/<id>/<dosya>` altında bulunmalıdır.

## Hareket simülasyonu

Görsel tabanlı hareket simülasyonları (`components/exercises/ExerciseAnimation.tsx`) ve CSS tabanlı anatomik çizimler (`app/page.tsx` altındaki `MotionFigureAnimation`) performans odaklı çalışır:

- **Seçici Yükleme ve Ön-Render (Pre-rendering)**: Hareket simülasyonu aktifken tüm kareler DOM üzerinde mutlak konumlandırma (absolute positioning) ile üst üste yerleştirilir ve görünürlükleri `opacity` ile yönetilir. Bu sayede tarayıcı kareleri önceden indirip decode eder, kare geçişlerindeki titreme (flicker) ve sayfa kaymaları (layout shift) önlenir.
- **Kaynak Tasarrufu**: Kart ekran dışında (viewport dışı) veya sekme arka plandayken yalnızca aktif/kapak karesi render edilerek gereksiz görsel indirmeleri ve bellek tüketimi engellenir.
- **Akıllı Duraklatma**: Animasyon döngüleri (`setInterval`) yalnızca ilgili kart viewport sınırları içindeyken (Intersection Observer ile izlenir) ve tarayıcı sekmesi aktifken çalışır. Kullanıcı `prefers-reduced-motion` tercihine sahipse döngüler tamamen devre dışı bırakılır.
- **Temizlik**: Bileşenler unmount edildiğinde tüm zamanlayıcılar (interval) ve gözlemciler (observer) bellek sızıntısını önlemek için temizlenir.

## AI kataloğu

`getExercisesForAI(filters)` yalnızca kimlik, ad, seviye, ekipman, kaslar ve kategori alanlarını döndürür. Görsel yolları ve uzun talimatlar Gemini'ye gönderilmez. AI yanıtındaki her egzersiz kimliği yerel veri tabanında doğrulanır; bulunmayan kimlikler kullanıcıya gösterilmez.

## Lisans

`free-exercise-db` Unlicense ile kamu malı olarak yayımlanmıştır. Kaynaktan alınan lisans metni `data/FREE_EXERCISE_DB_LICENSE.md` içinde korunur. Veri ve görseller “olduğu gibi” sunulur; uygulamanın kendi kod lisansı bundan bağımsızdır.
