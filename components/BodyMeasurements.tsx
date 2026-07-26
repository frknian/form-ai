"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  chartDomain,
  circumferenceFields,
  filterMeasurements,
  formatMeasurementValue,
  getMeasurementSummary,
  sortMeasurements,
  type BodyMeasurement,
  type CircumferenceField,
  type MeasurementField,
  type MeasurementRange,
} from "@/lib/body-measurements";
import { useWeightUnit } from "@/lib/preferences";
import { kgToUnit, unitToKg, type WeightUnit } from "@/lib/units";
import { useTranslations, translateMeasurementLabel, type Dictionary } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

interface BodyMeasurementsProps {
  userId?: string;
  referenceTime: number;
}

interface MeasurementFormState {
  measuredAt: string;
  weightKg: string;
  waistCm: string;
  hipsCm: string;
  chestCm: string;
  armCm: string;
  thighCm: string;
  note: string;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const emptyForm = (): MeasurementFormState => ({ measuredAt: today(), weightKg: "", waistCm: "", hipsCm: "", chestCm: "", armCm: "", thighCm: "", note: "" });
function rangeOptions(t: Dictionary): Array<{ value: MeasurementRange; label: string }> {
  return [
    { value: "7d", label: t.measurements.range7d },
    { value: "30d", label: t.measurements.range30d },
    { value: "90d", label: t.measurements.range90d },
    { value: "all", label: t.measurements.rangeAll },
  ];
}
const seriesColors: Record<MeasurementField, string> = { weightKg: "#9fbd36", waistCm: "#e4773d", hipsCm: "#7274c9", chestCm: "#3c8fa5", armCm: "#be6e9d", thighCm: "#ba8b35" };

function rowToMeasurement(row: Record<string, unknown>): BodyMeasurement {
  const numberOrNull = (value: unknown) => value === null || value === undefined ? null : Number(value);
  return {
    id: String(row.id),
    measuredAt: String(row.measured_at),
    weightKg: numberOrNull(row.weight_kg),
    waistCm: numberOrNull(row.waist_cm),
    hipsCm: numberOrNull(row.hips_cm),
    chestCm: numberOrNull(row.chest_cm),
    armCm: numberOrNull(row.arm_cm),
    thighCm: numberOrNull(row.thigh_cm),
    note: typeof row.note === "string" && row.note ? row.note : null,
  };
}

function formFromMeasurement(record: BodyMeasurement, weightUnit: WeightUnit): MeasurementFormState {
  const text = (value: number | null) => value === null ? "" : String(value);
  const weightText = record.weightKg === null ? "" : String(Math.round(kgToUnit(record.weightKg, weightUnit) * 10) / 10);
  return { measuredAt: record.measuredAt, weightKg: weightText, waistCm: text(record.waistCm), hipsCm: text(record.hipsCm), chestCm: text(record.chestCm), armCm: text(record.armCm), thighCm: text(record.thighCm), note: record.note || "" };
}

function MeasurementSummaryCard({ records, field, unit, convert = (value) => value }: { records: BodyMeasurement[]; field: MeasurementField; unit: string; convert?: (value: number) => number }) {
  const t = useTranslations();
  const label = translateMeasurementLabel(t, field);
  const summary = getMeasurementSummary(records, field);
  if (!summary) return <article className="measurement-summary-card muted"><span>{label}</span><strong>—</strong><small>{t.measurements.noMeasurementYet}</small></article>;
  const difference = `${summary.difference > 0 ? "+" : ""}${formatMeasurementValue(convert(summary.difference))} ${unit}`;
  const percentage = summary.percentage === null ? "—" : `${summary.percentage > 0 ? "+" : ""}%${formatMeasurementValue(summary.percentage)}`;
  return <article className="measurement-summary-card"><span>{label}</span><strong>{formatMeasurementValue(convert(summary.latest))} <small>{unit}</small></strong><p><b>{difference}</b><em>{percentage}</em></p><small>{t.measurements.sinceFirst}</small></article>;
}

function MeasurementChart({ records, fields, unit, title, convert = (value) => value }: { records: BodyMeasurement[]; fields: MeasurementField[]; unit: string; title: string; convert?: (value: number) => number }) {
  const t = useTranslations();
  const dateLocale = useLocale() === "en" ? "en-US" : "tr-TR";
  const series = fields.map((field) => ({ field, points: records.filter((record) => record[field] !== null).map((record) => ({ date: record.measuredAt, value: convert(record[field] as number) })) })).filter((item) => item.points.length >= 2);
  const values = series.flatMap((item) => item.points.map((point) => point.value));
  if (!series.length) return <div className="measurement-chart-empty"><span>↗</span><div><strong>{t.measurements.chartMinTwo}</strong><p>{t.measurements.chartMinTwoBody}</p></div></div>;
  const width = 720;
  const height = 260;
  const padding = { left: 48, right: 18, top: 24, bottom: 38 };
  const allDates = records.map((record) => record.measuredAt);
  const start = new Date(`${allDates[0]}T00:00:00`).getTime();
  const end = new Date(`${allDates[allDates.length - 1]}T00:00:00`).getTime();
  const dateSpan = Math.max(1, end - start);
  const domain = chartDomain(values);
  const valueSpan = Math.max(1, domain.max - domain.min);
  const x = (date: string) => padding.left + ((new Date(`${date}T00:00:00`).getTime() - start) / dateSpan) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + (1 - (value - domain.min) / valueSpan) * (height - padding.top - padding.bottom);
  const formatDate = (date: string) => new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
  return <div className="measurement-chart-wrap"><svg className="measurement-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.measurements.chartAriaLabel(title, series.map((item) => t.measurements.chartAriaSeries(translateMeasurementLabel(t, item.field), item.points.length)).join(", "))}>
    <title>{title}</title>
    {[0, 1, 2, 3].map((line) => { const value = domain.max - (line / 3) * valueSpan; const lineY = y(value); return <g key={line}><line x1={padding.left} x2={width - padding.right} y1={lineY} y2={lineY} className="chart-grid-line" /><text x={padding.left - 9} y={lineY + 4} textAnchor="end" className="chart-axis-label">{formatMeasurementValue(value)}</text></g>; })}
    {series.map(({ field, points }) => <g key={field}>
      <polyline points={points.map((point) => `${x(point.date)},${y(point.value)}`).join(" ")} fill="none" stroke={seriesColors[field]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => <g key={`${field}-${point.date}`} tabIndex={0} role="img" aria-label={t.measurements.pointAriaLabel(translateMeasurementLabel(t, field), formatDate(point.date), formatMeasurementValue(point.value), unit)}><circle cx={x(point.date)} cy={y(point.value)} r="5" fill={seriesColors[field]} stroke="var(--surface)" strokeWidth="3"><title>{t.measurements.pointTitle(translateMeasurementLabel(t, field), formatDate(point.date), formatMeasurementValue(point.value), unit)}</title></circle></g>)}
    </g>)}
    <text x={padding.left} y={height - 10} className="chart-axis-label">{formatDate(allDates[0])}</text><text x={width - padding.right} y={height - 10} textAnchor="end" className="chart-axis-label">{formatDate(allDates[allDates.length - 1])}</text>
  </svg><div className="chart-legend" aria-hidden="true">{series.map(({ field }) => <span key={field}><i style={{ background: seriesColors[field] }} />{translateMeasurementLabel(t, field)}</span>)}</div></div>;
}

export function BodyMeasurements({ userId, referenceTime }: BodyMeasurementsProps) {
  const t = useTranslations();
  const dateLocale = useLocale() === "en" ? "en-US" : "tr-TR";
  const [records, setRecords] = useState<BodyMeasurement[]>([]);
  const [range, setRange] = useState<MeasurementRange>("30d");
  const [selectedCircumferences, setSelectedCircumferences] = useState<CircumferenceField[]>(["waistCm", "hipsCm"]);
  const [form, setForm] = useState<MeasurementFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const weightUnit = useWeightUnit();
  const toWeightDisplay = (kg: number) => kgToUnit(kg, weightUnit);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadMeasurements() {
      const supabase = createClient();
      if (!supabase) { if (!cancelled) setLoading(false); return; }
      const { data, error: loadError } = await supabase.from("body_measurements").select("*").eq("user_id", userId).order("measured_at", { ascending: true });
      if (cancelled) return;
      setLoading(false);
      if (loadError) { setError(t.measurements.errorLoad); return; }
      setRecords((data || []).map((row) => rowToMeasurement(row as Record<string, unknown>)));
    }
    void loadMeasurements();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!formOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setFormOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [formOpen, saving]);

  const filteredRecords = useMemo(() => filterMeasurements(records, range, referenceTime), [range, records, referenceTime]);

  function updateForm(field: keyof MeasurementFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openNewForm() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  }

  function openEditForm(record: BodyMeasurement) {
    setEditingId(record.id);
    setForm(formFromMeasurement(record, weightUnit));
    setError("");
    setFormOpen(true);
  }

  async function saveMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) { setError(t.measurements.errorSignIn); return; }
    const numericFields = (["weightKg", ...circumferenceFields] as MeasurementField[]).map((field) => {
      const raw = form[field].trim() ? Number(form[field].replace(",", ".")) : null;
      const value = raw !== null && field === "weightKg" ? Math.round(unitToKg(raw, weightUnit) * 100) / 100 : raw;
      return [field, value] as const;
    });
    if (!numericFields.some(([, value]) => value !== null)) { setError(t.measurements.errorAtLeastOne); return; }
    if (numericFields.some(([, value]) => value !== null && (!Number.isFinite(value) || value <= 0))) { setError(t.measurements.errorPositive); return; }
    const supabase = createClient();
    if (!supabase) { setError(t.measurements.errorConnection); return; }
    setSaving(true);
    setError("");
    const values = Object.fromEntries(numericFields);
    const payload = { user_id: userId, measured_at: form.measuredAt, weight_kg: values.weightKg, waist_cm: values.waistCm, hips_cm: values.hipsCm, chest_cm: values.chestCm, arm_cm: values.armCm, thigh_cm: values.thighCm, note: form.note.trim() || null, updated_at: new Date().toISOString() };
    if (editingId) {
      const { data, error: updateError } = await supabase.from("body_measurements").update(payload).eq("id", editingId).eq("user_id", userId).select().single();
      setSaving(false);
      if (updateError || !data) { setError(updateError?.code === "23505" ? t.measurements.errorDuplicateDate : t.measurements.errorUpdateFailed); return; }
      setRecords((current) => sortMeasurements(current.map((record) => record.id === editingId ? rowToMeasurement(data as Record<string, unknown>) : record)));
    } else {
      const id = crypto.randomUUID();
      const { data, error: insertError } = await supabase.from("body_measurements").insert({ id, ...payload }).select().single();
      setSaving(false);
      if (insertError || !data) { setError(insertError?.code === "23505" ? t.measurements.errorDuplicateDate : t.measurements.errorSaveFailed); return; }
      setRecords((current) => sortMeasurements([...current, rowToMeasurement(data as Record<string, unknown>)]));
    }
    setFormOpen(false);
    setEditingId(null);
  }

  async function deleteMeasurement(record: BodyMeasurement) {
    if (!userId || !window.confirm(t.measurements.deleteConfirm(new Intl.DateTimeFormat(dateLocale).format(new Date(`${record.measuredAt}T12:00:00`))))) return;
    const supabase = createClient();
    if (!supabase) { setError(t.measurements.errorConnection); return; }
    const { error: deleteError } = await supabase.from("body_measurements").delete().eq("id", record.id).eq("user_id", userId);
    if (deleteError) { setError(t.measurements.errorDeleteFailed); return; }
    setRecords((current) => current.filter((item) => item.id !== record.id));
  }

  function toggleCircumference(field: CircumferenceField) {
    setSelectedCircumferences((current) => current.includes(field) ? current.length === 1 ? current : current.filter((item) => item !== field) : [...current, field]);
  }

  return <section className="body-measurements" aria-labelledby="body-measurements-title">
    <div className="section-title"><div><div className="eyebrow">{t.measurements.eyebrow}</div><h2 id="body-measurements-title">{t.measurements.title}</h2><p>{t.measurements.body}</p></div><button className="measurement-add" type="button" onClick={openNewForm}>{t.measurements.addMeasurement}</button></div>
    <div className="measurement-range" role="group" aria-label={t.measurements.rangeLabel}>{rangeOptions(t).map((option) => <button type="button" key={option.value} className={range === option.value ? "active" : ""} aria-pressed={range === option.value} onClick={() => setRange(option.value)}>{option.label}</button>)}</div>
    {error && !formOpen && <div className="measurement-error" role="alert">{error}</div>}
    {loading ? <div className="measurement-loading">{t.measurements.loading}</div> : records.length === 0 ? <div className="measurement-empty"><span>↗</span><div><strong>{t.measurements.emptyTitle}</strong><p>{t.measurements.emptyBody}</p><button type="button" onClick={openNewForm}>{t.measurements.addFirst}</button></div></div> : <>
      <div className="measurement-summary-grid"><MeasurementSummaryCard records={filteredRecords} field="weightKg" unit={weightUnit} convert={toWeightDisplay} />{selectedCircumferences.slice(0, 2).map((field) => <MeasurementSummaryCard key={field} records={filteredRecords} field={field} unit="cm" />)}</div>
      <div className="measurement-graphs"><article><div className="measurement-chart-head"><div><span>{t.measurements.weightTrend}</span><h3>{t.measurements.weightChangeTitle}</h3></div><small>{weightUnit}</small></div><MeasurementChart records={filteredRecords} fields={["weightKg"]} unit={weightUnit} convert={toWeightDisplay} title={t.measurements.weightChartTitle} /></article><article><div className="measurement-chart-head"><div><span>{t.measurements.circumferenceLabel}</span><h3>{t.measurements.selectedAreas}</h3></div><small>cm</small></div><div className="measurement-field-picker" role="group" aria-label={t.measurements.circumferenceChartLabel}>{circumferenceFields.map((field) => <button type="button" key={field} aria-pressed={selectedCircumferences.includes(field)} className={selectedCircumferences.includes(field) ? "active" : ""} onClick={() => toggleCircumference(field)}>{translateMeasurementLabel(t, field)}</button>)}</div><MeasurementChart records={filteredRecords} fields={selectedCircumferences} unit="cm" title={t.measurements.circumferenceChartTitle} /></article></div>
      <div className="measurement-history"><div className="measurement-history-head"><h3>{t.measurements.historyTitle}</h3><span>{t.measurements.recordsCount(filteredRecords.length)}</span></div>{filteredRecords.length ? [...filteredRecords].reverse().map((record) => <article key={record.id}><div><strong>{new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${record.measuredAt}T12:00:00`))}</strong><p>{(["weightKg", ...circumferenceFields] as MeasurementField[]).filter((field) => record[field] !== null).map((field) => `${translateMeasurementLabel(t, field)} ${formatMeasurementValue(field === "weightKg" ? toWeightDisplay(record[field] as number) : record[field] as number)} ${field === "weightKg" ? weightUnit : "cm"}`).join(" · ")}</p>{record.note && <small>{record.note}</small>}</div><div className="measurement-row-actions"><button type="button" onClick={() => openEditForm(record)}>{t.measurements.edit}</button><button type="button" className="danger" onClick={() => void deleteMeasurement(record)}>{t.measurements.delete}</button></div></article>) : <div className="measurement-filter-empty">{t.measurements.filterEmpty}</div>}</div>
    </>}
    {formOpen && <div className="measurement-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}><div className="measurement-dialog" role="dialog" aria-modal="true" aria-labelledby="measurement-form-title"><div className="section-title"><div><div className="eyebrow">{editingId ? t.measurements.editMeasurement : t.measurements.newMeasurement}</div><h2 id="measurement-form-title">{t.measurements.saveValues}</h2></div><button type="button" className="measurement-close" aria-label={t.measurements.closeDialog} disabled={saving} onClick={() => setFormOpen(false)}>×</button></div><form onSubmit={(event) => void saveMeasurement(event)}><label className="measurement-date">{t.measurements.measurementDate}<input type="date" required max={today()} value={form.measuredAt} onChange={(event) => updateForm("measuredAt", event.target.value)} /></label><div className="measurement-form-grid">{(["weightKg", ...circumferenceFields] as MeasurementField[]).map((field) => <label key={field}>{translateMeasurementLabel(t, field)} <small>{field === "weightKg" ? weightUnit : "cm"}</small><input type="number" min="1" max={field === "weightKg" ? (weightUnit === "lb" ? "1100" : "500") : "400"} step="0.1" inputMode="decimal" value={form[field]} onChange={(event) => updateForm(field, event.target.value)} placeholder="—" /></label>)}</div><label className="measurement-note">{t.measurements.noteLabel} <small>{t.measurements.optional}</small><textarea maxLength={500} value={form.note} onChange={(event) => updateForm("note", event.target.value)} placeholder={t.measurements.notePlaceholder} /></label>{error && <div className="measurement-error" role="alert">{error}</div>}<div className="measurement-form-actions"><button type="button" disabled={saving} onClick={() => setFormOpen(false)}>{t.measurements.cancel}</button><button type="submit" disabled={saving}>{saving ? t.measurements.saving : editingId ? t.measurements.saveChanges : t.measurements.saveMeasurement}</button></div></form></div></div>}
  </section>;
}
