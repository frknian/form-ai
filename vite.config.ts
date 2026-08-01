import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  // worker/index.ts görsel optimizasyonunda env.IMAGES kullanıyor. Binding
  // burada bildirilmezse üretilen wrangler.json'a girmez ve `wrangler deploy`
  // onu worker'dan kaldırır; /_vinext/image o anda 500 vermeye başlar.
  images: { binding: "IMAGES" },
  // Varlık dizinini vinext ayarlıyor ama BINDING'i eklemiyor. Binding olmadan
  // dosyalar servis edilir, ancak worker onlara programatik erişemez: env.ASSETS
  // undefined kalır ve env.ASSETS.fetch çağıran her yol (görsel optimizasyonu)
  // "Cannot read properties of undefined" ile Worker'ı 1101'e düşürür.
  assets: { binding: "ASSETS" },
  // Supabase tek veri katmanı: D1 ve R2 hiç kullanılmıyor, bu yüzden binding
  // listeleri boş. Buraya bir şey eklemek gerekmiyor.
  d1_databases: [],
  r2_buckets: [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Tek dağıtım hedefi Cloudflare Workers. Vercel/Nitro dalı kaldırıldı:
  // kullanılmıyordu ve iki hattı birden doğru tutmak, güvenlik başlıklarının
  // üç ayrı yerde (worker, next.config, nitro.config) tekrarlanması demekti.
  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const plugins = [
    vinext(),
    sites(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      config: localBindingConfig,
    }),
  ];

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins,
  };
});
