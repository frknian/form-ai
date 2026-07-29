# Besin arama altyapısı

Besin kataloğu tek bir `foods` tablosunda tutulur. Uygulama içinde sabit yemek
listesi veya ayrı tarif arama API'si yoktur.

## Kurulum

Supabase SQL Editor'de aşağıdaki migration'ı çalıştırın:

```text
db/migrations/20260802_rebuild_food_search.sql
```

Bu migration eski `foods`, alias ve tarif kataloglarını siler. Kullanıcı hesabı,
aktivite ve öğün geçmişini silmez; geçmiş öğünlerdeki eski katalog bağlantısını
`null` yaparak kaydın adını ve besin değerlerini korur.

Sunucu ortamında şunlar bulunmalıdır:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY
USDA_FDC_API_KEY
```

`USDA_FDC_API_KEY` yoksa yerel Supabase sonuçları ve barkod araması çalışmaya
devam eder; genel dış arama yapılmaz.

## Akış

1. `GET /api/nutrition/search?q=...` önce `search_foods` RPC'sini çağırır.
2. RPC, `unaccent` ve `pg_trgm` ile ad/alias benzerliğini puanlar.
3. Yerel sonuç yetersizse Türkçe sorgu sağlayıcı eş anlamlısına çevrilir.
4. USDA FoodData Central sonucu kanonik `foods` kaydına dönüştürülür.
5. Sonuç hem `foods` tablosuna hem yedi günlük sorgu cache'ine upsert edilir.
6. `POST /api/nutrition/selections` seçimi kaydeder; sonraki aramalarda kullanıcının
   sık seçtiği besinlere sınırlı bir sıralama artışı verir.

Open Food Facts yalnızca `POST /api/nutrition/barcode` üzerinden paketli ve
barkodlu ürünler için kullanılır.

## Mobil istemci

Mevcut Capacitor arayüzü aynı API'yi kullanır. Ayrı Expo/React Native örneği
`mobile-native/` altındadır:

```bash
cd mobile-native
npm install
EXPO_PUBLIC_API_BASE_URL=https://form-ai.frknian.workers.dev npm run start
```

Gerçek oturumda Supabase erişim jetonunu kimlik doğrulama katmanından
`FoodSearchScreen` bileşenine geçirin. Örnek uygulamadaki
`EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN` yalnız yerel geliştirme kolaylığı içindir;
kalıcı üretim sırrı olarak kullanılmamalıdır.

## Kontrol

```bash
npm run food-search:check
npm run lint
npm run build
```
