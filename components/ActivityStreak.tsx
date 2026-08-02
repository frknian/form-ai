"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { userTimeZone } from "@/lib/streak";
import { useTranslations } from "@/lib/i18n/translate";

type StreakRow = { current_streak?: number; last_activity_date?: string; timezone?: string };

/**
 * `compact`: mobil ana ekranın üst satırında selamlamanın yanına sığan mini
 * rozet (🔥 sayı). Büyük kart mobilde tek başına bir blok kaplıyordu; kullanıcı
 * seriyi görmek için ekranı ayrıca kaydırmak zorunda kalıyordu.
 */
export function ActivityStreak({ userId, compact = false }: { userId?: string; compact?: boolean }) {
  const t = useTranslations();
  const [streak, setStreak] = useState(1);
  const [lastActivity, setLastActivity] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase.rpc("ensure_user_streak", { p_timezone: userTimeZone() });
      const row = Array.isArray(data) ? data[0] as StreakRow | undefined : data as StreakRow | null;
      if (cancelled || !row) return;
      setStreak(Math.max(1, Number(row.current_streak) || 1));
      setLastActivity(row.last_activity_date || null);
    }
    function refresh(event: Event) {
      const nextStreak = Number((event as CustomEvent<{ streak?: number }>).detail?.streak);
      if (Number.isFinite(nextStreak) && nextStreak > 0) setStreak(nextStreak);
      void load();
    }
    // İlerleme sıfırlandığında serinin satırı silinir; bu bileşen görünüm
    // değişse de mount kaldığı için haber verilmezse eski seriyi göstermeye
    // devam eder.
    function reload() { void load(); }
    void load();
    window.addEventListener("fit-ai-activity-recorded", refresh);
    window.addEventListener("fit-ai-progress-reset", reload);
    return () => {
      cancelled = true;
      window.removeEventListener("fit-ai-activity-recorded", refresh);
      window.removeEventListener("fit-ai-progress-reset", reload);
    };
  }, [userId]);

  if (compact) return <span className="activity-streak-mini" title={t.streak.days(streak)} aria-label={t.streak.days(streak)}><span aria-hidden="true">🔥</span>{streak}</span>;

  return <section className="activity-streak" aria-labelledby="activity-streak-title"><div><span>✦</span><div><small>{t.streak.label}</small><strong id="activity-streak-title">{t.streak.days(streak)}</strong><p>{lastActivity ? t.streak.sameDayNote : t.streak.freshNote}</p></div></div></section>;
}
