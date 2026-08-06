"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n/translate";

type PremiumPlansProps = {
  open: boolean;
  onClose: () => void;
  isPremium: boolean;
};

export function PremiumPlans({ open, onClose, isPremium }: PremiumPlansProps) {
  const t = useTranslations();
  const [showComingSoon, setShowComingSoon] = useState(false);

  if (!open) return null;

  const rows: Array<[string, string, string]> = [
    [t.premium.featureChat, t.premium.freeLimits.chat, t.premium.premiumLimits.chat],
    [t.premium.featureNutritionText, t.premium.freeLimits.nutritionText, t.premium.premiumLimits.nutritionText],
    [t.premium.featureWeeklyReview, t.premium.freeLimits.weeklyReview, t.premium.premiumLimits.weeklyReview],
    [t.premium.featureNutritionAdvice, t.premium.freeLimits.nutritionAdvice, t.premium.premiumLimits.nutritionAdvice],
  ];

  return <div className="premium-overlay" role="dialog" aria-modal="true" aria-labelledby="premium-plans-title" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="premium-dialog">
      <button type="button" className="premium-close" aria-label={t.premium.close} onClick={onClose}>×</button>
      <h2 id="premium-plans-title">{t.premium.title}</h2>
      <p className="premium-subtitle">{t.premium.subtitle}</p>

      <div className="premium-plans-grid">
        <div className={`premium-plan-card ${!isPremium ? "active" : ""}`}>
          <strong>{t.premium.freeLabel}</strong>
          <ul className="premium-feature-list">
            {rows.map(([label, freeLimit]) => <li key={label}><span>{label}</span><b>{freeLimit}</b></li>)}
          </ul>
        </div>
        <div className={`premium-plan-card ${isPremium ? "active" : ""}`}>
          <strong>{t.premium.premiumLabel}</strong>
          <div className="premium-price"><span>{t.premium.priceMonthly}</span><span>{t.premium.priceYearly}</span></div>
          <ul className="premium-feature-list">
            {rows.map(([label, , premiumLimit]) => <li key={label}><span>{label}</span><b>{premiumLimit}</b></li>)}
          </ul>
        </div>
      </div>

      {isPremium
        ? <div className="premium-badge">{t.premium.alreadyPremiumBadge}</div>
        : <button type="button" className="premium-cta-button" onClick={() => setShowComingSoon(true)}>{t.premium.ctaUpgrade}</button>}
      {showComingSoon && !isPremium && <p className="premium-coming-soon-notice" role="status">{t.premium.comingSoonNotice}</p>}
    </div>
  </div>;
}
