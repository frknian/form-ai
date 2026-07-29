import { defineNitroConfig } from "nitro/config";
import { securityHeaders } from "./lib/security-headers";

// Vercel / Dokploy (Nitro) dağıtım hattı için güvenlik başlıkları.
// Cloudflare Worker hattında aynı tanım `worker/index.ts` içinde uygulanır.
export default defineNitroConfig({
  routeRules: {
    "/**": { headers: securityHeaders },
    // Kimlik doğrulamalı API yanıtları hiçbir katmanda önbelleğe alınmaz.
    "/api/**": { headers: { ...securityHeaders, "Cache-Control": "no-store" } },
  },
});
