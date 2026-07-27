"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { userTimeZone } from "@/lib/streak";
import { useTranslations } from "@/lib/i18n/translate";

type StreakRow = { current_streak?: number; last_activity_date?: string; timezone?: string };

export function ActivityStreak({ userId }: { userId?: string }) {
  const t = useTranslations();
  const [streak, setStreak] = useState(0);
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
      setStreak(Math.max(0, Number(row.current_streak) || 0));
      setLastActivity(row.last_activity_date || null);
    }
    function refresh(event: Event) {
      const nextStreak = Number((event as CustomEvent<{ streak?: number }>).detail?.streak);
      if (Number.isFinite(nextStreak) && nextStreak > 0) setStreak(nextStreak);
      void load();
    }
    void load();
    window.addEventListener("fit-ai-activity-recorded", refresh);
    window.addEventListener("fit-ai-progress-reset", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("fit-ai-activity-recorded", refresh);
      window.removeEventListener("fit-ai-progress-reset", refresh);
    };
  }, [userId]);

  return <section className="activity-streak" aria-labelledby="activity-streak-title"><div><span>✦</span><div><small>{t.streak.label}</small><strong id="activity-streak-title">{t.streak.days(streak)}</strong><p>{lastActivity ? t.streak.sameDayNote : t.streak.freshNote}</p></div></div></section>;
}
