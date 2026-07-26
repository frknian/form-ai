import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor kabuğu WebView'i bu adrese yönlendirir ve adres pakete GÖMÜLÜR.
// Yayın paketine geçici bir önizleme adresi gömmek, uygulamayı o adres kapandığı
// anda tamamen çalışmaz hâle getirir ve düzeltmek yeni bir sürüm yayınlamayı
// gerektirir. Bu yüzden yayın derlemelerinde adres açıkça verilmek zorundadır.
const developmentFallbackUrl = "https://form-ai-fitness.furkaninansahsi.chatgpt.site";
const isReleaseBuild = process.env.CAPACITOR_RELEASE === "1" || process.env.NODE_ENV === "production";
const configuredUrl = process.env.CAPACITOR_SERVER_URL;

if (isReleaseBuild && !configuredUrl) {
  throw new Error(
    "CAPACITOR_SERVER_URL tanımlı değil. Yayın paketi üretmeden önce kalıcı üretim " +
    "alan adınızı verin, ör. CAPACITOR_SERVER_URL=https://app.alanadiniz.com npx cap sync android",
  );
}

const productionUrl = configuredUrl || developmentFallbackUrl;
if (isReleaseBuild && !productionUrl.startsWith("https://")) {
  throw new Error("CAPACITOR_SERVER_URL https:// ile başlamalıdır.");
}
const productionHost = new URL(productionUrl).hostname;

const config: CapacitorConfig = {
  appId: "com.fitai.app",
  appName: "FİT.AI",
  webDir: "mobile-shell",
  backgroundColor: "#f7f7f2",
  server: {
    url: productionUrl,
    cleartext: productionUrl.startsWith("http://"),
    allowNavigation: [productionHost],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#f7f7f2",
  },
  android: {
    backgroundColor: "#f7f7f2",
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_fit_ai",
      iconColor: "#bfe94a",
    },
  },
};

export default config;
