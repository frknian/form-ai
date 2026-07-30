// Kimlik doğrulama dönüş adresinin ayrıştırılması.
//
// Supabase parametreleri duruma göre sorgu dizesine (`?error=...`) VEYA hash'e
// (`#error=...`) koyar; örtük (implicit) akışta hash kullanılır. Yalnızca birini
// okumak, gerçek hatayı görünmez kılıp kullanıcıya alakasız bir mesaj gösterir.
//
// Ayrıca sağlayıcı kaynaklı hataları ayırt ederiz: "Unable to exchange external
// code" gibi bir mesaj, Supabase'in Google ile yaptığı jeton takasının
// başarısız olduğu anlamına gelir. Bu bir bağlantı tazeliği sorunu DEĞİLDİR;
// yeni bağlantı istemek çözmez, sağlayıcı yapılandırması düzeltilmelidir.

export type AuthCallbackParams = {
  code: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

export type AuthCallbackFailure = "provider-config" | "link-error" | "none";

function readParams(source: string) {
  return new URLSearchParams(source.startsWith("?") || source.startsWith("#") ? source.slice(1) : source);
}

/** Hem sorgu dizesini hem hash'i okur; sorgu önceliklidir. */
export function parseAuthCallback(search: string, hash: string): AuthCallbackParams {
  const query = readParams(search);
  const fragment = readParams(hash);
  const pick = (key: string) => query.get(key) ?? fragment.get(key);
  return {
    code: pick("code"),
    error: pick("error"),
    errorCode: pick("error_code"),
    errorDescription: pick("error_description"),
  };
}

/**
 * Hatanın sağlayıcı yapılandırmasından mı yoksa bağlantının kendisinden mi
 * kaynaklandığını söyler. Ayrım önemli: ilkinde kullanıcıya "yeni bağlantı
 * iste" demek yanlış yönlendirmedir, çünkü tekrar denemek hep aynı sonucu verir.
 */
export function classifyAuthFailure(params: AuthCallbackParams): AuthCallbackFailure {
  if (!params.error && !params.errorDescription) return "none";
  const description = (params.errorDescription || "").toLocaleLowerCase("en-US");
  const providerSignals = [
    "exchange external code",
    "invalid_client",
    "invalid_grant",
    "redirect_uri_mismatch",
    "unauthorized_client",
  ];
  if (params.errorCode === "unexpected_failure" || providerSignals.some((signal) => description.includes(signal))) {
    return "provider-config";
  }
  return "link-error";
}
