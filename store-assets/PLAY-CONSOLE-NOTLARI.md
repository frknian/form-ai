# Play Console'da doldurulacaklar

Kod tarafındaki hazırlık tamamlandı. Aşağıdakiler yalnızca Play Console
arayüzünden yapılabilir; her biri koddaki gerçek davranışa göre yazıldı.

## 1. Data safety (Veri güvenliği) formu

**Veri topluyor mu?** Evet. **Veri paylaşıyor mu?** Evet (bkz. üçüncü taraflar).
**Aktarım şifreleniyor mu?** Evet (HTTPS).
**Kullanıcı verisini silmeyi talep edebiliyor mu?** Evet — uygulama içinden
kalıcı hesap silme var (Profilim → Hesap yönetimi → Hesabı sil).

| Veri türü | Toplanır | Paylaşılır | Zorunlu | Amaç |
|---|---|---|---|---|
| E-posta adresi | ✔ | ✖ | Zorunlu | Hesap yönetimi, kimlik doğrulama |
| Ad | ✔ | ✖ | İsteğe bağlı | Uygulama işlevi |
| Sağlık ve fitness bilgileri | ✔ | ✔ (AI sağlayıcısı) | Zorunlu | Uygulama işlevi, kişiselleştirme |
| Fotoğraflar | ✔ | ✔ (AI sağlayıcısı) | İsteğe bağlı | Uygulama işlevi (öğün analizi) |
| Uygulama etkileşimleri | ✔ | ✖ | Zorunlu | Uygulama işlevi |

> Sağlık/fitness altında beyan edilecekler: doğum tarihi, cinsiyet, boy, kilo,
> vücut ölçümleri, antrenman ve beslenme kayıtları, ağrı/yorgunluk geri bildirimi.
> **Konum toplanmıyor** — bu kutuyu işaretlemeyin.

Öğün fotoğrafı analiz için AI sağlayıcısına (Moonshot AI, Kimi K3) gönderilir ama **saklanmaz**; formda "paylaşılır" olarak
işaretlenmeli, "toplanır/saklanır" kısmında ise yalnızca analiz sonucu
tutulduğu belirtilmeli. Barkod tarama tamamen cihaz üstünde (ZXing) çalışır,
hiçbir görüntü sunucuya gönderilmez — bunu ayrıca beyan etmenize gerek yok.

## 2. Zorunlu alanlar

- **Gizlilik politikası URL'si:** `store-assets/GIZLILIK-POLITIKASI.md` metnini
  herkese açık kalıcı bir adreste yayınlayın (ör. `https://alanadiniz.com/gizlilik`).
  Placeholder alanları (`[KURUM ADI]` vb.) doldurmayı unutmayın.
- **Destek e-postası:** repoda hiçbir iletişim adresi yok, belirlemeniz gerekiyor.
- **İçerik derecelendirme (IARC) anketi:** Sağlık/fitness uygulaması,
  kullanıcı etkileşimi yok, satın alma yok.
- **Hedef kitle:** 13+ (gizlilik politikası bu yaşa göre yazıldı).
- **Reklam içeriyor mu?** Hayır — projede hiçbir reklam SDK'sı yok.
- **Şifreleme ihracat beyanı:** yalnızca standart HTTPS kullanılır.

## 3. Görsel varlıklar

| Varlık | Durum | Yol |
|---|---|---|
| Uygulama ikonu 512×512 | ✔ hazır | `store-assets/play-icon-512.png` |
| Feature graphic 1024×500 | ✔ Hedefit marka ve sloganıyla hazır | `store-assets/feature-graphic-1024x500.png` |
| Telefon ekran görüntüsü (min 2) | ✖ eksik | Emülatörden alınmalı |
| Tablet ekran görüntüsü | ✖ (isteğe bağlı) | — |

Feature graphic üzerinde “Hedefit” ve “Hedefin için fit plan.” metni bulunur;
“f” beyaz, “it” yeşil marka ayrımı kullanılır.

Görselleri yeniden üretmek için:
```bash
node scripts/generate-android-assets.mjs
```

## 4. Sürüm numarası

`android/app/build.gradle` içinde `versionCode 1` / `versionName "1.0"`.
Her Play yüklemesinde `versionCode` **artırılmalı**; aynı numarayla ikinci kez
yükleme yapılamaz.
