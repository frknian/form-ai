# FİT.AI mobil uygulaması

Paket kimliği: `com.fitai.app`

## Geliştirme

1. Web uygulamasını erişilebilir bir HTTPS adresinde çalıştır.
2. Gerekirse `CAPACITOR_SERVER_URL` ile mobil kabuğun açacağı adresi değiştir.
3. Yerel projeleri güncelle: `npm run mobile:sync`
4. Android Studio: `npm run mobile:android`
5. Xcode: `npm run mobile:ios`

Android derlemesi için Android Studio/JDK, iOS derlemesi için macOS üzerinde Xcode ve geçerli imzalama hesabı gerekir.

## Supabase Auth

Supabase Auth → URL Configuration → Redirect URLs listesine aşağıdaki adresi ekle:

`com.fitai.app://auth/callback`

Google sağlayıcısı Supabase içinde etkin olmalı. Mobil OAuth, sistem tarayıcısında açılır ve doğrulamadan sonra deep link ile uygulamaya döner. Gemini anahtarı mobil projeye eklenmez; AI çağrıları yayınlanan sunucu API rotalarında kalır.

## Yerel özellikler

- Öğün kamerası ve fotoğraf seçimi
- Antrenman yerel bildirimleri
- Android geri tuşu
- Çevrimdışı bağlantı uyarısı
- Hafif dokunsal geri bildirim
- iOS ve Android güvenli alan uyumu

## Mağaza öncesi

- Supabase bağlantı değişkenlerini yayın ortamına ekle ve SQL şemasını uygula.
- Geçici uygulama ikonlarını ve açılış görsellerini nihai FİT.AI marka dosyalarıyla değiştir.
- Gizlilik politikası, destek URL'si ve mağaza veri güvenliği formlarını hazırla.
- Gerçek cihazlarda e-posta doğrulama, Google girişi, kamera, bildirim ve antrenman kaydını test et.
