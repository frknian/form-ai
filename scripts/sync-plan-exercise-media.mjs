import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const imageBaseUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const sourceArgument = process.argv.find((argument) => argument.startsWith("--source="))?.slice(9);
const auditOnly = process.argv.includes("--audit");

// App names that differ from Free Exercise DB naming. Each entry was selected
// by movement pattern first, then equipment and primary muscle.
const sourceNameByAppName = {
  "Hip Lift with Band": "Hip Lift with Band",
  "Kettlebell Swing": "One-Arm Kettlebell Swings",
  "Cable Pull Through": "Pull Through",
  "Hip Abduction": "Thigh Abductor",
  "Single-leg Hip Thrust": "Single Leg Glute Bridge",
  "Side Plank": "Side Bridge",
  "Lying Leg Raise": "Flat Bench Lying Leg Raise",
  "Dumbbell Hammer Curl": "Alternate Hammer Curl",
  "Concentration Curl": "Concentration Curls",
  "Cable Triceps Pushdown": "Triceps Pushdown - V-Bar Attachment",
  "Overhead Dumbbell Triceps Extension": "Cable Rope Overhead Triceps Extension",
  "Reverse Curl": "Standing Dumbbell Reverse Curl",
  "Wrist Curl": "Palms-Up Barbell Wrist Curl Over A Bench",
  "Neck Side Stretch": "Side Neck Stretch",
  "Doorway Chest Stretch": "Dynamic Chest Stretch",
  "Standing Quad Stretch": "On Your Side Quad Stretch",
  "Seated Spinal Twist": "Spinal Stretch",
  "Wall Calf Stretch": "Calf Stretch Hands Against Wall",
  "Cross-body Shoulder Stretch": "Shoulder Stretch",
  "Overhead Triceps Stretch": "Triceps Stretch",
  "Knee to Chest Stretch": "One Knee To Chest",
  "Dumbbell Row": "One-Arm Dumbbell Row",
  "Glute Bridge": "Butt Lift (Bridge)",
  "Reverse Lunge": "Dumbbell Rear Lunge",
  "Resistance Band Row": "Inverted Row with Straps",
  "Push-up": "Pushups",
  "Bulgarian Split Squat": "Split Squat with Dumbbells",
  "Mountain Climber": "Mountain Climbers",
  "Step-up": "Step-up with Knee Raise",
  "Lat Pulldown": "Close-Grip Front Lat Pulldown",
  "Flat Dumbbell Press": "Dumbbell Bench Press",
  "Barbell Bench Press": "Barbell Bench Press - Medium Grip",
  "Incline Barbell Bench Press": "Barbell Incline Bench Press - Medium Grip",
  "Knee Push-up": "Incline Push-Up Medium",
  "Wide Push-up": "Push-Up Wide",
  "Diamond Push-up": "Push-Ups - Close Triceps Position",
  "Archer Push-up": "Single-Arm Push-Up",
  "Cable Chest Fly": "Cable Crossover",
  "Dumbbell Fly": "Dumbbell Flyes",
  "Pec Deck Fly": "Butterfly",
  "Dumbbell Pullover": "Bent-Arm Dumbbell Pullover",
  "Close Grip Bench Press": "Close-Grip Barbell Bench Press",
  "Landmine Press": "Landmine Linear Jammer",
  "Chest Dips": "Dips - Chest Version",
  "Assisted Chest Dips": "Dip Machine",
  "Barbell Row": "Bent Over Barbell Row",
  "Pendlay Row": "Bent Over Barbell Row",
  "One Arm Cable Row": "Kneeling Single-Arm High Pulley Row",
  "Seated Cable Row": "Seated Cable Rows",
  "Chest Supported Row": "Dumbbell Incline Row",
  "T-Bar Row": "T-Bar Row with Handle",
  "TRX Row": "Inverted Row with Straps",
  "Pull-up": "Pullups",
  "Assisted Pull-up": "Band Assisted Pull-Up",
  "Negative Pull-up": "Pullups",
  "Single Arm Lat Pulldown": "One Arm Lat Pulldown",
  "Cable Pullover": "Straight-Arm Pulldown",
  "Back Extension": "Hyperextensions (Back Extensions)",
  "Dumbbell Reverse Fly": "Bent Over Dumbbell Rear Delt Raise With Head On Bench",
  "Arnold Press": "Arnold Dumbbell Press",
  "Barbell Overhead Press": "Barbell Shoulder Press",
  "Landmine Shoulder Press": "Landmine Linear Jammer",
  "Machine Shoulder Press": "Leverage Shoulder Press",
  "Dumbbell Lateral Raise": "Side Lateral Raise",
  "Cable Lateral Raise": "Cable Seated Lateral Raise",
  "Dumbbell Front Raise": "Front Dumbbell Raise",
  "Plate Front Raise": "Front Plate Raise",
  "Rear Delt Fly": "Cable Rear Delt Fly",
  "Upright Row": "Standing Dumbbell Upright Row",
  "Cuban Rotation": "Cuban Press",
  "Scaption": "Dumbbell Scaption",
  "Pike Push-up": "Handstand Push-Ups",
  "Handstand Hold": "Handstand Push-Ups",
  "Dumbbell Curl": "Seated Dumbbell Curl",
  "Hammer Curl": "Hammer Curls",
  "Concentration Curl": "Concentration Curls",
  "Cable Curl": "Standing Biceps Cable Curl",
  "Reverse Curl": "Reverse Barbell Curl",
  "Rope Triceps Pushdown": "Triceps Pushdown - Rope Attachment",
  "Overhead Triceps Extension": "Standing Dumbbell Triceps Extension",
  "Dumbbell Skull Crusher": "Lying Triceps Press",
  "Close Grip Push-up": "Push-Ups - Close Triceps Position",
  "Bench Dip": "Bench Dips",
  "Triceps Kickback": "Tricep Dumbbell Kickback",
  "Barbell Back Squat": "Barbell Squat",
  "Front Squat": "Front Squat (Clean Grip)",
  "Split Squat": "Split Squat with Dumbbells",
  "Sumo Squat": "Plie Dumbbell Squat",
  "Jump Squat": "Freehand Jump Squat",
  "Wall Sit": "Chair Squat",
  "Stiff Leg Deadlift": "Stiff-Legged Barbell Deadlift",
  "Conventional Deadlift": "Barbell Deadlift",
  "Hip Thrust": "Barbell Hip Thrust",
  "Frog Pump": "Butt Lift (Bridge)",
  "Fire Hydrant": "Hip Extension with Bands",
  "Donkey Kick": "Glute Kickback",
  "Cable Glute Kickback": "One-Legged Cable Kickback",
  "Leg Extension": "Leg Extensions",
  "Lying Leg Curl": "Lying Leg Curls",
  "Nordic Curl": "Natural Glute Ham Raise",
  "Standing Calf Raise": "Standing Calf Raises",
  "Tibialis Raise": "Anterior Tibialis-SMR",
  "Cossack Squat": "Barbell Side Split Squat",
  "Curtsy Lunge": "Crossover Reverse Lunge",
  "Walking Lunge": "Bodyweight Walking Lunge",
  "Lateral Lunge": "Barbell Side Split Squat",
  "Box Jump": "Front Box Jump",
  "Crunch": "Crunches",
  "Bicycle Crunch": "Cross-Body Crunch",
  "Side Plank": "Side Bridge",
  "Hollow Body Hold": "Plank",
  "V-Up": "Jackknife Sit-Up",
  "Leg Raise": "Flat Bench Lying Leg Raise",
  "Hanging Knee Raise": "Knee/Hip Raise On Parallel Bars",
  "Cable Woodchop": "Standing Cable Wood Chop",
  "Ab Wheel Rollout": "Barbell Ab Rollout - On Knees",
  "Bear Crawl": "Bear Crawl Sled Drags",
  "Burpee": "Mountain Climbers",
  "Jumping Jack": "Star Jump",
  "High Knees": "Lunge Sprint",
  "Butt Kicks": "Double Leg Butt Kick",
  "Skater": "Lateral Bound",
  "Squat Thrust": "Mountain Climbers",
  "Bear Plank": "Plank",
  "Hollow Rock": "Jackknife Sit-Up",
  "Dead Hang": "One Handed Hang",
  "Cat Cow": "Cat Stretch",
  "Downward Dog": "Downward Facing Balance",
  "Hip Flexor Stretch": "Kneeling Hip Flexor",
  "90/90 Hip Switch": "90/90 Hamstring",
  "Thoracic Rotation": "Torso Rotation",
  "Shoulder Dislocate": "Shoulder Circles",
  "Ankle Rocker": "Ankle Circles",
  "Glute Stretch": "IT Band and Glute Stretch",
  "Pigeon Stretch": "IT Band and Glute Stretch",
  "Cobra Stretch": "Cat Stretch",
  "Wrist Stretch": "Wrist Circles",
};

const normalize = (value) => String(value || "")
  .toLocaleLowerCase("en-US")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const safeId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");

async function sourceData() {
  if (sourceArgument) return JSON.parse(await readFile(sourceArgument, "utf8"));
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error(`Exercise data download failed: ${response.status}`);
  return response.json();
}

function appExercises(page) {
  const core = page.slice(page.indexOf("const coreExerciseLibrary"), page.indexOf("const additionalExerciseDefinitions"));
  const additional = page.slice(page.indexOf("const additionalExerciseDefinitions"), page.indexOf("const additionalExerciseLibrary"));
  const exercises = [];
  for (const match of core.matchAll(/\{\s*name:\s*"([^"]+)",\s*english:\s*"([^"]+)"/g)) exercises.push({ name: match[1], english: match[2] });
  for (const match of additional.matchAll(/^\s*\["([^"]+)",\s*"([^"]+)"/gm)) exercises.push({ name: match[1], english: match[2] });
  return exercises;
}

async function downloadImage(sourcePath, localPath) {
  try {
    await access(localPath);
    return;
  } catch {
    // Download only files that are not already packaged locally.
  }
  const encodedPath = sourcePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${imageBaseUrl}/${encodedPath}`);
  if (!response.ok) throw new Error(`Exercise image download failed: ${sourcePath} (${response.status})`);
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
}

const page = await readFile(join(root, "app", "page.tsx"), "utf8");
const source = await sourceData();
const sourceByName = new Map(source.map((exercise) => [normalize(exercise.name), exercise]));
const missing = [];
const mappings = {};

for (const appExercise of appExercises(page)) {
  const requestedSourceName = sourceNameByAppName[appExercise.english] || appExercise.english;
  const sourceExercise = sourceByName.get(normalize(requestedSourceName));
  if (!sourceExercise || !Array.isArray(sourceExercise.images) || sourceExercise.images.length < 2) {
    missing.push({ ...appExercise, requestedSourceName });
    continue;
  }
  const id = safeId(sourceExercise.id);
  const images = sourceExercise.images.slice(0, 2).map((image) => `/exercise-images/${id}/${basename(image)}`);
  const mapping = { sourceId: id, sourceName: sourceExercise.name, images };
  mappings[normalize(appExercise.name)] = mapping;
  mappings[normalize(appExercise.english)] = mapping;

  if (!auditOnly) {
    await Promise.all(sourceExercise.images.slice(0, 2).map((image) => downloadImage(
      image,
      join(root, "public", "exercise-images", id, basename(image)),
    )));
  }
}

const uniqueExercises = new Set(Object.values(mappings).map((mapping) => mapping.sourceId));
const report = {
  appExerciseCount: appExercises(page).length,
  mappedExerciseCount: appExercises(page).length - missing.length,
  uniqueSourceExerciseCount: uniqueExercises.size,
  missing,
};

if (!auditOnly) {
  await mkdir(join(root, "data"), { recursive: true });
  await writeFile(join(root, "data", "plan-exercise-media.json"), `${JSON.stringify(mappings, null, 2)}\n`);
  await writeFile(join(root, "data", "plan-exercise-media-report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (missing.length > 0) process.exitCode = 1;
