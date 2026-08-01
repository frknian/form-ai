"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  applyPreferences,
  collectPreferences,
  planPreferenceSync,
  sanitizePreferences,
  subscribeToPreferenceChanges,
  type PreferenceBag,
} from "@/lib/preference-sync";

// db/migrations/20260801_user_preferences.sql uygulanmadıysa tablo yoktur.
// Bu durumda tercihler eskisi gibi yalnız bu cihazda kalır; uygulamanın geri
// kalanı etkilenmesin diye hata yüzeye çıkarılmaz, yalnız denemeler durur.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

// Ayarlar ekranında birim değiştirirken her tıklama bir yazma olmasın diye.
const PUSH_DELAY_MS = 600;

function readLocalPreferences(): PreferenceBag {
  return collectPreferences((key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  });
}

/**
 * Tema, dil, birim, hedef kilo ve kısayol tercihlerini hesaba bağlar.
 *
 * Görsel bir çıktısı yoktur: tercihler yine localStorage'dan okunur, bu bileşen
 * yalnız o depoyu sunucuyla eşitler. Böylece mevcut kancaların hiçbiri
 * değişmek zorunda kalmaz ve oturum açılmamışken uygulama aynen çalışır.
 */
export function PreferenceSync({ userId }: { userId?: string }) {
  const unavailable = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;

    async function push(bag: PreferenceBag) {
      if (unavailable.current || cancelled || !Object.keys(bag).length) return;
      const { error } = await supabase!
        .from("user_preferences")
        .upsert({ user_id: userId, prefs: bag, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error && MISSING_TABLE_CODES.has(error.code || "")) unavailable.current = true;
    }

    async function pull() {
      if (unavailable.current || cancelled) return;
      const { data, error } = await supabase!.from("user_preferences").select("prefs").eq("user_id", userId).maybeSingle();
      if (cancelled) return;
      if (error) {
        if (MISSING_TABLE_CODES.has(error.code || "")) unavailable.current = true;
        return;
      }
      const plan = planPreferenceSync(data ? sanitizePreferences(data.prefs) : null, readLocalPreferences());
      applyPreferences(plan.applyLocal);
      if (plan.push) await push(plan.push);
    }

    void pull();

    let timer = 0;
    const unsubscribe = subscribeToPreferenceChanges(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void push(readLocalPreferences()), PUSH_DELAY_MS);
    });

    // Diğer cihazda yapılan değişiklik, sekmeye geri dönüldüğünde görünsün.
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return null;
}
