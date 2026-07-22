import type { SupabaseClient } from "@supabase/supabase-js";

export type CoreActivityKind = "walking" | "running" | "cycling" | "swimming";
export type ActivitySource = "manual" | "gps" | "strava" | "wearable";

export type ActivityEntry = {
  id: string;
  activityType: "walk" | "sport";
  activityKey: string;
  activityName: string;
  occurredAt: string;
  localDate: string;
  durationMinutes: number;
  distanceKm: number | null;
  estimatedCalories: number | null;
  steps: number | null;
  intensity: "hafif" | "orta" | "yuksek";
  notes: string | null;
  source: ActivitySource;
  provider: string | null;
  externalActivityId: string | null;
  routeReference: string | null;
  metadata: Record<string, unknown>;
  schemaVersion: number;
};

export type CreateActivityInput = Omit<ActivityEntry, "id" | "source" | "provider" | "externalActivityId" | "routeReference" | "metadata" | "schemaVersion"> & {
  details?: Record<string, number>;
};

export type DailyActivitySummary = {
  localDate: string;
  activityCount: number;
  durationMinutes: number;
  distanceKm: number;
  estimatedCalories: number;
  steps: number;
};

export interface ActivityRepository {
  create(input: CreateActivityInput): Promise<ActivityEntry>;
  list(limit?: number): Promise<ActivityEntry[]>;
}

type ActivityRow = {
  id: string;
  activity_type: "walk" | "sport";
  sport_key: string;
  sport_name: string;
  occurred_at: string;
  local_date: string;
  duration_minutes: number;
  distance_km: number | null;
  estimated_calories: number | null;
  steps: number | null;
  intensity: "hafif" | "orta" | "yuksek";
  notes: string | null;
  source: ActivitySource;
  provider: string | null;
  external_activity_id: string | null;
  route_reference: string | null;
  metadata: Record<string, unknown> | null;
  schema_version: number;
};

function mapActivityRow(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    activityType: row.activity_type,
    activityKey: row.sport_key,
    activityName: row.sport_name,
    occurredAt: row.occurred_at,
    localDate: row.local_date,
    durationMinutes: Number(row.duration_minutes),
    distanceKm: row.distance_km === null ? null : Number(row.distance_km),
    estimatedCalories: row.estimated_calories === null ? null : Number(row.estimated_calories),
    steps: row.steps === null ? null : Number(row.steps),
    intensity: row.intensity,
    notes: row.notes,
    source: row.source,
    provider: row.provider,
    externalActivityId: row.external_activity_id,
    routeReference: row.route_reference,
    metadata: row.metadata || {},
    schemaVersion: Number(row.schema_version) || 1,
  };
}

export function createActivityRepository(client: SupabaseClient, userId: string): ActivityRepository {
  return {
    async create(input) {
      const { data, error } = await client.from("sport_activity_entries").insert({
        user_id: userId,
        activity_type: input.activityType,
        sport_key: input.activityKey,
        sport_name: input.activityName,
        occurred_at: input.occurredAt,
        local_date: input.localDate,
        duration_minutes: input.durationMinutes,
        intensity: input.intensity,
        distance_km: input.distanceKm,
        estimated_calories: input.estimatedCalories,
        steps: input.steps,
        notes: input.notes,
        details: input.details || {},
        source: "manual",
        provider: null,
        external_activity_id: null,
        route_reference: null,
        metadata: {},
        schema_version: 1,
      }).select("*").single();
      if (error || !data) throw new Error(error?.message || "Aktivite kaydedilemedi");
      return mapActivityRow(data as ActivityRow);
    },
    async list(limit = 40) {
      const { data, error } = await client.from("sport_activity_entries").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(Math.max(1, Math.min(100, limit)));
      if (error) throw new Error(error.message);
      return (data || []).map((row) => mapActivityRow(row as ActivityRow));
    },
  };
}

export function summarizeActivities(entries: ActivityEntry[]): DailyActivitySummary[] {
  const byDate = new Map<string, DailyActivitySummary>();
  for (const entry of entries) {
    const summary = byDate.get(entry.localDate) || { localDate: entry.localDate, activityCount: 0, durationMinutes: 0, distanceKm: 0, estimatedCalories: 0, steps: 0 };
    summary.activityCount += 1;
    summary.durationMinutes += Math.max(0, entry.durationMinutes || 0);
    summary.distanceKm += Math.max(0, entry.distanceKm || 0);
    summary.estimatedCalories += Math.max(0, entry.estimatedCalories || 0);
    summary.steps += Math.max(0, entry.steps || 0);
    byDate.set(entry.localDate, summary);
  }
  return [...byDate.values()].sort((a, b) => b.localDate.localeCompare(a.localDate));
}
