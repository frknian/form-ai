export type AccountStatus = "active" | "frozen" | "deletion_pending";

export type EditableProfile = {
  displayName: string;
  birthDate: string;
  gender: string;
  heightCm: number | null;
  weightKg: number | null;
  goalText: string;
  environment: "Evde" | "Salon";
  equipmentText: string;
  requestedExercises: string;
  avatarPath: string | null;
};

export type ProfileHistoryEntry = {
  id: string;
  changedAt: string;
  changedFields: string[];
  snapshot: EditableProfile;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

export function calculateAge(birthDate: string, at = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  let age = at.getFullYear() - year;
  const birthdayPassed = at.getMonth() + 1 > month || (at.getMonth() + 1 === month && at.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export function isValidBirthDate(value: string, at = new Date()) {
  const age = calculateAge(value, at);
  return age !== null && age >= 5;
}

export function isBirthday(birthDate: string, at = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month === 2 && day === 29 && at.getMonth() === 1 && at.getDate() === 28) {
    const year = at.getFullYear();
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return !leapYear;
  }
  return at.getMonth() + 1 === month && at.getDate() === day;
}

export function birthdayPremiumAccess(birthDate: string, flag: FeatureFlag | null, at = new Date()) {
  return Boolean(flag?.key === "birthday_premium_day" && flag.enabled && isBirthday(birthDate, at));
}

export function profileHistoryLabel(field: string) {
  const labels: Record<string, string> = {
    display_name: "Ad",
    birth_date: "Doğum tarihi",
    gender: "Cinsiyet",
    height_cm: "Boy",
    weight_kg: "Kilo",
    goal_text: "Hedef",
    environment: "Antrenman ortamı",
    equipment_text: "Ekipmanlar",
    requested_exercises: "İstenen hareketler",
    avatar_path: "Profil fotoğrafı",
  };
  return labels[field] || field;
}

export function profilePayload(profile: EditableProfile) {
  return {
    display_name: profile.displayName.trim() || "Sporcu",
    birth_date: profile.birthDate || null,
    gender: profile.gender,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    goal_text: profile.goalText.trim(),
    environment: profile.environment,
    equipment_text: profile.equipmentText.trim(),
    requested_exercises: profile.requestedExercises.trim(),
    avatar_path: profile.avatarPath,
  };
}
