"use client";

import { useState } from "react";
import { QUICK_ACTIONS, setStoredQuickActionIds, toggleQuickActionId, useQuickActionIds, type AppView } from "@/lib/quick-actions";
import { useTranslations, type Dictionary } from "@/lib/i18n/translate";

function actionLabel(t: Dictionary, id: string) {
  const labels = t.quickActions as unknown as Record<string, string>;
  return labels[id] ?? id;
}

/**
 * Ana ekrandaki kısayol şeridi. Hedef görünüme geçer, gerekiyorsa oradaki
 * bölüme kaydırır ve hangi kısayolların görüneceği kullanıcı tarafından
 * değiştirilebilir.
 */
export function QuickActions({ onNavigate }: { onNavigate: (view: AppView, anchor?: string) => void }) {
  const t = useTranslations();
  const selected = useQuickActionIds();
  const [editing, setEditing] = useState(false);

  const visible = QUICK_ACTIONS.filter((action) => selected.includes(action.id));

  return <section className="quick-actions">
    <div className="quick-actions-head">
      <div className="eyebrow">{t.quickActions.eyebrow}</div>
      <button type="button" className="quick-actions-edit" aria-pressed={editing} onClick={() => setEditing((open) => !open)}>
        {editing ? t.quickActions.done : t.quickActions.customize}
      </button>
    </div>

    {editing ? <>
      <p className="quick-actions-hint">{t.quickActions.hint}</p>
      <div className="quick-actions-picker">{QUICK_ACTIONS.map((action) => {
        const on = selected.includes(action.id);
        return <button
          type="button"
          key={action.id}
          aria-pressed={on}
          className={on ? "active" : ""}
          onClick={() => setStoredQuickActionIds(toggleQuickActionId(selected, action.id))}
        >{actionLabel(t, action.id)}</button>;
      })}</div>
    </> : <div className="quick-actions-list">{visible.map((action) => <button
      type="button"
      key={action.id}
      onClick={() => onNavigate(action.view, action.anchor)}
    >{actionLabel(t, action.id)}</button>)}</div>}
  </section>;
}
