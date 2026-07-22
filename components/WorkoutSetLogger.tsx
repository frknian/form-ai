"use client";

import type { PreviousExercisePerformance, WorkoutSetDraft } from "@/lib/workout-log";
import { progressionSuggestion } from "@/lib/workout-log";

type SetPatch = Partial<Omit<WorkoutSetDraft, "setNumber">>;

function previousSetLabel(set: PreviousExercisePerformance["sets"][number]) {
  const values = [
    set.weightKg !== null ? `${set.weightKg.toLocaleString("tr-TR")} kg` : "",
    set.reps !== null ? `${set.reps} tekrar` : "",
    set.durationSeconds !== null ? `${set.durationSeconds} sn` : "",
    set.rpe !== null ? `RPE ${set.rpe}` : "",
  ].filter(Boolean);
  return values.join(" · ") || "Not kaydı";
}

export function WorkoutSetLogger({ exerciseName, activeSet, isBodyweight, sets, previous, loadingPrevious, onChange }: {
  exerciseName: string;
  activeSet: number;
  isBodyweight: boolean;
  sets: WorkoutSetDraft[];
  previous: PreviousExercisePerformance | null | undefined;
  loadingPrevious: boolean;
  onChange: (setNumber: number, patch: SetPatch) => void;
}) {
  return <section className="set-log-card" aria-labelledby="set-log-title">
    <div className="set-log-heading"><div><span>ANTRENMAN GÜNLÜĞÜ</span><h2 id="set-log-title">Set kaydı</h2></div><small>{isBodyweight ? "Ağırlıksız · tekrar veya süre" : "Ağırlık · tekrar · RPE"}</small></div>

    <div className="previous-performance">
      {loadingPrevious ? <p className="previous-empty">Önceki performans aranıyor…</p> : previous ? <>
        <div className="previous-heading"><div><span>SON PERFORMANS</span><strong>{new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(previous.completedAt))}</strong></div><small>{exerciseName}</small></div>
        <div className="previous-sets">{previous.sets.map((set) => <span key={set.setNumber}><b>{set.setNumber}. set</b>{previousSetLabel(set)}</span>)}</div>
        <div className="progression-tip"><span>↗</span><p><strong>Güvenli ilerleme önerisi</strong>{progressionSuggestion(previous)}</p></div>
      </> : <div className="previous-empty"><span>＋</span><p><strong>Bu hareket için geçmiş kayıt yok.</strong>İlk setlerini kaydet; bir sonraki antrenmanda önceki performansın ve ilerleme önerin burada görünsün.</p></div>}
    </div>

    <div className="set-log-table">
      <div className={`set-log-table-head ${isBodyweight ? "bodyweight" : "weighted"}`}><span>Set</span>{isBodyweight ? <><span>Tekrar</span><span>Süre</span></> : <><span>Kg</span><span>Tekrar</span></>}<span>RPE</span><span>Not</span><span>Durum</span></div>
      {sets.map((set) => <div className={`set-log-row ${isBodyweight ? "bodyweight" : "weighted"} ${set.setNumber === activeSet ? "active" : ""}`} key={set.setNumber}>
        <strong>{String(set.setNumber).padStart(2, "0")}</strong>
        {isBodyweight ? <>
          <label><span>Tekrar</span><input type="number" inputMode="numeric" min="1" max="999" value={set.reps} onChange={(event) => onChange(set.setNumber, { reps: event.target.value })} aria-label={`${set.setNumber}. set tekrar`} placeholder="—" /></label>
          <label><span>Süre</span><div className="set-input-unit"><input type="number" inputMode="numeric" min="1" max="3600" value={set.durationSeconds} onChange={(event) => onChange(set.setNumber, { durationSeconds: event.target.value })} aria-label={`${set.setNumber}. set süre saniye`} placeholder="—" /><i>sn</i></div></label>
        </> : <>
          <label><span>Ağırlık</span><div className="set-input-unit"><input type="number" inputMode="decimal" min="0" max="999" step="0.5" value={set.weightKg} onChange={(event) => onChange(set.setNumber, { weightKg: event.target.value })} aria-label={`${set.setNumber}. set ağırlık kilogram`} placeholder="—" /><i>kg</i></div></label>
          <label><span>Tekrar</span><input type="number" inputMode="numeric" min="1" max="999" value={set.reps} onChange={(event) => onChange(set.setNumber, { reps: event.target.value })} aria-label={`${set.setNumber}. set tekrar`} placeholder="—" /></label>
        </>}
        <label><span>RPE</span><select value={set.rpe} onChange={(event) => onChange(set.setNumber, { rpe: event.target.value })} aria-label={`${set.setNumber}. set RPE zorluk`}><option value="">—</option>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}</select></label>
        <label className="set-note"><span>Kısa not</span><input type="text" maxLength={140} value={set.note} onChange={(event) => onChange(set.setNumber, { note: event.target.value })} aria-label={`${set.setNumber}. set kısa not`} placeholder="Form, tempo…" /></label>
        <button type="button" className={set.completed ? "set-status complete" : "set-status"} aria-pressed={set.completed} onClick={() => onChange(set.setNumber, { completed: !set.completed })}>{set.completed ? "✓ Kaydedildi" : "Kaydet"}</button>
      </div>)}
    </div>
    <p className="rpe-help"><strong>RPE:</strong> 1 çok kolay, 10 maksimum efor. Ağrı zorluk değildir; ağrı hissedersen hareketi durdur.</p>
  </section>;
}
