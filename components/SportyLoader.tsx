"use client";

import { OnboardingIcon } from "./onboarding/OnboardingIcon";

/**
 * Açılış bekleme ekranı.
 *
 * Önceden sabit bir "↗" dairesiydi ve bir fitness uygulamasından çok jenerik
 * bir yükleniyor kutusu gibi duruyordu. Artık dönen bir tur halkası, nabız
 * gibi atan bir dambıl ve tempo çubukları var — bekleme süresi değişmiyor,
 * ama ekran uygulamanın ne olduğunu anlatıyor.
 *
 * role="status" + aria-live: ekran okuyucu bekleme durumunu duyurur; animasyon
 * `prefers-reduced-motion` altında durur (bkz. globals.css).
 */
export function SportyLoader({ title, body }: { title: string; body: string }) {
  return (
    <main className="auth-shell auth-loading">
      <section className="auth-status-card sport-loader-card" role="status" aria-live="polite">
        <div className="sport-loader">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="sport-loader-track" cx="50" cy="50" r="42" />
            <circle className="sport-loader-arc" cx="50" cy="50" r="42" />
          </svg>
          <span className="sport-loader-core" aria-hidden="true"><OnboardingIcon name="strength" /></span>
        </div>
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="sport-loader-bars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </section>
    </main>
  );
}
