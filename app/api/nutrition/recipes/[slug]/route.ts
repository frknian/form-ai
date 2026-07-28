import { authenticateRequest } from "@/lib/api-auth";
import { calculateStoredRecipeAmount, getPublishedRecipe } from "@/lib/recipe-data";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

function optionalPositive(value: string | null) {
  if (value === null) return undefined;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`recipe-detail:${auth.user.id}`, 60, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return Response.json({ error: "Tarif kimliği geçersiz." }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const grams = optionalPositive(searchParams.get("grams"));
  const portions = optionalPositive(searchParams.get("portions"));
  if (grams === null || portions === null || (grams !== undefined && portions !== undefined)) {
    return Response.json({ error: "Gram veya porsiyon değerlerinden yalnızca birini geçerli biçimde girin." }, { status: 400 });
  }

  const recipe = await getPublishedRecipe(request, slug, searchParams.get("version"));
  if (!recipe) return Response.json({ error: "Yayınlanmış tarif bulunamadı." }, { status: 404 });
  try {
    const per100g = calculateStoredRecipeAmount(recipe.version, { grams: 100 });
    const perPortion = calculateStoredRecipeAmount(recipe.version, { portions: 1 });
    const selected = calculateStoredRecipeAmount(recipe.version, { grams, portions });
    return Response.json({
      recipe: {
        ...recipe.dish,
        recipeVersionId: recipe.version.id,
        version: recipe.version.version,
        variantName: recipe.version.variant_name,
        defaultPortionGrams: Number(recipe.version.default_portion_grams),
        cookedWeightGrams: Number(recipe.version.cooked_weight_grams),
        confidenceLevel: recipe.version.confidence_level,
        calculationMethod: recipe.version.calculation_method,
        ingredients: recipe.ingredients,
        source: recipe.source,
        calculationHistory: recipe.calculationRuns,
      },
      per100g,
      perPortion,
      selected,
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "Tarif besin değerleri hesaplanamadı." }, { status: 422 });
  }
}
