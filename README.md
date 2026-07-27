# form.ai

Açık kaynak bir yapay zeka modeliyle (varsayılan: Moonshot AI'nin Kimi K3'ü, OpenAI-uyumlu herhangi bir sağlayıcı üzerinden değiştirilebilir) çalışan, kullanıcının profiline ve antrenman geri bildirimlerine göre zamanla uyarlanan fitness uygulaması. Next.js 16, React 19, strict TypeScript ve Vinext/Cloudflare çalışma ortamını kullanır.

## Özellikler

- **Kişisel onboarding ve AI plan üretimi**: Profil, spor geçmişi testi ve hedeflere göre yapay zeka ile antrenman planı; ortam (ev/salon) ve evdeki ekipmana uygun hareketler önceliklendirilir.
- **Zamanla uyarlanan program**: Antrenman sonrası zorluk/yorgunluk/ağrı geri bildirimiyle set, tekrar ve dinlenme otomatik uyarlanır.
- **Antrenman oynatıcı ve set kaydı**: Set/tekrar/dinlenme sayaçları, ağırlık · tekrar · RPE kaydı ve önceki performansa göre güvenli ilerleme önerisi.
- **Kişisel rekorlar (tahmini 1RM)**: Ağırlıklı set kayıtlarından Epley formülüyle hareket bazında en yüksek tahmini 1RM İlerlemem ekranında listelenir.
- **Aktivite günlüğü**: Koşu, yürüyüş, bisiklet, yüzme ve diğer sporlar için açılır pencerede kayıt ve geçmiş; günlük seri (streak) takibi.
- **Kalori/beslenme takibi, vücut ölçümleri ve takvim**: Barkod, katalog araması, Kimi K3 ile doğal dil/fotoğraf ayrıştırma, doğrulanmış kaynaklardan porsiyon hesabı, kalori-makro hedefleri, ölçüm trend grafikleri ve antrenman takvimi/hatırlatıcıları.
- **kg/lb birim tercihi**: Profil kilosu, set kaydı, kişisel rekorlar ve vücut ölçümleri seçilen birimde gösterilir (tercih yerel olarak saklanır).
- **Veri dışa aktarma**: Profilden tüm hesap verileri tek bir JSON dosyası olarak indirilebilir.
- **Güvenli hesap**: E-posta doğrulaması ve şifre sıfırlama 6 haneli OTP koduyla; Google ile giriş; hesabı dondurma/silme.
- **AI koç sohbeti**, dark/light tema ve Capacitor ile mobil (iOS/Android) desteği.

## Geliştirme

Node.js `>=22.13.0` gereklidir.

```bash
npm install
npm run dev
npm test
npm run lint
```

`npm test` üretim derlemesini oluşturur ve Node test paketini çalıştırır.

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun:

- `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` — AI plan üretimi, sohbet, öğün fotoğrafı analizi ve haftalık değerlendirme. OpenAI-uyumlu herhangi bir sağlayıcıyla çalışır (OpenRouter, Together, Fireworks, kendi vLLM/Ollama sunucunuz). Anahtar yoksa uygulama her yerde güvenli bir yerel yedeğe düşer.
- Görsel girdi (öğün fotoğrafı, plan fotoğrafı) gerektiği için `AI_MODEL` görsel destekli bir model olmalı; varsayılan `kimi-k3`, Moonshot AI'nin kendi API'si (`https://api.moonshot.ai/v1`) üzerinden native görsel destekler. OpenRouter/Together/Fireworks gibi başka bir sağlayıcıya geçmek için `.env.example`'daki örneğe bakın.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — hesap ve veri katmanı. Tanımlı değilse giriş ekranı "yapılandırılmamış" durumunu gösterir.
- `SUPABASE_SECRET_KEY` — yalnız sunucu tarafındaki hesap silme işlemi için; `NEXT_PUBLIC_` öneki eklemeyin.
- `USDA_FDC_API_KEY` — isteğe bağlı USDA FoodData Central arama yedeği; yalnız sunucuda kullanılır.
- `AI_VISION_ENABLED` — Kimi K3 dağıtımında görsel girdi kapalıysa `false`; fotoğraf akışı kullanıcıyı güvenli biçimde yazarak eklemeye yönlendirir.
- `CAPACITOR_SERVER_URL` — Capacitor geliştirmesinde yerel sunucu adresi.

## Veritabanı kurulumu

Şema iki parçadır ve **sırayla** çalıştırılmalıdır. Yalnız `db/supabase-schema.sql` çalıştırmak
eksik bir veritabanı bırakır: `profile_history` ve `feature_flags` tabloları yalnızca
migration dosyalarında tanımlıdır, dolayısıyla profil değişiklik geçmişi ve veri dışa aktarma
çalışmaz.

Supabase SQL Editor'de sırasıyla:

1. `db/supabase-schema.sql` — temel tablolar, RLS politikaları ve indeksler.
2. `db/migrations/*.sql` — **dosya adına göre artan sırada** hepsi. Migration'lar
   `create table if not exists` / `add column if not exists` / `drop policy if exists`
   kalıplarını kullandığı için tekrar çalıştırmak güvenlidir.

```bash
ls db/migrations/*.sql | sort
```

Yeni bir migration eklerken tarih önekli adlandırmayı koruyun ve ifadeleri idempotent yazın.

## Kimlik doğrulama (Supabase)

E-posta doğrulaması ve şifre sıfırlama, tıklanabilir bağlantı yerine **6 haneli OTP kodu** ile çalışır. Bunun nedeni, e-posta güvenlik tarayıcılarının tek kullanımlık doğrulama bağlantısını kullanıcı tıklamadan tüketip "bağlantının süresi doldu" hatasına yol açmasıdır; kod tıklanabilir olmadığı için bu sorun oluşmaz.

Yayın ortamında Supabase panelinde:

- **Authentication → Email Templates → Confirm signup**: `{{ .ConfirmationURL }}` yerine yalnızca `{{ .Token }}` kullanın.
- **Authentication → Email Templates → Reset Password**: aynı şekilde `{{ .Token }}` kullanın.
- **Authentication → URL Configuration**: Site URL olarak üretim alan adını, Redirect URLs listesine `/auth/callback` adresini ekleyin (Google OAuth ve doğrulama dönüşü için).

## Dağıtım

Veri katmanı Supabase'dir. Uygulama Nitro tabanlı hatla yayınlanır:

```bash
npm run build:vercel   # NITRO_PRESET=vercel · çıktı: .vercel/output
```

- **Vercel**: `vercel.json` bu komutu ve `.vercel/output` dizinini kullanır.
- **Dokploy (veya başka bir Node barındırma)**: aynı Nitro yapılandırmasıyla farklı bir preset seçilebilir, ör. `NITRO_PRESET=node-server vite build`.

Güvenlik başlıkları `nitro.config.ts` içindeki route kurallarıyla eklenir; bu nedenle her iki Nitro presetinde de geçerlidir. Derleme sonrası `.vercel/output/config.json` içinde başlıkların bulunduğu doğrulanabilir.

`npm run build` / `npm start` komutları workerd tabanlı yerel çalıştırma hattını kullanır; o hatta başlıklar `worker/index.ts` üzerinden eklenir.

## Android yayını (Google Play)

### 1. Yükleme anahtarı

Anahtar deposu **repoya girmez** ve kaybedilirse aynı uygulamaya bir daha
güncelleme yayınlanamaz — güvenli bir yerde yedekleyin.

```bash
keytool -genkeypair -v -keystore fitai-upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias fitai-upload
```

`android/keystore.properties.example` dosyasını `keystore.properties` olarak
kopyalayıp doldurun (`.gitignore`'dadır). CI için alternatif olarak
`FITAI_KEYSTORE_FILE`, `FITAI_KEYSTORE_PASSWORD`, `FITAI_KEY_ALIAS`,
`FITAI_KEY_PASSWORD` ortam değişkenleri kullanılabilir. İmzalama
yapılandırılmadan `bundleRelease` bilinçli olarak durur.

### 2. Üretim adresi

Capacitor kabuğu WebView'i `capacitor.config.ts` içindeki adrese yönlendirir ve
bu adres **pakete gömülür**. Yayın derlemelerinde açıkça verilmesi zorunludur:

```bash
CAPACITOR_RELEASE=1 CAPACITOR_SERVER_URL=https://app.alanadiniz.com npx cap sync android
```

### 3. Paket üretimi

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew bundleRelease
# çıktı: android/app/build/outputs/bundle/release/app-release.aab
```

Play yalnızca `.aab` kabul eder. Her yüklemede `android/app/build.gradle`
içindeki `versionCode` artırılmalıdır.

### 4. Görsel varlıklar

```bash
node scripts/generate-android-assets.mjs
```

Launcher ikonları, splash ve mağaza görselleri marka renklerinden (`#d9f76b` /
`#1d1d1b`) yeniden üretilir. Mağaza varlıkları `store-assets/` altındadır.

### 5. Play Console

Gizlilik politikası taslağı ve veri güvenliği formu cevapları için
`store-assets/GIZLILIK-POLITIKASI.md` ve `store-assets/PLAY-CONSOLE-NOTLARI.md`.

## Güvenlik (OWASP Top 10)

- **A01 – Erişim kontrolü**: AI ve beslenme uç noktalarının tamamı Supabase erişim jetonu ister (`lib/api-auth.ts`); jeton doğrulanır ve e-posta doğrulaması aranır. Tüm veritabanı tabloları RLS ile korunur. Hesap silme ayrıca onay ifadesi ve e-posta eşleşmesi gerektirir.
- **A02 – Kriptografik hatalar**: Gizli anahtarlar (`SUPABASE_SECRET_KEY`, `AI_API_KEY`) yalnızca sunucuda kullanılır; istemci paketine hiçbir gizli değer girmez. HSTS zorunludur.
- **A03 – Enjeksiyon**: Veritabanı erişimi parametreli Supabase istemcisi üzerindendir. Kullanıcı girdisi uzunluk ve tip olarak sınırlandırılır; barkod yalnızca rakama indirgenir. Uygulamada `innerHTML` ile kullanıcı içeriği basılmaz.
- **A04 – Güvensiz tasarım**: Tüm uç noktalarda hız sınırı vardır (`lib/rate-limit.ts`) — plan üretimi 5/5dk, sohbet 20/dk, beslenme 15–40/dk. Sayaç örnek belleğinde tutulur; çok örnekli dağıtımda üst sınır örnek başınadır.
- **A05 – Hatalı yapılandırma**: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS ve COOP tüm yanıtlara eklenir. Başlık tanımı tek kaynaktadır (`lib/security-headers.ts`) ve her dağıtım hattında uygulanır: Nitro (Vercel/Dokploy) için `nitro.config.ts` route kuralları, workerd hattı için `worker/index.ts`. API yanıtları `no-store`; `X-Powered-By` kapalıdır.
- **A06 – Güncel olmayan bileşenler**: `npm audit` ile izlenir; `undici`, `postcss` ve `sharp` için yamalı sürümler `package.json > overrides` ile zorlanır.
- **A07 – Kimlik doğrulama hataları**: Doğrulama ve şifre sıfırlama tek kullanımlık OTP koduyla; şifre en az 8 karakter; doğrulanmamış hesap uygulamaya alınmaz.
- **A08 – Veri bütünlüğü**: AI yanıtları şema ile doğrulanır ve her egzersiz kimliği yerel katalogda kontrol edilir; doğrulanamayan içerik kullanıcıya gösterilmez.
- **A10 – SSRF**: Dış çağrılar yalnızca sabit alan adlarına (`AI_BASE_URL`, Open Food Facts) yapılır; kullanıcı girdisi URL ana bilgisayarını belirleyemez.

Bilinen kabul edilen risk: `shadcn` CLI aracından gelen 3 orta seviye uyarı, yalnızca geliştirme aracını etkiler ve çalışma zamanı paketine girmez; düzeltmesi büyük sürüm düşürme gerektirdiği için uygulanmamıştır.

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

`getExercisesForAI(filters)` yalnızca kimlik, ad, seviye, ekipman, kaslar ve kategori alanlarını döndürür. Görsel yolları ve uzun talimatlar modele gönderilmez. AI yanıtındaki her egzersiz kimliği yerel veri tabanında doğrulanır; bulunmayan kimlikler kullanıcıya gösterilmez.

## Lisans

`free-exercise-db` Unlicense ile kamu malı olarak yayımlanmıştır. Kaynaktan alınan lisans metni `data/FREE_EXERCISE_DB_LICENSE.md` içinde korunur. Veri ve görseller “olduğu gibi” sunulur; uygulamanın kendi kod lisansı bundan bağımsızdır.
