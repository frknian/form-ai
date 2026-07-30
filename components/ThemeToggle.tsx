"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "@/lib/i18n/translate";

type Theme = "light" | "dark";

function preferredTheme(): Theme {
  const stored = window.localStorage.getItem("hedefit-theme") || window.localStorage.getItem("form-ai-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => onChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener("hedefit-theme-change", handleChange);
  media.addEventListener("change", handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("hedefit-theme-change", handleChange);
    media.removeEventListener("change", handleChange);
  };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, preferredTheme, () => "light");
  const t = useTranslations();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem("hedefit-theme", next);
    window.dispatchEvent(new Event("hedefit-theme-change"));
  }

  const dark = theme === "dark";
  return <button type="button" className={`theme-toggle ${className}`.trim()} aria-label={dark ? t.common.themeToLight : t.common.themeToDark} aria-pressed={dark} onClick={toggleTheme}><span aria-hidden="true">{dark ? "☀" : "☾"}</span><small>{dark ? t.common.themeLightShort : t.common.themeDarkShort}</small></button>;
}
