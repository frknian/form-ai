import { filterExercises } from "@/lib/exercise-service";

const safeParam = (value: string | null) => (value || "").trim().slice(0, 100);

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Math.min(1000, Number.parseInt(searchParams.get("page") || "1", 10) || 1));
  const limit = Math.max(1, Math.min(48, Number.parseInt(searchParams.get("limit") || "24", 10) || 24));
  const items = filterExercises({ search: safeParam(searchParams.get("search")), muscle: safeParam(searchParams.get("muscle")), equipment: safeParam(searchParams.get("equipment")), level: safeParam(searchParams.get("level")), category: safeParam(searchParams.get("category")) });
  const offset = (page - 1) * limit;
  return Response.json({ items: items.slice(offset, offset + limit), page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) });
}
