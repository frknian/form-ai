import { authenticateRequest } from "@/lib/api-auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
export const runtime = "edge";

type OpenFoodFactsProduct = {
  product_name?: string;
  product_name_tr?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
};

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const rateLimitResult = rateLimit(`food-barcode:${auth.user.id}`, 40, 60000);
  if (!rateLimitResult.ok) return tooManyRequests(rateLimitResult.retryAfterSeconds);

  const code = new URL(request.url).searchParams.get("code")?.replace(/\D/g, "") || "";
  if (code.length < 8 || code.length > 14) return Response.json({ error: "Geçerli bir barkod girin." }, { status: 400 });
  try {
    const response = await fetch(`https://world.openfoodfacts.net/api/v2/product/${code}.json?fields=product_name,product_name_tr,nutriments`, {
      headers: { "User-Agent": "fit.ai nutrition tracker/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("catalog unavailable");
    const payload = await response.json() as { status?: number; product?: OpenFoodFactsProduct };
    const product = payload.product;
    if (payload.status !== 1 || !product?.nutriments) return Response.json({ error: "Ürün katalogda bulunamadı." }, { status: 404 });
    const nutrients = product.nutriments;
    const calories = Math.round(Number(nutrients["energy-kcal_100g"]) || 0);
    if (!calories) return Response.json({ error: "Bu ürünün kalori bilgisi bulunamadı." }, { status: 422 });
    return Response.json({ name: product.product_name_tr || product.product_name || "Barkodlu ürün", calories, protein: Number(nutrients.proteins_100g) || 0, carbs: Number(nutrients.carbohydrates_100g) || 0, fat: Number(nutrients.fat_100g) || 0, serving: "100 g" });
  } catch {
    return Response.json({ error: "Ürün kataloğuna şu an erişilemiyor." }, { status: 503 });
  }
}
