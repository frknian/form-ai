"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isVerifiedAuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    let redirectTimer: number | undefined;

    async function hasVerifiedSession(supabase: SupabaseClient) {
      const { data } = await supabase.auth.getUser();
      return isVerifiedAuthUser(data.user);
    }

    function finishAuthentication() {
      if (!active) return;
      setCompleted(true);
      redirectTimer = window.setTimeout(() => window.location.replace("/"), 450);
    }

    async function completeAuthentication() {
      const params = new URLSearchParams(window.location.search);
      const supabase = createClient();
      if (!supabase) {
        if (active) setError("Güvenli giriş servisine ulaşılamadı.");
        return;
      }

      // Supabase tarayıcı istemcisi PKCE kodunu sayfa açılırken otomatik olarak
      // işlemiş olabilir. Kodu ikinci kez kullanmadan önce oturumu kontrol et.
      if (await hasVerifiedSession(supabase)) {
        finishAuthentication();
        return;
      }

      const callbackError = params.get("error_description") || params.get("error");
      if (callbackError) {
        if (active) setError("Giriş bağlantısı tamamlanamadı. Yeni bir doğrulama bağlantısı isteyip tekrar deneyebilirsin.");
        return;
      }

      const code = params.get("code");
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          // Otomatik kod değişimi ile manuel değişim yarıştıysa işlem başarılıdır.
          if (await hasVerifiedSession(supabase)) {
            finishAuthentication();
            return;
          }
          if (active) setError("Doğrulama bağlantısının süresi dolmuş veya bağlantı daha önce kullanılmış. Giriş ekranından yeni bağlantı iste.");
          return;
        }
        if (isVerifiedAuthUser(data.user)) {
          finishAuthentication();
          return;
        }
      }

      if (await hasVerifiedSession(supabase)) {
        finishAuthentication();
        return;
      }
      if (active) setError("E-posta adresi doğrulanamadı. Giriş ekranından yeni bir doğrulama bağlantısı iste.");
    }
    void completeAuthentication();
    return () => {
      active = false;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, []);

  return <main className="auth-shell auth-loading"><section className="auth-status-card"><div className="auth-loading-mark">↗</div>{error ? <><h1>Doğrulama tamamlanamadı</h1><p>{error}</p><Link href="/">Giriş ekranına dön</Link></> : completed ? <><h1>E-posta doğrulandı</h1><p>Güvenli oturumun açıldı. Uygulamaya yönlendiriliyorsun…</p></> : <><h1>Hesabın doğrulanıyor</h1><p>Lütfen bu pencereyi kapatma…</p></>}</section></main>;
}
