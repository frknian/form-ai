"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface PagerPage {
  key: string;
  label: string;
  content: ReactNode;
}

interface MobilePagerProps {
  pages: PagerPage[];
  /** Sayfa kümesinin tamamını tanımlar (ör. "Ana ekran sayfaları"). */
  label: string;
  nextLabel: (pageName: string) => string;
  lastLabel: string;
  goToLabel: (pageName: string) => string;
  positionLabel: (current: number, total: number) => string;
}

/**
 * Mobilde uzun bir ekranı yan yana duran sayfalara böler.
 *
 * Ana ekran alt alta 7 blok uzunluğundaydı; sıfırdan gelen kullanıcı ekranın
 * altında içerik kaldığını fark etmiyordu. Sayfalar arasında parmakla kaydırma,
 * noktalar ve bir sonraki sayfanın adını yazan "İleri" düğmesi ile geçilir —
 * üç yol da sunulduğu için jesti bilmeyen kullanıcı da takılmaz.
 *
 * Masaüstünde sarmalayıcıların hiçbiri kutu üretmez (display:contents), yani
 * bugünkü dikey yerleşim kardeş seçicileri ve eksi kenar boşluklarıyla birlikte
 * aynen korunur.
 */
export function MobilePager({ pages, label, nextLabel, lastLabel, goToLabel, positionLabel }: MobilePagerProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth;
    // Masaüstünde iz display:contents olduğu için genişliği 0'dır; kaydırma yok.
    if (width <= 0) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, next));
    // Yumuşak geçiş BİLEREK istenmiyor: scroll-snap-type:mandatory ile
    // birlikte animasyon iptal edilip kaydırma başa dönüyordu (ölçüldü).
    track.scrollTo({ left: clamped * width, behavior: "auto" });
  }, [pages.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const readIndex = () => {
      frame = 0;
      const width = track.clientWidth;
      if (width > 0) setIndex(Math.round(track.scrollLeft / width));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(readIndex);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const isLast = index >= pages.length - 1;
  const nextPage = pages[Math.min(index + 1, pages.length - 1)];

  return (
    <div className="mobile-pager">
      <div className="mobile-pager-track" ref={trackRef}>
        {pages.map((page) => (
          <div className="mobile-pager-page" key={page.key} role="group" aria-label={page.label}>
            {page.content}
          </div>
        ))}
      </div>
      <div className="mobile-pager-controls">
        <div className="mobile-pager-status">
          <strong>{pages[index]?.label}</strong>
          <small>{positionLabel(index + 1, pages.length)}</small>
        </div>
        <div className="mobile-pager-dots" aria-label={label}>
          {pages.map((page, position) => (
            <button
              key={page.key}
              type="button"
              className={position === index ? "active" : ""}
              aria-current={position === index}
              aria-label={goToLabel(page.label)}
              onClick={() => goTo(position)}
            />
          ))}
        </div>
        <button
          type="button"
          className="mobile-pager-next"
          disabled={isLast}
          onClick={() => goTo(index + 1)}
        >
          {isLast ? lastLabel : nextLabel(nextPage.label)}
          {!isLast && <span aria-hidden="true">→</span>}
        </button>
      </div>
    </div>
  );
}
