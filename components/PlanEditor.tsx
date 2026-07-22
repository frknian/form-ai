"use client";

import { useMemo, useState } from "react";
import { movePlanWorkout, planPrescription, updatePlanPrescription, type EditableWorkout } from "@/lib/plan-editor";

function optionLabel(workout: EditableWorkout) {
  return `${workout.name} ${workout.english} ${workout.area}`.toLocaleLowerCase("tr-TR");
}

export function PlanEditor({ workouts, exerciseOptions, onSave, onReset }: {
  workouts: EditableWorkout[];
  exerciseOptions: EditableWorkout[];
  onSave: (workouts: EditableWorkout[]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(workouts);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const matches = useMemo(() => exerciseOptions.filter((workout) => optionLabel(workout).includes(query.trim().toLocaleLowerCase("tr-TR"))).slice(0, 8), [exerciseOptions, query]);
  const update = (index: number, change: Parameters<typeof updatePlanPrescription>[1]) => setDraft((current) => current.map((workout, itemIndex) => itemIndex === index ? updatePlanPrescription(workout, change) : workout));
  const replace = (index: number, replacement: EditableWorkout) => setDraft((current) => current.map((workout, itemIndex) => itemIndex === index ? replacement : workout));

  function save() {
    if (!draft.length) { setMessage("Planında en az bir hareket olmalı."); return; }
    onSave(draft);
    setOpen(false);
    setMessage("");
  }

  return <section className="plan-editor" aria-labelledby="plan-editor-title">
    <div className="plan-editor-summary"><div><span>PROGRAMINI KENDİNE GÖRE AYARLA</span><h2 id="plan-editor-title">Plan düzenleyici</h2><p>Hareketleri değiştir, sırala veya günün süresine göre set, tekrar ve dinlenmeyi ayarla.</p></div><button type="button" className="outline-btn plan-edit-trigger" onClick={() => { setDraft(workouts); setMessage(""); setOpen(true); }}>Planı düzenle</button></div>
    {open && <div className="plan-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="plan-editor-dialog-title"><div className="plan-editor-dialog"><header><div><span>BUGÜNÜN PLANI</span><h2 id="plan-editor-dialog-title">Antrenmanını düzenle</h2></div><button type="button" aria-label="Plan düzenleyiciyi kapat" onClick={() => setOpen(false)}>×</button></header><p className="plan-editor-lead">Bu değişiklikler sonraki başlatacağın antrenmana uygulanır. Ağrı hissedersen hareketi değiştir veya dinlenme ekle.</p>
      <div className="plan-editor-list">{draft.map((workout, index) => { const prescription = planPrescription(workout); return <article key={`${workout.id || workout.name}-${index}`}><div className="plan-editor-item-head"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{workout.name}</strong><small>{workout.area} · {workout.bodyweight ? "Ağırlıksız" : workout.equipment || "Serbest"}</small></div><div className="plan-order-actions"><button type="button" disabled={index === 0} aria-label={`${workout.name} yukarı taşı`} onClick={() => setDraft((current) => movePlanWorkout(current, index, -1))}>↑</button><button type="button" disabled={index === draft.length - 1} aria-label={`${workout.name} aşağı taşı`} onClick={() => setDraft((current) => movePlanWorkout(current, index, 1))}>↓</button><button type="button" className="plan-remove" disabled={draft.length === 1} onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Kaldır</button></div></div>
        <div className="plan-editor-controls"><label>Set<input type="number" min="1" max="8" value={prescription.sets} onChange={(event) => update(index, { sets: Number(event.target.value) })} /></label><label>{prescription.isTimed ? "Süre (sn)" : "Tekrar"}<input type="number" min="1" max={prescription.isTimed ? 900 : 100} value={prescription.amount} onChange={(event) => update(index, { amount: Number(event.target.value) })} /></label><label>Dinlenme (sn)<input type="number" min="15" max="300" step="15" value={prescription.restSeconds} onChange={(event) => update(index, { restSeconds: Number(event.target.value) })} /></label><button type="button" className="plan-timing-toggle" onClick={() => update(index, { isTimed: !prescription.isTimed })}>{prescription.isTimed ? "Tekrara çevir" : "Süreye çevir"}</button></div>
        <details className="plan-replace"><summary>Hareketi değiştir</summary><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hareket ara…" aria-label="Değiştirilecek hareket ara" /> <div>{matches.map((option) => <button type="button" key={option.id || option.name} onClick={() => { replace(index, option); setQuery(""); }}><strong>{option.name}</strong><span>{option.area} · {option.bodyweight ? "Ağırlıksız" : option.equipment || "Serbest"}</span></button>)}</div></details>
      </article>; })}</div>
      <div className="plan-add"><label>Yeni hareket ekle<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hareket ara…" aria-label="Yeni hareket ara" /></label><div>{matches.filter((option) => !draft.some((workout) => workout.name === option.name)).map((option) => <button type="button" key={option.id || option.name} onClick={() => { setDraft((current) => [...current, option]); setQuery(""); }}><strong>+ {option.name}</strong><span>{option.area}</span></button>)}</div></div>
      {message && <p className="plan-editor-message" role="alert">{message}</p>}<footer><button type="button" className="plan-reset" onClick={() => { onReset(); setOpen(false); }}>Otomatik plana dön</button><div><button type="button" className="outline-btn" onClick={() => setOpen(false)}>Vazgeç</button><button type="button" className="primary-btn" onClick={save}>Değişiklikleri kaydet <span>→</span></button></div></footer></div></div>}
  </section>;
}
