import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReminderPreferences, WorkoutScheduleEntry } from "@/lib/workout-calendar";

export const mobileAuthCallback = "com.fitai.app://auth/callback";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function authCallbackUrl() {
  return isNativeApp() ? mobileAuthCallback : `${window.location.origin}/auth/callback`;
}

export async function openNativeBrowser(url: string) {
  if (!isNativeApp()) { window.location.assign(url); return; }
  await Browser.open({ url, presentationStyle: "popover" });
}

export async function takeFoodPhoto() {
  if (!isNativeApp()) return null;
  const photo = await Camera.getPhoto({
    quality: 72,
    width: 1280,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
    promptLabelHeader: "Öğün fotoğrafı",
    promptLabelPhoto: "Galeriden seç",
    promptLabelPicture: "Fotoğraf çek",
    promptLabelCancel: "Vazgeç",
  });
  return photo.dataUrl || null;
}

export async function mobileImpact() {
  if (isNativeApp()) await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}

export async function mobileNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNativeApp()) return typeof window === "undefined" || !window.isSecureContext || typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const permission = await LocalNotifications.checkPermissions();
  return permission.display === "granted" ? "granted" : permission.display === "denied" ? "denied" : "default";
}

export async function requestMobileNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNativeApp()) {
    if (typeof window === "undefined" || !window.isSecureContext || typeof Notification === "undefined") return "unsupported";
    return Notification.requestPermission().catch(() => "unsupported");
  }
  const permission = await LocalNotifications.requestPermissions();
  return permission.display === "granted" ? "granted" : permission.display === "denied" ? "denied" : "default";
}

function notificationId(value: string) {
  return [...value].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 17) % 2_000_000_000;
}

export async function scheduleMobileWorkouts(preferences: ReminderPreferences, entries: WorkoutScheduleEntry[]) {
  if (!isNativeApp()) return;
  const pending = await LocalNotifications.getPending();
  const own = pending.notifications.filter((notification) => notification.extra?.fitAiWorkout === true);
  if (own.length) await LocalNotifications.cancel({ notifications: own.map(({ id }) => ({ id })) });
  if (!preferences.browserNotifications) return;
  const now = Date.now();
  const notifications = entries
    .filter((entry) => entry.status === "planned")
    .map((entry) => {
      const startsAt = new Date(`${entry.scheduledDate}T${entry.scheduledTime}:00+03:00`).getTime();
      const alertAt = startsAt - preferences.reminderMinutesBefore * 60_000;
      return { id: notificationId(`${entry.scheduledDate}-${entry.scheduledTime}`), title: "Antrenman saatin yaklaşıyor", body: `${entry.scheduledTime} antrenmanın için hazırlanma zamanı.`, schedule: { at: new Date(alertAt) }, extra: { fitAiWorkout: true, scheduledDate: entry.scheduledDate } };
    })
    .filter((notification) => notification.schedule.at.getTime() > now)
    .slice(0, 60);
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

export function registerMobileRuntime(options: { supabase: SupabaseClient | null; onOnlineChange: (online: boolean) => void }) {
  if (!isNativeApp()) return () => undefined;
  document.documentElement.classList.add("native-app");
  let active = true;
  const handles: Array<{ remove: () => Promise<void> }> = [];
  void Network.getStatus().then((status) => { if (active) options.onOnlineChange(status.connected); });
  void Network.addListener("networkStatusChange", (status) => options.onOnlineChange(status.connected)).then((handle) => handles.push(handle));
  void App.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith(mobileAuthCallback) || !options.supabase) return;
    const code = new URL(url).searchParams.get("code");
    if (code) await options.supabase.auth.exchangeCodeForSession(code);
    await Browser.close().catch(() => undefined);
    window.location.assign("/");
  }).then((handle) => handles.push(handle));
  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  }).then((handle) => handles.push(handle));
  return () => {
    active = false;
    document.documentElement.classList.remove("native-app");
    handles.forEach((handle) => void handle.remove());
  };
}
