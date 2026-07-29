import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

// Cloudflare Worker dağıtımında başlıklar `worker/index.ts` içinde eklenir.
// Buradaki yapılandırma, Next uyumlu (ör. Vercel) dağıtım yolu için aynı tanımı kullanır.
const headerEntries = Object.entries(securityHeaders).map(([key, value]) => ({ key, value }));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: headerEntries },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
