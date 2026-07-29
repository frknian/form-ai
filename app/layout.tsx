import type { Metadata } from "next";
import "./globals.css";

// Tema ve dil, ilk boyamadan önce senkron olarak uygulanır; aksi halde
// CSS text-transform:uppercase, <html lang> Türkçe kalırsa İngilizce
// metinlerde "i" harfini yanlış büyük harfe çevirir (ör. "WİTH").
const themeScript = `(function(){try{var t=localStorage.getItem('form-ai-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}try{var l=localStorage.getItem('fitai:locale');if(l!=='en'&&l!=='tr'){l=(navigator.language||'tr').toLowerCase().indexOf('en')===0?'en':'tr'}document.documentElement.lang=l}catch(e){}})()`;

export const viewport = { themeColor: "#0C79D8" };

const metadataBase = new URL("https://form-ai.frknian.workers.dev");
const title = "form.ai — Sana özel antrenman";
const description = "Hareketleri adım adım öğren, yapay zeka destekli kişisel antrenman planını güvenle uygula.";

// İstek başlıklarını okumak tüm uygulamayı dinamik SSR'a zorlar. Bu, ücretsiz
// Worker'ın kısa CPU bütçesinde OAuth dönüşlerinde 1102 hatasına yol açabiliyor.
export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  openGraph: { title, description, type: "website", locale: "tr_TR", images: [{ url: "/og.png", width: 1672, height: 941, alt: "form.ai üç aşamalı hareket öğretimi" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
  icons: [{ rel: "manifest", url: "/manifest.json" }, { rel: "apple-touch-icon", url: "/icon-192.png" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
