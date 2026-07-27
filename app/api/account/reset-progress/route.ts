import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const PROGRESS_TABLES = [
  "weekly_ai_reviews",
  "food_entries",
  "sport_activity_entries",
  "activity_logs",
  "user_streaks",
  "body_measurements",
  "workout_sessions",
] as const;

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey) return Response.json({ error: "İlerleme sıfırlama servisi yapılandırılmamış." }, { status: 503 });

  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Güvenli oturum bulunamadı." }, { status: 401 });

  let payload: { confirmation?: string };
  try {
    payload = await request.json() as { confirmation?: string };
  } catch {
    return Response.json({ error: "Sıfırlama onayı okunamadı." }, { status: 400 });
  }
  if (payload.confirmation !== "RESET_PROGRESS") return Response.json({ error: "Sıfırlama onayı eşleşmiyor." }, { status: 400 });

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await authClient.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Oturum doğrulanamadı." }, { status: 401 });

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const table of PROGRESS_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      console.error("[progress-reset] deletion failed", { table, userId: user.id, code: error.code });
      return Response.json({ error: "İlerleme verileri sıfırlanamadı. Lütfen tekrar dene." }, { status: 500 });
    }
  }

  return Response.json({ reset: true });
}
