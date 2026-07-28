# Türk yemeği tarif verisi

Bu katman paketli ürün kataloğundan bağımsızdır. `foods` barkodlu/tekil besinleri,
`recipe_dishes` ise bir veya daha fazla sürümü olan yemek kimliğini temsil eder.

## Veri akışı

1. `recipe_dishes`: ad, alternatif adlar, slug, kategori, yöre, açıklama ve
   alerjenler.
2. `recipe_versions`: porsiyon gramı, pişmiş toplam ağırlık, tarif sürümü,
   100 gram değerleri, kaynak, yöntem, güven ve yayın durumu.
3. `recipe_ingredients`: her sürümün malzemeleri, çiğ gramajları, yenebilir
   verim ve besin tutma katsayıları ile kaynak anlık görüntüsü.
4. `recipe_calculation_runs`: hesaplayıcı sürümü, girdi/çıktı anlık görüntüsü,
   uyarılar ve veri parmak izi.

Hesaplama malzemelerin yenebilir ağırlığından toplam besin değerini çıkarır.
100 gram değerleri toplam besini **toplam pişmiş ağırlığa** bölerek hesaplanır.
Porsiyon değeri daha sonra 100 gram tabanından ölçeklenir. Porsiyon adedi hiçbir
zaman pişirme kaybı veya su kazanımı yerine kullanılmaz.

Kaynak enerji değeri varsa önceliklidir. Yoksa 4/4/9 formülü yalnızca tahmin
olarak çalışır; sonuç `needs_review` ve düşük güven olur.

## Kaynak politikası

- USDA FoodData Central: `USDA_FDC_API_KEY` tanımlanırsa malzeme eşleştirmesi
  için isteğe bağlıdır.
- Open Food Facts: yalnızca barkodlu/paketli ürün akışında kullanılır; tarif
  aramasında kullanılmaz.
- TürKomp: kaynak/lisans alanları hazırdır fakat izin gerektiren veri otomatik
  çekilmez. `approved_for_automatic_import=false` kalır.
- Kaynaksız eski yerel değerler doğrulanmış sayılmaz ve otomatik yayımlanmaz.

## Kurulum ve içe aktarma

Supabase SQL Editor'da:

```text
db/migrations/20260730_turkish_recipe_infrastructure.sql
db/migrations/20260731_turkish_food_catalog_expansion.sql
db/migrations/20260801_archive_duplicate_recipe_dishes.sql
```

Seed'i doğrulama:

```bash
npm run data:validate-turkish-recipes
```

Seed'i yeniden üretme:

```bash
npm run data:generate-turkish-recipes
```

Supabase'e idempotent içe aktarma:

```bash
npm run data:import-turkish-recipes
```

İçe aktarıcı `slug`, `(dish_id, version)` ve hesaplama parmak izi çakışmalarını
upsert eder. Aynı seed tekrar çalıştırıldığında yemek veya sürüm kopyalanmaz.

Başlangıç dosyasındaki 500 kayıt bir inceleme kuyruğudur. Kaynak doğrulaması
olmayan makro veya malzeme gramajı uydurulmadığı için bu kayıtlar
`needs_review` olarak gelir. Bir sürümün `published` olabilmesi için:

- malzeme gramajlarının tamamlanması,
- malzemelerin izin verilen bir besin kaynağına eşleştirilmesi,
- toplam pişmiş ağırlığın ölçülmesi,
- alerjenlerin kontrol edilmesi,
- hesaplama uyarılarının kapatılması

gerekir.

## API

- `GET /api/nutrition/recipes/search?q=mercimek`
- `GET /api/nutrition/recipes/{slug}?grams=250`
- `GET /api/nutrition/recipes/{slug}?portions=1.5`
- `GET /api/nutrition/recipes/{slug}?version=2.0.0&portions=1`

Gram ve porsiyon aynı istekte birlikte gönderilemez. Uçlar yalnızca
kimliği doğrulanmış kullanıcıya ve yalnızca `published` tarif sürümlerine cevap
verir.
