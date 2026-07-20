"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function completeAuthentication() {
      const params = new URLSearchParams(window.location.search);
      const callbackError = params.get("error_description") || params.get("error");
      if (callbackError) {
        if (active) setError("Giriş bağlantısı tamamlanamadı. Ana sayfadan tekrar deneyebilirsin.");
        return;
      }

      const code = params.get("code");
      const supabase = createClient();
      if (!supabase) {
        if (active) setError("Güvenli giriş servisine ulaşılamadı.");
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError("Doğrulama bağlantısının süresi dolmuş veya bağlantı daha önce kullanılmış olabilir.");
          return;
        }
      }
      window.location.replace("/");
    }
    void completeAuthentication();
    return () => { active = false; };
  }, []);

  return <main className="auth-shell auth-loading"><div className="auth-loading-mark">↗</div>{error ? <><strong>Doğrulama tamamlanamadı</strong><span>{error}</span><Link href="/">Giriş ekranına dön</Link></> : <><strong>Hesabın doğrulanıyor</strong><span>Lütfen bu pencereyi kapatma…</span></>}</main>;
}
