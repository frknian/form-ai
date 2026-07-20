import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const licenseUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/LICENSE.md";
const imageBaseUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const sourceArgument = process.argv.find((argument) => argument.startsWith("--source="))?.slice(9);

const targetMuscles = [
  ["chest", 8],
  ["lats", 5],
  ["middle back", 5],
  ["shoulders", 8],
  ["biceps", 8],
  ["triceps", 8],
  ["abdominals", 8],
  ["quadriceps", 8],
  ["hamstrings", 8],
  ["glutes", 8],
  ["calves", 8],
];

const preferredTerms = /push-up|press|fly|row|pull-up|pulldown|raise|curl|extension|dip|crunch|plank|squat|lunge|deadlift|bridge|calf|leg/i;
const safeId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");

async function sourceData() {
  if (sourceArgument) return JSON.parse(await readFile(sourceArgument, "utf8"));
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error(`Exercise data download failed: ${response.status}`);
  return response.json();
}

function chooseExercises(source) {
  const selected = [];
  for (const [muscle, count] of targetMuscles) {
    const matches = source
      .filter((exercise) => Array.isArray(exercise.primaryMuscles) && exercise.primaryMuscles.includes(muscle) && Array.isArray(exercise.images) && exercise.images.length > 0)
      .sort((a, b) => Number(preferredTerms.test(b.name || "")) - Number(preferredTerms.test(a.name || "")) || String(a.level).localeCompare(String(b.level)) || String(a.name).localeCompare(String(b.name)));
    for (const exercise of matches) {
      if (selected.some((item) => item.id === exercise.id)) continue;
      selected.push(exercise);
      if (selected.filter((item) => item.primaryMuscles?.includes(muscle)).length >= count) break;
    }
  }
  return selected;
}

async function downloadImage(sourcePath, localPath) {
  const response = await fetch(`${imageBaseUrl}/${sourcePath.split("/").map(encodeURIComponent).join("/")}`);
  if (!response.ok) throw new Error(`Exercise image download failed: ${sourcePath} (${response.status})`);
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
}

const source = await sourceData();
const selected = chooseExercises(source);
const normalized = selected.map((exercise) => {
  const id = safeId(exercise.id);
  const images = (Array.isArray(exercise.images) ? exercise.images : []).slice(0, 2).map((image) => `/exercise-images/${id}/${basename(image)}`);
  return {
    id,
    name: String(exercise.name || id.replaceAll("_", " ")),
    force: typeof exercise.force === "string" ? exercise.force : null,
    level: typeof exercise.level === "string" ? exercise.level : "beginner",
    mechanic: typeof exercise.mechanic === "string" ? exercise.mechanic : null,
    equipment: typeof exercise.equipment === "string" ? exercise.equipment : null,
    primaryMuscles: Array.isArray(exercise.primaryMuscles) ? exercise.primaryMuscles.map(String) : [],
    secondaryMuscles: Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles.map(String) : [],
    instructions: Array.isArray(exercise.instructions) ? exercise.instructions.map(String).filter(Boolean) : [],
    category: typeof exercise.category === "string" ? exercise.category : "strength",
    images,
  };
});

await Promise.all(selected.flatMap((exercise) => {
  const id = safeId(exercise.id);
  return exercise.images.slice(0, 2).map((image) => downloadImage(image, join(root, "public", "exercise-images", id, basename(image))));
}));

await mkdir(join(root, "data"), { recursive: true });
await writeFile(join(root, "data", "exercises.json"), `${JSON.stringify(normalized, null, 2)}\n`);
const licenseResponse = await fetch(licenseUrl);
if (!licenseResponse.ok) throw new Error(`License download failed: ${licenseResponse.status}`);
await writeFile(join(root, "data", "FREE_EXERCISE_DB_LICENSE.md"), await licenseResponse.text());
console.log(`Imported ${normalized.length} exercises and ${normalized.reduce((total, exercise) => total + exercise.images.length, 0)} images.`);
