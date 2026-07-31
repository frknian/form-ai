import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

// .openai/hosting.json is a site-creator scaffold file that is gitignored and
// was never committed, so Cloudflare's build clone never had it: every CI
// build failed at config-load time with an unresolved import. This project
// doesn't use D1 or R2 (Supabase is the only data layer — see db/index.ts,
// which throws if it's ever reached), so d1/r2 are hardcoded to null instead
// of read from that file. Behaviour is unchanged: both bindings arrays below
// were always empty in the generated wrangler.json regardless.
const d1: string | null = null;
const r2: string | null = null;

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
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

const cssStubPlugin = () => ({
  name: "rsc-css-stub",
  enforce: "pre" as const,
  resolveId(id: string, importer: string | undefined, options: { ssr?: boolean }) {
    if (options?.ssr && id.endsWith(".css")) {
      return `\0rsc-css-stub:${id}`;
    }
    return null;
  },
  load(id: string) {
    if (id.startsWith("\0rsc-css-stub:")) {
      return "";
    }
    return null;
  }
});

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const isVercel = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel" || process.env.BUILD_TARGET === "vercel";
  const plugins = [
    vinext(),
    sites(),
  ];

  if (isVercel) {
    const { nitro } = await import("nitro/vite");
    plugins.push(cssStubPlugin(), nitro());
  } else {
    // Wrangler snapshots its log path while the Cloudflare plugin is imported.
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      })
    );
  }

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins,
  };
});
