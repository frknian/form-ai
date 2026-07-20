import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const themeScript = `(function(){try{var t=localStorage.getItem('form-ai-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}})()`;

export const viewport = { themeColor: "#0C79D8" };

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "form-ai-fitness.furkaninansahsi.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "form.ai — Sana özel antrenman";
  const description = "Hareketleri adım adım öğren, yapay zeka destekli kişisel antrenman planını güvenle uygula.";
  const socialImage = new URL("/og.png", metadataBase);
  return {
    metadataBase,
    title,
    description,
    openGraph: { title, description, type: "website", locale: "tr_TR", images: [{ url: socialImage, width: 1672, height: 941, alt: "form.ai üç aşamalı hareket öğretimi" }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
    other: { "apple-mobile-web-app-capable": "yes", "apple-mobile-web-app-status-bar-style": "default" },
    icons: [{ rel: "manifest", url: "/manifest.json" }, { rel: "apple-touch-icon", url: "/icon-192.png" }],
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
