import type { User } from "@supabase/supabase-js";

export function isVerifiedAuthUser(user: User | null | undefined): user is User {
  if (!user) return false;

  // E-posta/parola hesaplarında Supabase'in doğrulama zamanını zorunlu tutarız.
  // Google ise e-posta doğrulamasını sağlayıcıdan alır; bazı OAuth dönüşlerinde
  // `email_confirmed_at` oturum yenilenene kadar boş kalabildiği için bu hesabı
  // yanlışlıkla giriş ekranına geri göndermemeliyiz.
  if (user.email_confirmed_at) return true;

  return user.identities?.some((identity) => {
    const emailVerified = identity.identity_data?.email_verified;
    return identity.provider === "google" && (emailVerified === true || emailVerified === "true");
  }) ?? false;
}
