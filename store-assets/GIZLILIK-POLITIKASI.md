# FİT.AI (form.ai) Gizlilik Politikası

**Son güncelleme:** 26 Temmuz 2026

> Bu metin, uygulamanın kaynak kodunda gerçekten yapılan veri işlemesine göre
> hazırlanmıştır. Yayınlamadan önce **[KURUM ADI]**, **[İLETİŞİM E-POSTASI]** ve
> **[VERİ SORUMLUSU ADRESİ]** alanlarını doldurun ve metni herkese açık,
> kalıcı bir adreste yayınlayın. Play Console bu adresi zorunlu tutar.

## 1. Veri sorumlusu

FİT.AI uygulamasını **[KURUM ADI]** işletir. Sorularınız için:
**[İLETİŞİM E-POSTASI]**

## 2. Topladığımız veriler

Uygulama yalnızca hizmeti sunmak için gereken verileri toplar. Tüm veriler
hesabınıza bağlıdır ve başka kullanıcılar tarafından görülemez.

### 2.1 Hesap bilgileri
- E-posta adresi (kimlik doğrulama)
- Şifre (Supabase Auth tarafından karma/hash olarak saklanır; biz düz metin
  şifrenizi görmeyiz)
- Google ile giriş yaparsanız Google hesabınızın temel kimlik bilgisi

### 2.2 Sağlık ve fitness verileri
Play Console veri güvenliği sınıflandırmasında **"Sağlık ve fitness"**
kategorisine girer:
- Doğum tarihi, cinsiyet, boy, kilo
- Vücut ölçümleri (bel, kalça, göğüs, kol, bacak)
- Antrenman kayıtları: tamamlanan hareketler, set/tekrar/ağırlık, süre,
  algılanan zorluk, yorgunluk düzeyi ve bildirdiğiniz ağrı bölgeleri
- Aktivite kayıtları (yürüyüş, koşu, bisiklet vb.: süre, mesafe, adım)
- Beslenme kayıtları: yediğiniz besinler, porsiyon, kalori ve makro değerleri
- Hedefleriniz ve profil testi cevaplarınız

### 2.3 Fotoğraflar
- **Öğün fotoğrafı:** Kalori tahmini için çektiğiniz fotoğraf, analiz amacıyla
  yapay zeka sağlayıcımıza (Moonshot AI'nin Kimi K3 modeli) gönderilir. Fotoğrafın kendisi sunucularımızda saklanmaz;
  yalnızca analiz sonucu (besin adı, gramaj, makrolar) kaydedilir.
- **Barkod tarama:** Barkod tamamen cihazınızda okunur; hiçbir görüntü veya
  veri sunucuya ya da üçüncü tarafa gönderilmez.
- **İsteğe bağlı vücut fotoğrafı:** Program kişiselleştirmesi için
  gönderebilirsiniz. Zorunlu değildir ve saklanmaz.
- **Profil fotoğrafı:** Yüklerseniz özel (public olmayan) depolamada tutulur ve
  yalnızca kısa süreli imzalı bağlantıyla size gösterilir.

### 2.4 Cihaz izinleri
- **Kamera:** barkod tarama ve öğün fotoğrafı
- **Fotoğraf arşivi:** öğün/profil fotoğrafı seçme
- **Bildirimler:** antrenman hatırlatmaları
- **Saat dilimi:** hatırlatmaların doğru saatte gelmesi için cihazınızın saat
  dilimi okunur ve kaydedilir

Konum (GPS) verisi **toplanmaz**.

## 3. Verileri neden işliyoruz

- Kişisel antrenman ve beslenme planı üretmek
- İlerlemenizi zaman içinde takip etmek ve göstermek
- Antrenman hatırlatmaları göndermek
- Hesabınızı güvenli tutmak (e-posta doğrulama, oturum yönetimi)

Verilerinizi **reklam için kullanmıyoruz**, satmıyoruz ve reklam ağlarıyla
paylaşmıyoruz. Uygulamada reklam SDK'sı bulunmaz.

## 4. Üçüncü taraf hizmetler

| Hizmet | Amaç | Paylaşılan veri |
|---|---|---|
| Supabase | Hesap, veritabanı ve dosya depolama | Bölüm 2'deki tüm veriler |
| AI sağlayıcısı (Moonshot AI, Kimi K3) | Plan üretimi, öğün fotoğrafı analizi, koç sohbeti, haftalık değerlendirme | Anonim profil özeti, öğün fotoğrafı, sohbet mesajları. Kimlik bilgileriniz (e-posta, ad) gönderilmez. |
| Open Food Facts | Ürün adı ile besin araması | Yalnızca aradığınız ürün adı |

## 5. Saklama ve silme

- Veriler siz silene kadar saklanır.
- **Hesabınızı uygulama içinden kalıcı olarak silebilirsiniz:**
  Profilim → Hesap yönetimi → Hesabı sil. Bu işlem profilinizi, antrenman,
  ölçüm, beslenme ve tüm diğer kayıtlarınızı geri alınamaz biçimde kaldırır.
- **Hesabı dondurma** seçeneği verilerinizi korur ve erişimi geçici durdurur.
- **Verilerinizi dışa aktarma:** Profilim → Verilerin → JSON olarak indir.

## 6. Güvenlik

- Tüm trafik HTTPS üzerinden şifrelenir.
- Veritabanında satır düzeyi güvenlik (RLS) etkindir: her kullanıcı yalnızca
  kendi kayıtlarına erişebilir.
- API uç noktaları kimlik doğrulaması ve hız sınırı ile korunur.
- Profil fotoğrafları herkese açık olmayan depoda tutulur.

## 7. Çocuklar

Uygulama 13 yaşın altındaki çocuklara yönelik değildir ve bilerek onlardan veri
toplamayız.

## 8. Sağlık uyarısı

FİT.AI tıbbi cihaz değildir. Ürettiği plan, kalori hedefi ve değerlendirmeler
tıbbi teşhis, tedavi veya beslenme reçetesi yerine geçmez. Hamilelik, emzirme,
yeme bozukluğu öyküsü, diyabet, kalp veya böbrek rahatsızlığı gibi durumlarda
uygulamayı kullanmadan önce bir sağlık uzmanına danışın. Antrenman sırasında
keskin ağrı, göğüs ağrısı veya baş dönmesi yaşarsanız durun ve hekime başvurun.

## 9. Haklarınız

KVKK ve GDPR kapsamında verilerinize erişme, düzeltme, silme ve taşıma
haklarına sahipsiniz. Erişim ve silme işlemlerini uygulama içinden doğrudan
yapabilirsiniz; diğer talepler için **[İLETİŞİM E-POSTASI]** adresine yazın.

## 10. Değişiklikler

Bu politikada değişiklik yaparsak güncel sürümü bu adreste yayınlar ve
"Son güncelleme" tarihini değiştiririz.
