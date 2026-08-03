import { useSyncExternalStore } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReminderPreferences, WorkoutScheduleEntry } from "@/lib/workout-calendar";

export const mobileAuthCallback = "com.hedefit.app://auth/callback";

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

/**
 * Kamera açılmadan önce konur, sonuç işlenince silinir.
 *
 * Android kamera öndeyken barındıran Activity'yi öldürebiliyor; dönüşte WebView
 * sıfırdan yükleniyor ve kullanıcı uygulamayı baştan açılmış buluyordu. Bu
 * işaret sayesinde yeniden açılışta hangi ekrana dönüleceği bilinir.
 */
const PENDING_FOOD_PHOTO_KEY = "hedefit:pending-food-photo";

/**
 * Çekilen fotoğrafın kendisi. İşaretten ayrı tutulur: fotoğraf elimize geçer
 * geçmez, HERHANGİ bir ağ isteğinden önce buraya yazılır. Analiz isteği
 * başarısız olsa da, sayfa bir kez daha yeniden yüklense de kare kaybolmaz;
 * beslenme sekmesi açıldığında kaldığı yerden analize girer.
 */
const CAPTURED_FOOD_PHOTO_KEY = "hedefit:captured-food-photo";

/**
 * İşaret bu süre içinde anlamlıdır. Sabit bir zaman aşımı yerine zaman damgası
 * tutulur: eskiden 8 saniyelik kör bir sayaç işareti siliyordu ve yavaş bir
 * cihazda soğuk açılış bu süreyi kolayca aşıyordu.
 */
const PENDING_WINDOW_MS = 10 * 60_000;

const pendingPhotoListeners = new Set<() => void>();

function notifyPendingPhoto() {
  pendingPhotoListeners.forEach((listener) => listener());
}

export function markPendingFoodPhoto() {
  try { localStorage.setItem(PENDING_FOOD_PHOTO_KEY, String(Date.now())); } catch { /* depolama kapalı */ }
  notifyPendingPhoto();
}

export function hasPendingFoodPhoto() {
  try {
    if (typeof localStorage === "undefined") return false;
    // Kaydedilmiş bir kare varsa işaretin süresi dolmuş olsa bile bekleyen bir
    // fotoğraf vardır: kullanıcı onu görmeden hiçbir yere yönlendirilmemeli.
    if (localStorage.getItem(CAPTURED_FOOD_PHOTO_KEY)) return true;
    const raw = localStorage.getItem(PENDING_FOOD_PHOTO_KEY);
    if (!raw) return false;
    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt)) return false;
    return Date.now() - startedAt < PENDING_WINDOW_MS;
  } catch { return false; }
}

export function clearPendingFoodPhoto() {
  try { localStorage.removeItem(PENDING_FOOD_PHOTO_KEY); } catch { /* depolama kapalı */ }
  notifyPendingPhoto();
}

/** Çekilen kareyi ağ isteğinden ÖNCE saklar; kota dolarsa sessizce vazgeçer. */
export function storeCapturedFoodPhoto(dataUrl: string) {
  try { localStorage.setItem(CAPTURED_FOOD_PHOTO_KEY, dataUrl); } catch { /* kota/depolama */ }
  notifyPendingPhoto();
}

export function readCapturedFoodPhoto(): string | null {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(CAPTURED_FOOD_PHOTO_KEY); } catch { return null; }
}

export function clearCapturedFoodPhoto() {
  try { localStorage.removeItem(CAPTURED_FOOD_PHOTO_KEY); } catch { /* depolama kapalı */ }
  notifyPendingPhoto();
}

function subscribePendingFoodPhoto(callback: () => void) {
  pendingPhotoListeners.add(callback);
  return () => { pendingPhotoListeners.delete(callback); };
}

/**
 * Bekleyen bir öğün fotoğrafı olup olmadığını izler.
 *
 * Sunucu anlık görüntüsü daima false: işaret yalnız cihazda anlamlıdır ve
 * doğrudan efekt içinde setState çağırmak yerine bu mağazadan okunur.
 */
export function usePendingFoodPhoto(): boolean {
  return useSyncExternalStore(subscribePendingFoodPhoto, hasPendingFoodPhoto, () => false);
}

/** Yerel dosya yolunu data URL'ye çevirir; okunamazsa null döner. */
async function fileToDataUrl(source: string): Promise<string | null> {
  try {
    const blob = await fetch(source).then((response) => response.blob());
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Öğün fotoğrafı çeker ve data URL döndürür.
 *
 * Sonuç DataUrl yerine Uri olarak istenir: kamera uygulaması öndeyken Android,
 * bellek baskısı altında barındıran Activity'yi öldürebiliyor. DataUrl, kamera
 * açık kaldığı sürece bellekte megabaytlarca base64 dizesi tutarak bu baskıyı
 * artırıyor ve uygulama fotoğraftan sonra yeniden açılıp kaydı kaybediyordu.
 * Uri hafiftir; dosyayı ancak uygulama yeniden ön plana geldikten sonra,
 * güvenli anda data URL'ye çeviririz. (Manifest'teki largeHeap de aynı riski
 * azaltır.)
 *
 * Activity yine de öldürülürse bu çağrının sözü hiç çözülmez — JS bağlamı yok
 * olmuştur. O senaryoyu listenForRestoredFoodPhoto karşılar.
 */
export async function takeFoodPhoto() {
  if (!isNativeApp()) return null;
  markPendingFoodPhoto();
  try {
    const photo = await Camera.getPhoto({
      quality: 72,
      width: 1280,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      promptLabelHeader: "Öğün fotoğrafı",
      promptLabelPhoto: "Galeriden seç",
      promptLabelPicture: "Fotoğraf çek",
      promptLabelCancel: "Vazgeç",
    });
    const dataUrl = photo.dataUrl || (photo.webPath ? await fileToDataUrl(photo.webPath) : null);
    // Kare, analiz isteğinden ÖNCE saklanır: istek başarısız olsa ya da
    // sayfa yeniden yüklense de kullanıcı fotoğrafı yeniden çekmek zorunda
    // kalmasın.
    if (dataUrl) storeCapturedFoodPhoto(dataUrl);
    return dataUrl;
  } finally {
    clearPendingFoodPhoto();
  }
}

/**
 * Activity öldürüldüğü için çözülemeyen kamera çağrısının sonucunu yakalar.
 *
 * Capacitor bu durumu tam olarak bunun için `appRestoredResult` ile bildirir:
 * uygulama yeniden açıldığında, uçuşta kalan eklenti çağrısının sonucu bir kez
 * yayınlanır. Böylece kullanıcı fotoğrafı yeniden çekmek zorunda kalmaz.
 */
export function listenForRestoredFoodPhoto(handler: (dataUrl: string) => void) {
  if (!isNativeApp()) return () => undefined;
  let active = true;
  let handle: { remove: () => Promise<void> } | null = null;
  void App.addListener("appRestoredResult", (result) => {
    if (!active || result.pluginId !== "Camera" || result.methodName !== "getPhoto") return;
    void (async () => {
      const data = result.data as { dataUrl?: string; webPath?: string; path?: string } | undefined;
      // path yerel dosya sistemi yolu; WebView'in okuyabilmesi için çevrilir.
      const source = data?.webPath || (data?.path ? Capacitor.convertFileSrc(data.path) : null);
      const dataUrl = data?.dataUrl || (source ? await fileToDataUrl(source) : null);
      clearPendingFoodPhoto();
      if (!result.success || !dataUrl) return;
      // Dinleyici sökülmüş olsa bile (kullanıcı o an başka sekmedeydi) kare
      // saklanır; beslenme sekmesi açıldığında oradan alınır.
      storeCapturedFoodPhoto(dataUrl);
      if (active) handler(dataUrl);
    })();
  }).then((registered) => { if (active) handle = registered; else void registered.remove(); });
  return () => { active = false; void handle?.remove(); };
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
