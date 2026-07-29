import { authenticateRequest } from "@/lib/api-auth";
import { nutritionUserClient } from "@/lib/nutrition-log";

export const runtime = "edge";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(_request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const recipeMatch = id.match(/^recipe-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!recipeMatch && !uuidPattern.test(id)) {
    return Response.json({ error: "Besin kimliği geçersiz." }, { status: 400 });
  }
  const client = nutritionUserClient(_request);
  if (!client) return Response.json({ error: "Besin kataloğu yapılandırılmamış." }, { status: 503 });
  if (recipeMatch) {
    const recipeId = recipeMatch[1];
    const [{ data: recipe, error: recipeError }, { data: ingredients }, { data: calculations }] = await Promise.all([
      client.from("cuisine_recipes")
        .select("id,slug,name,alternative_names,category,canonical_family,variant_summary,region,province,description,servings,cooked_weight_grams,prep_time,cook_time,total_time,recipe_version,calculation_method,confidence,needs_review,catalog_status,allergens,source_url,source_license,source_attribution")
        .eq("id", recipeId)
        .maybeSingle(),
      client.from("cuisine_recipe_ingredients")
        .select("position,amount_text,grams,gram_status,ingredient_food_id")
        .eq("recipe_id", recipeId)
        .order("position"),
      client.from("cuisine_recipe_calculations")
        .select("recipe_version,method,output_snapshot,confidence,created_at")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (recipeError || !recipe) return Response.json({ error: "Tarif bulunamadı." }, { status: 404 });
    return Response.json({
      recipe: {
        ...recipe,
        ingredients: ingredients || [],
        calculationHistory: calculations || [],
      },
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  }
  const { data, error } = await client
    .from("foods")
    .select("id,display_name_tr,brand,barcode,category,source,source_url,image_url,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,serving_size_grams,serving_label,data_quality,food_aliases(alias,language)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return Response.json({ error: "Besin bulunamadı." }, { status: 404 });
  return Response.json({ food: data }, { headers: { "Cache-Control": "private, max-age=300" } });
}
