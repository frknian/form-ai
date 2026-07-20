"use client";

import { FormEvent, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

type AuthMode = "signup" | "login";

function callbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function friendlyAuthError(message: string) {
  const normalized = message.toLocaleLowerCase("tr-TR");
  if (normalized.includes("invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (normalized.includes("email not confirmed")) return "Önce e-posta adresine gönderdiğimiz bağlantıyı doğrula.";
  if (normalized.includes("user already registered") || normalized.includes("already been registered")) return "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.";
  if (normalized.includes("password should be")) return "Şifren en az 8 karakter olmalı.";
  if (normalized.includes("rate limit")) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  return "İşlem tamamlanamadı. Bilgilerini kontrol edip tekrar dene.";
}

export function AuthScreen({ status, onSignedIn }: { status: "loading" | "anonymous" | "unavailable"; onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setPassword("");
    setPasswordAgain("");
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (mode === "signup" && password !== passwordAgain) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }
    if (password.length < 8) {
      setError("Şifren en az 8 karakter olmalı.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Güvenli giriş servisi şu anda yapılandırılmamış.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (signUpError) throw signUpError;
        if (data.session?.user) {
          onSignedIn(data.session.user);
          return;
        }
        setNotice("Doğrulama bağlantısını e-posta adresine gönderdik. Gelen kutunu ve spam klasörünü kontrol et.");
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        if (data.user) onSignedIn(data.user);
      }
    } catch (authError) {
      setError(friendlyAuthError(authError instanceof Error ? authError.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setNotice("");
    const supabase = createClient();
    if (!supabase) {
      setError("Güvenli giriş servisi şu anda yapılandırılmamış.");
      return;
    }
    setBusy(true);
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(), queryParams: { access_type: "offline", prompt: "consent" } },
    });
    if (googleError) {
      setError(friendlyAuthError(googleError.message));
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: resendError } = supabase
      ? await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: callbackUrl() } })
      : { error: new Error("Supabase yapılandırılmamış") };
    setBusy(false);
    if (resendError) setError(friendlyAuthError(resendError.message));
    else setNotice("Yeni doğrulama bağlantısını gönderdik.");
  }

  if (status === "loading") {
    return <main className="auth-shell auth-loading"><div className="auth-loading-mark">↗</div><strong>Güvenli hesabın hazırlanıyor</strong><span>Oturum bilgilerin kontrol ediliyor…</span></main>;
  }

  return (
    <main className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <section className="auth-layout">
        <div className="auth-story">
          <div className="auth-brand"><span className="brand-mark">↗</span><span>form<span className="brand-dot">.</span>ai</span></div>
          <div><div className="eyebrow">KİŞİSEL ANTRENMAN · GÜVENLİ HESAP</div><h1>Programın seninle<br /><em>birlikte gelişsin.</em></h1><p>Profilin, test cevapların ve antrenman geçmişin yalnızca kendi hesabına bağlanır. Böylece planın her girişinde kaldığı yerden devam eder.</p></div>
          <div className="auth-benefits"><span>01</span><p><strong>E-posta doğrulaması</strong><small>Hesabını senden başkası oluşturamasın.</small></p><span>02</span><p><strong>Kişisel ilerleme</strong><small>Antrenman verilerin kullanıcı hesabına bağlı kalsın.</small></p></div>
        </div>

        <div className="auth-panel">
          <div className="auth-tabs" role="tablist" aria-label="Hesap işlemi">
            <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Üye ol</button>
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Giriş yap</button>
          </div>
          <div className="auth-panel-heading"><span>{mode === "signup" ? "ÜCRETSİZ HESAP" : "TEKRAR HOŞ GELDİN"}</span><h2>{mode === "signup" ? "Önce hesabını oluşturalım." : "Programına devam et."}</h2><p>{mode === "signup" ? "Doğrulamadan sonra kişisel profil testin başlayacak." : "Kayıtlı e-posta ve şifrenle giriş yap."}</p></div>

          {status === "unavailable" ? <div className="auth-message error" role="alert">Güvenli giriş servisi yapılandırılmamış. Supabase ortam değişkenlerini kontrol et.</div> : <>
            <button type="button" className="google-auth-button" onClick={() => void handleGoogleSignIn()} disabled={busy}><span aria-hidden="true">G</span> Google ile devam et</button>
            <div className="auth-divider"><span>veya e-posta ile</span></div>
            <form className="auth-form" onSubmit={handleEmailAuth}>
              <label>E-posta adresin<input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@gmail.com" /></label>
              <label>Şifren<input type="password" name="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="En az 8 karakter" /></label>
              {mode === "signup" && <label>Şifreni tekrar yaz<input type="password" name="password-confirmation" autoComplete="new-password" minLength={8} required value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} placeholder="Şifreni doğrula" /></label>}
              {error && <div className="auth-message error" role="alert">{error}</div>}
              {notice && <div className="auth-message success" role="status"><strong>E-postanı kontrol et</strong><span>{notice}</span><button type="button" onClick={() => void resendVerification()} disabled={busy}>Bağlantıyı yeniden gönder</button></div>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? "İşleniyor…" : mode === "signup" ? "Hesabımı oluştur" : "Giriş yap"}<span>→</span></button>
            </form>
          </>}
          <p className="auth-privacy">Devam ederek verilerinin yalnızca kişisel planın ve ilerleme takibin için işlenmesini kabul edersin.</p>
        </div>
      </section>
    </main>
  );
}
