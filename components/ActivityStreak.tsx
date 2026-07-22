"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { userTimeZone } from "@/lib/streak";

type StreakRow = { current_streak?: number; last_activity_date?: string; timezone?: string };

export function ActivityStreak({ userId }: { userId?: string }) {
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
    void load();
    window.addEventListener("fit-ai-activity-recorded", refresh);
    return () => { cancelled = true; window.removeEventListener("fit-ai-activity-recorded", refresh); };
  }, [userId]);

  return <section className="activity-streak" aria-labelledby="activity-streak-title"><div><span>✦</span><div><small>AKTİF SERİ</small><strong id="activity-streak-title">{streak} gün</strong><p>{lastActivity ? "Aynı gün içindeki ek kayıtlar seriyi artırmaz." : "Bugünle başlayan serin hazır."}</p></div></div></section>;
}
