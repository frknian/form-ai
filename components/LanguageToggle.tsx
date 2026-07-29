"use client";

import { useTranslations } from "@/lib/i18n/translate";
import { useLocale, setStoredLocale } from "@/lib/i18n/locale";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations();

  return <button type="button" className={`language-toggle ${className}`.trim()} aria-label={t.common.languageToggle} onClick={() => setStoredLocale(locale === "tr" ? "en" : "tr")}><span aria-hidden="true">{locale === "tr" ? "EN" : "TR"}</span><small>{t.common.languageToggle}</small></button>;
}
