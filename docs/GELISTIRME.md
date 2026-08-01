# Hedefit — Geliştirici rehberi

Kurulum, ortam değişkenleri, veritabanı, dağıtım, Android yayını, güvenlik ve
veri kaynakları. Uygulamanın tanıtımı için [README](../README.md).

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

Veri katmanı Supabase'dir. Tek dağıtım hedefi **Cloudflare Workers**:

```bash
npm run build    # vinext build · çıktı: dist/
npm run deploy   # build + wrangler deploy -c dist/server/wrangler.json
```

Cloudflare panelindeki otomatik dağıtım da `npm run build` çalıştırır. İstemciye
gömülen `NEXT_PUBLIC_*` değerleri derleme anında okunur; bu yüzden `.env.production`
repoya bilerek dahil edilmiştir (bkz. `.gitignore` içindeki açıklama). Worker
gizli anahtarları (`AI_API_KEY`, `SUPABASE_SECRET_KEY`) ise Cloudflare panelinden
**Secret** olarak tanımlanır — derlemeye girmezler.

Güvenlik başlıkları tek kaynaktan (`lib/security-headers.ts`) gelir ve
`worker/index.ts` içinde tüm yanıtlara eklenir.

## Android yayını (Google Play)

### 1. Yükleme anahtarı

Anahtar deposu **repoya girmez** ve kaybedilirse aynı uygulamaya bir daha
güncelleme yayınlanamaz — güvenli bir yerde yedekleyin.

```bash
keytool -genkeypair -v -keystore hedefit-upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias hedefit-upload
```

`android/keystore.properties.example` dosyasını `keystore.properties` olarak
kopyalayıp doldurun (`.gitignore`'dadır). CI için alternatif olarak
`HEDEFIT_KEYSTORE_FILE`, `HEDEFIT_KEYSTORE_PASSWORD`, `HEDEFIT_KEY_ALIAS`,
`HEDEFIT_KEY_PASSWORD` ortam değişkenleri kullanılabilir. İmzalama
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
- **A03 – Enjeksiyon**: Veritabanı erişimi parametreli Supabase istemcisi üzerindendir. Kullanıcı girdisi uzunluk ve tip olarak sınırlandırılır. Uygulamada `innerHTML` ile kullanıcı içeriği basılmaz.
- **A04 – Güvensiz tasarım**: Tüm uç noktalarda hız sınırı vardır (`lib/rate-limit.ts`) — plan üretimi 5/5dk, sohbet 20/dk, beslenme 15–40/dk. Sayaç örnek belleğinde tutulur; çok örnekli dağıtımda üst sınır örnek başınadır.
- **A05 – Hatalı yapılandırma**: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS ve COOP tüm yanıtlara eklenir. Başlık tanımı tek kaynaktadır (`lib/security-headers.ts`) ve `worker/index.ts` içinde tüm yanıtlara uygulanır. API yanıtları `no-store`; `X-Powered-By` kapalıdır.
- **A06 – Güncel olmayan bileşenler**: `npm audit` ile izlenir; `undici`, `postcss` ve `sharp` için yamalı sürümler `package.json > overrides` ile zorlanır.
- **A07 – Kimlik doğrulama hataları**: Doğrulama ve şifre sıfırlama tek kullanımlık OTP koduyla; şifre en az 8 karakter; doğrulanmamış hesap uygulamaya alınmaz.
- **A08 – Veri bütünlüğü**: AI yanıtları şema ile doğrulanır ve her egzersiz kimliği yerel katalogda kontrol edilir; doğrulanamayan içerik kullanıcıya gösterilmez.
- **A10 – SSRF**: AI çağrıları yalnızca sunucuda yapılandırılmış `AI_BASE_URL`
  alan adına yapılır; kullanıcı girdisi URL ana bilgisayarını belirleyemez.

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
