import { authenticateRequest } from "@/lib/api-auth";
import { nutritionUserClient } from "@/lib/nutrition-log";

export const runtime = "edge";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(_request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Besin kimliği geçersiz." }, { status: 400 });
  }
  const client = nutritionUserClient(_request);
  if (!client) return Response.json({ error: "Besin kataloğu yapılandırılmamış." }, { status: 503 });
  const { data, error } = await client
    .from("foods")
    .select("id,display_name_tr,brand,barcode,category,source,source_url,image_url,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,serving_size_grams,serving_label,data_quality,food_aliases(alias,language)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return Response.json({ error: "Besin bulunamadı." }, { status: 404 });
  return Response.json({ food: data }, { headers: { "Cache-Control": "private, max-age=300" } });
}
