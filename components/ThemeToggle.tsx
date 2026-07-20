"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function preferredTheme(): Theme {
  const stored = window.localStorage.getItem("form-ai-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => onChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener("form-ai-theme-change", handleChange);
  media.addEventListener("change", handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("form-ai-theme-change", handleChange);
    media.removeEventListener("change", handleChange);
  };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, preferredTheme, () => "light");

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem("form-ai-theme", next);
    window.dispatchEvent(new Event("form-ai-theme-change"));
  }

  const dark = theme === "dark";
  return <button type="button" className={`theme-toggle ${className}`.trim()} aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"} aria-pressed={dark} onClick={toggleTheme}><span aria-hidden="true">{dark ? "☀" : "☾"}</span><small>{dark ? "Açık" : "Koyu"}</small></button>;
}
