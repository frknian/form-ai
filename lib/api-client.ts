"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Korumalı API uç noktalarına, oturumdaki Supabase erişim jetonunu ekleyerek istek gönderir.
 * Jeton yoksa istek yine gönderilir; sunucu 401 ile yanıtlar ve arayüz bunu kullanıcıya bildirir.
 */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;

  async function send(token?: string) {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");
    return fetch(input, { ...init, headers });
  }

  const response = await send(session?.access_token);
  if (response.status !== 401 || !supabase || !session?.refresh_token) return response;

  // A browser can briefly keep an expired access token after returning from the
  // background. Refresh once and replay the request instead of surfacing a
  // misleading "session could not be verified" error.
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) return response;
  return send(data.session.access_token);
}
