import { getExerciseById } from "@/lib/exercise-service";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return context.params.then(({ id }) => {
    const exercise = getExerciseById(id);
    return exercise ? Response.json(exercise) : Response.json({ error: "Egzersiz bulunamadı" }, { status: 404 });
  });
}
