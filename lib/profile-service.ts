import type { SupabaseClient } from "@supabase/supabase-js";
import { profilePayload, type EditableProfile, type ProfileHistoryEntry } from "@/lib/profile";

type HistoryRow = {
  id: string;
  changed_at: string;
  changed_fields: string[] | null;
  snapshot: Record<string, unknown> | null;
};

export async function saveProfileWithHistory(client: SupabaseClient, profile: EditableProfile) {
  const { error } = await client.rpc("update_profile_with_history", { p_profile: profilePayload(profile) });
  if (error) throw new Error(error.message);
}

export async function loadProfileHistory(client: SupabaseClient, userId: string, limit = 12): Promise<ProfileHistoryEntry[]> {
  const { data, error } = await client.from("profile_history").select("id, changed_at, changed_fields, snapshot").eq("user_id", userId).order("changed_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data || []) as HistoryRow[]).map((row) => {
    const snapshot = row.snapshot || {};
    return {
      id: row.id,
      changedAt: row.changed_at,
      changedFields: Array.isArray(row.changed_fields) ? row.changed_fields.map(String) : [],
      snapshot: {
        displayName: typeof snapshot.display_name === "string" ? snapshot.display_name : "",
        birthDate: typeof snapshot.birth_date === "string" ? snapshot.birth_date : "",
        gender: typeof snapshot.gender === "string" ? snapshot.gender : "",
        heightCm: typeof snapshot.height_cm === "number" ? snapshot.height_cm : null,
        weightKg: typeof snapshot.weight_kg === "number" ? snapshot.weight_kg : null,
        goalText: typeof snapshot.goal_text === "string" ? snapshot.goal_text : "",
        environment: snapshot.environment === "Salon" ? "Salon" : "Evde",
        equipmentText: typeof snapshot.equipment_text === "string" ? snapshot.equipment_text : "",
        requestedExercises: typeof snapshot.requested_exercises === "string" ? snapshot.requested_exercises : "",
        avatarPath: typeof snapshot.avatar_path === "string" ? snapshot.avatar_path : null,
      },
    };
  });
}

export async function signedAvatarUrl(client: SupabaseClient, avatarPath: string | null) {
  if (!avatarPath) return null;
  const { data, error } = await client.storage.from("profile-avatars").createSignedUrl(avatarPath, 60 * 60);
  return error ? null : data.signedUrl;
}
