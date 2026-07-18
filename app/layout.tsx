import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "form.ai — Sana özel antrenman",
  description: "Vücudunu tanı, gücünü keşfet. Yapay zeka destekli kişisel antrenman planın.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
