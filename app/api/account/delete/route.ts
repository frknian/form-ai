import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../../../../lib/supabase/url.ts";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function POST(request: Request) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey) return Response.json({ error: "Hesap silme servisi yapılandırılmamış." }, { status: 503 });

  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Güvenli oturum bulunamadı." }, { status: 401 });

  let payload: { confirmation?: string; email?: string };
  try {
    payload = await request.json() as { confirmation?: string; email?: string };
  } catch {
    return Response.json({ error: "Silme onayı okunamadı." }, { status: 400 });
  }
  if (payload.confirmation !== "HESABIMI SİL") return Response.json({ error: "Silme onayı eşleşmiyor." }, { status: 400 });

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await authClient.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Oturum doğrulanamadı." }, { status: 401 });
  if (!user.email || payload.email?.trim().toLocaleLowerCase("tr-TR") !== user.email.toLocaleLowerCase("tr-TR")) {
    return Response.json({ error: "E-posta onayı hesapla eşleşmiyor." }, { status: 400 });
  }

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: avatarObjects } = await admin.storage.from("profile-avatars").list(user.id, { limit: 100 });
  if (avatarObjects?.length) {
    await admin.storage.from("profile-avatars").remove(avatarObjects.map((item) => `${user.id}/${item.name}`));
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[account-delete] user deletion failed", { userId: user.id, code: deleteError.code });
    return Response.json({ error: "Hesap verileri silinemedi. Lütfen yeniden dene." }, { status: 500 });
  }
  return Response.json({ deleted: true });
}
