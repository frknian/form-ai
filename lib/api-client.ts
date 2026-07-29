"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Korumalı API uç noktalarına, oturumdaki Supabase erişim jetonunu ekleyerek istek gönderir.
 * Jeton yoksa istek yine gönderilir; sunucu 401 ile yanıtlar ve arayüz bunu kullanıcıya bildirir.
 */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient();
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
