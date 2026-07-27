"use client";

import { lazy, Suspense } from "react";

const FitAiApp = lazy(() =>
  import("@/components/FitAiApp").then((module) => ({ default: module.default }))
);

export default function Page() {
  return (
    <Suspense fallback={<main aria-busy="true" className="min-h-screen bg-[#0b0d10]" />}>
      <FitAiApp />
    </Suspense>
  );
}
