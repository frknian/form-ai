import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl = process.env.CAPACITOR_SERVER_URL || "https://form-ai-fitness.furkaninansahsi.chatgpt.site";
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
