"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { nextFrameIndex, shouldCycleFrames } from "@/lib/exercise-animation";

type ExerciseAnimationProps = {
  images: string[];
  name: string;
  intervalMs?: number;
  compact?: boolean;
};

export function ExerciseAnimation({ images, name, intervalMs = 750, compact = false }: ExerciseAnimationProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const safeImages = useMemo(() => images.filter((image) => /^\/exercise-images\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(image)), [images]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: "160px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const usableImages = safeImages.filter((image) => !failedImages.includes(image));

  useEffect(() => {
    if (!shouldCycleFrames(usableImages.length, isVisible, pageVisible, reducedMotion)) return;
    const timer = window.setInterval(() => setFrameIndex((current) => nextFrameIndex(current, usableImages.length)), Math.min(2000, Math.max(600, intervalMs)));
    return () => window.clearInterval(timer);
  }, [intervalMs, isVisible, pageVisible, reducedMotion, usableImages.length]);

  const visibleFrameIndex = usableImages.length ? frameIndex % usableImages.length : 0;
  const activeImage = usableImages[visibleFrameIndex];
  return <div ref={rootRef} className={`db-exercise-animation ${compact ? "compact" : "large"}`} aria-label={`${name} hareket görseli`}>
    {activeImage ? (
      <Image
        key={activeImage}
        src={activeImage}
        alt={`${name} hareketinin ${visibleFrameIndex + 1}. aşaması`}
        width={compact ? 180 : 720}
        height={compact ? 130 : 460}
        loading="lazy"
        sizes={compact ? "(max-width: 700px) 100vw, (max-width: 980px) 50vw, 33vw" : "(max-width: 700px) 100vw, 720px"}
        unoptimized
        style={{
          position: "relative",
          opacity: 1,
        }}
        onError={() => { setFailedImages((current) => [...new Set([...current, activeImage])]); setFrameIndex(0); }}
      />
    ) : (
      <div className="exercise-image-fallback" role="img" aria-label={`${name} için görsel bulunamadı`}>
        <span>↗</span><strong>Egzersiz görseli bulunamadı</strong>
      </div>
    )}
    {usableImages.length > 1 && <div className="frame-dots" aria-hidden="true">{usableImages.map((image, index) => <i className={index === visibleFrameIndex ? "active" : ""} key={image} />)}</div>}
  </div>;
}
