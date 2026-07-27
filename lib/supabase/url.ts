/**
 * Supabase proje adresi yalnızca ORIGIN olmalıdır.
 *
 * Dağıtım panellerine bu değer sık sık yanlışlıkla OAuth callback adresi olarak
 * girilir (ör. https://<proje>.supabase.co/auth/v1/callback). Tarayıcı istemcisi
 * bunu normalize ettiği için giriş çalışmaya devam eder; ancak sunucu tarafı ham
 * değeri kullanırsa `getUser()` isteği
 * /auth/v1/callback/auth/v1/user gibi bozuk bir yola gider ve GEÇERLİ jetonlar
 * bile "Oturum doğrulanamadı." ile reddedilir. Bu yüzden istemci ve sunucu aynı
 * normalizasyondan geçmelidir.
 *
 * Geçersiz/boş değerde null döner; çağıran taraf bunu "yapılandırılmamış" olarak
 * ele alıp kapalı tarafa düşer.
 */
export function normalizeSupabaseUrl(configuredUrl: string | undefined | null): string | null {
  if (!configuredUrl) return null;
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return null;
  }
}
