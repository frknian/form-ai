"use client";

import { useMemo, useState } from "react";
import { ExerciseAnimation, exerciseLibrary, catalogItemToWorkout, getMotionGuide, type AiWorkout, type CatalogItem } from "@/components/FitAiApp";
import { OnboardingIcon } from "@/components/onboarding/OnboardingIcon";
import { buildReadyProgram, matchesProfile } from "@/lib/ready-programs";
import {
  CUSTOM_PROGRAM_SLOTS,
  customSlotId,
  nextFreeSlot,
  placeToProfile,
  programKey,
  type CustomProgram,
  type ProgramProgress,
  type TrainingPlace,
} from "@/lib/training-programs";
import { useTranslations } from "@/lib/i18n/translate";

// Bölgesel programın seçenekleri; katalogdaki gerçek `area` değerleri.
const BODY_REGIONS = ["Göğüs", "Sırt", "Bacak", "Kalça", "Omuz", "Kol", "Core"] as const;

type Selection =
  | { kind: "smart" }
  | { kind: "fullBody"; place: TrainingPlace }
  | { kind: "split"; place: TrainingPlace; area: string }
  | { kind: "custom"; id: string };

export function TrainingPrograms({
  equipmentText, isGym, smartWorkouts, customPrograms, progress,
  onStart, onSaveCustom, onDeleteCustom, smartExtra, smartFallback = false,
}: {
  equipmentText: string;
  /** Profildeki ortam. Sayfadaki salon/ev seçimi kaldırıldı: kullanıcı bunu
      profil testinde zaten söylüyordu ve iki yerde durunca ekrandaki seçim
      profili sessizce eziyor, evde çalışan birine salon aleti çıkarabiliyordu. */
  isGym: boolean;
  /** Profil testinden AI'ın ürettiği program. Boşsa akıllı kart kilitli. */
  smartWorkouts: AiWorkout[];
  customPrograms: CustomProgram[];
  progress: Record<string, ProgramProgress>;
  onStart: (workouts: AiWorkout[], key: string) => void;
  onSaveCustom: (program: CustomProgram) => void;
  onDeleteCustom: (id: string) => void;
  /** Akıllı programın altında gösterilecek AI raporu / uyarlama kartı. */
  smartExtra?: React.ReactNode;
  /** Program AI'dan değil, yerel yedekten geldi. */
  smartFallback?: boolean;
}) {
  const t = useTranslations();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [builderId, setBuilderId] = useState<string | null>(null);
  // Hazır programlar arasında geçiş: üç kart alt alta uzayıp ekranı
  // doldurmasın diye tek panel, üstünde anahtar.
  const [tab, setTab] = useState<"smart" | "fullBody" | "split">("smart");
  const place: TrainingPlace = isGym ? "gym" : "home";

  function regionLabel(area: string): string {
    const map: Record<string, string> = {
      "Göğüs": t.programs.regionChest, "Sırt": t.programs.regionBack, "Bacak": t.programs.regionLegs,
      "Kalça": t.programs.regionHips, "Omuz": t.programs.regionShoulders, "Kol": t.programs.regionArms, "Core": t.programs.regionCore,
    };
    return map[area] ?? area;
  }

  // Seçili programın hareketleri. Hepsi TEK yerden üretilir; kart ile açılan
  // liste arasında fark olmaması için başlangıç da bu listeyi kullanır.
  const activeExercises = useMemo<CatalogItem[]>(() => {
    if (!selection) return [];
    if (selection.kind === "smart") return [];
    if (selection.kind === "custom") {
      const program = customPrograms.find((item) => item.id === selection.id);
      if (!program) return [];
      // İsimle saklanır; katalogdan düşen bir hareket sessizce atlanır.
      return program.exerciseNames
        .map((name) => exerciseLibrary.find((item) => item.name === name))
        .filter((item): item is CatalogItem => Boolean(item));
    }
    const profile = placeToProfile(selection.place, equipmentText);
    if (selection.kind === "fullBody") return buildReadyProgram(exerciseLibrary, profile);
    return exerciseLibrary
      .filter((item) => item.area === selection.area && matchesProfile(item, profile))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .slice(0, 6);
  }, [selection, equipmentText, customPrograms]);

  const activeKey = selection
    ? selection.kind === "custom" ? programKey("custom", undefined, selection.id)
      : selection.kind === "smart" ? programKey("smart")
      : programKey(selection.kind, selection.place)
    : "";

  function startSelection() {
    if (!selection) return;
    if (selection.kind === "smart") { onStart(smartWorkouts, activeKey); return; }
    if (activeExercises.length) onStart(activeExercises.map(catalogItemToWorkout), activeKey);
  }

  function progressLabel(key: string) {
    const entry = progress[key];
    if (!entry?.sessions) return t.programs.notStarted;
    return t.programs.sessionCount(entry.sessions);
  }

  // --- Özel program kurucusu ---
  if (builderId) {
    const existing = customPrograms.find((program) => program.id === builderId);
    return <CustomProgramBuilder
      slotId={builderId}
      initial={existing}
      onCancel={() => setBuilderId(null)}
      onSave={(program) => { onSaveCustom(program); setBuilderId(null); setSelection({ kind: "custom", id: program.id }); }}
      onDelete={existing ? () => { onDeleteCustom(existing.id); setBuilderId(null); } : undefined}
    />;
  }

  // --- Seçili programın hareket listesi ---
  if (selection) {
    const title = selection.kind === "smart" ? t.programs.smartTitle
      : selection.kind === "fullBody" ? t.programs.fullBodyTitle
      : selection.kind === "split" ? regionLabel(selection.area)
      : customPrograms.find((program) => program.id === selection.id)?.name ?? t.programs.customTitle;
    const list: AiWorkout[] = selection.kind === "smart" ? smartWorkouts : activeExercises.map(catalogItemToWorkout);

    return <section className="programs" id="ready-programs">
      <div className="section-title"><div className="eyebrow">{t.programs.eyebrow}</div><button type="button" className="back-btn" onClick={() => setSelection(null)}>{t.programs.backToPrograms}</button></div>
      <h2>{title}</h2>
      {/* Ortam etiketi kaldırıldı: seçim artık profilden geliyor, ekranda
          değiştirilebilir bir şey değil. */}
      <p className="programs-note">{progressLabel(activeKey)}</p>
      {selection.kind === "smart" && smartFallback && <p className="programs-note programs-fallback">{t.programs.smartFallbackNote}</p>}

      {list.length ? <>
        <button type="button" className="start-btn" onClick={startSelection}>{t.programs.startSession} <span>→</span></button>
        {/* Hareket anlatımı listede kalır: kullanıcı başlamadan önce ne
            yapacağını görebilmeli, oynatıcıya girmek zorunda kalmamalı. */}
        <div className="program-exercise-list">{list.map((item) => {
          const guide = getMotionGuide(item);
          return <article key={item.name}>
            {/* Listede animasyon OYNAMAZ: onlarca kareyi aynı anda döndürmek
                telefonda hem pili hem kaydırmayı yiyordu. */}
            <ExerciseAnimation exercise={item} compact autoplay={false} />
            <div>
              <strong>{item.name}</strong>
              <small>{item.area} · {item.sets} · {item.rest}</small>
              <details className="how-to"><summary>{t.dashboard.howTo}</summary>
                <ol className="mini-steps"><li>{guide.start}</li><li>{item.instructions}</li><li>{guide.finish}</li></ol>
              </details>
            </div>
          </article>;
        })}</div>
        {selection.kind === "custom" && <button type="button" className="program-edit" onClick={() => setBuilderId(selection.id)}>{t.programs.editProgram}</button>}
        {/* AI'ın planı neden böyle kurduğu, akıllı programın kendi ekranında
            durur; genel antrenman sekmesinde bağlamsız kalıyordu. */}
        {selection.kind === "smart" && smartExtra}
      </> : <div className="library-empty"><strong>{t.programs.emptyTitle}</strong><p>{selection.kind === "smart" ? t.programs.smartEmptyBody : t.programs.emptyBody}</p></div>}
    </section>;
  }

  // --- Program seçimi ---
  const freeSlot = nextFreeSlot(customPrograms);
  return <section className="programs" id="ready-programs">
    <div className="section-title"><div className="eyebrow">{t.programs.eyebrow}</div><span className="programs-hint">{t.programs.hint}</span></div>

    {/* Dar ekranda hazır programlar tek panelde, üstünde anahtar: üç kart alt
        alta durunca sayfa uzuyordu. Geniş ekranda yer var, orada anahtar
        gizlenir ve üç kart yan yana görünür — bu yüzden üçü de HER ZAMAN
        render edilir, hangisinin görüneceğine CSS karar verir. */}
    <div className="program-switch" role="tablist" aria-label={t.programs.eyebrow}>
      <button type="button" role="tab" aria-selected={tab === "smart"} className={tab === "smart" ? "selected" : ""} onClick={() => setTab("smart")}>{t.programs.smartTitle}</button>
      <button type="button" role="tab" aria-selected={tab === "fullBody"} className={tab === "fullBody" ? "selected" : ""} onClick={() => setTab("fullBody")}>{t.programs.fullBodyTitle}</button>
      <button type="button" role="tab" aria-selected={tab === "split"} className={tab === "split" ? "selected" : ""} onClick={() => setTab("split")}>{t.programs.splitTitle}</button>
    </div>

    <div className="program-panel">
      <article className={tab === "smart" ? "program-card program-panel-item active" : "program-card program-panel-item"}>
        <OnboardingIcon name="condition" />
        <h3>{t.programs.smartTitle}</h3>
        <p>{smartFallback ? t.programs.smartFallbackBody : t.programs.smartBody}</p>
        <small>{progressLabel(programKey("smart"))}</small>
        <button type="button" disabled={!smartWorkouts.length} onClick={() => setSelection({ kind: "smart" })}>
          {smartWorkouts.length ? t.programs.open : t.programs.smartLocked} {smartWorkouts.length ? <span>→</span> : null}
        </button>
      </article>

      <article className={tab === "fullBody" ? "program-card program-panel-item active" : "program-card program-panel-item"}>
        <OnboardingIcon name="strength" />
        <h3>{t.programs.fullBodyTitle}</h3>
        <p>{t.programs.fullBodyBody}</p>
        <small>{progressLabel(programKey("fullBody", place))}</small>
        <button type="button" onClick={() => setSelection({ kind: "fullBody", place })}>{t.programs.open} <span>→</span></button>
      </article>

      <article className={tab === "split" ? "program-card program-panel-item active" : "program-card program-panel-item"}>
        <OnboardingIcon name="muscle" />
        <h3>{t.programs.splitTitle}</h3>
        <p>{t.programs.splitBody}</p>
        <div className="program-regions">{BODY_REGIONS.map((area) => (
          <button type="button" key={area} className="equipment" onClick={() => setSelection({ kind: "split", place, area })}>{regionLabel(area)}</button>
        ))}</div>
      </article>
    </div>

    {/* Kendi programların en altta, üçü yan yana. */}
    <div className="program-cards program-custom-row">
      {Array.from({ length: CUSTOM_PROGRAM_SLOTS }, (_, index) => {
        const id = customSlotId(index);
        const program = customPrograms.find((item) => item.id === id);
        if (!program) {
          return <article className="program-card program-card-empty" key={id}>
            <OnboardingIcon name="health" />
            <h3>{t.programs.createTitle}</h3>
            <p>{t.programs.createBody}</p>
            <button type="button" disabled={freeSlot !== id} onClick={() => setBuilderId(id)}>{t.programs.create} <span>+</span></button>
          </article>;
        }
        return <article className="program-card" key={id}>
          <OnboardingIcon name="health" />
          <h3>{program.name}</h3>
          <p>{t.programs.customCount(program.exerciseNames.length)}</p>
          <small>{progressLabel(programKey("custom", undefined, id))}</small>
          <button type="button" onClick={() => setSelection({ kind: "custom", id })}>{t.programs.open} <span>→</span></button>
        </article>;
      })}
    </div>

  </section>;
}

/** Hareket kütüphanesinden seçerek kendi programını kurma ekranı. */
function CustomProgramBuilder({ slotId, initial, onSave, onCancel, onDelete }: {
  slotId: string;
  initial?: CustomProgram;
  onSave: (program: CustomProgram) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations();
  const [name, setName] = useState(initial?.name ?? "");
  const [picked, setPicked] = useState<string[]>(initial?.exerciseNames ?? []);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>("");

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return exerciseLibrary
      .filter((item) => (!area || item.area === area) && (!needle || `${item.name} ${item.english}`.toLocaleLowerCase("tr-TR").includes(needle)))
      .slice(0, 40);
  }, [query, area]);

  function toggle(exerciseName: string) {
    setPicked((current) => current.includes(exerciseName)
      ? current.filter((item) => item !== exerciseName)
      : current.length >= 12 ? current : [...current, exerciseName]);
  }

  return <section className="programs" id="ready-programs">
    <div className="section-title"><div className="eyebrow">{t.programs.builderEyebrow}</div><button type="button" className="back-btn" onClick={onCancel}>{t.programs.backToPrograms}</button></div>
    <h2>{t.programs.builderTitle}</h2>

    <label className="textarea-label">{t.programs.nameLabel}
      <input className="program-name-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={t.programs.namePlaceholder} maxLength={60} />
    </label>

    <div className="program-filters">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.programs.searchPlaceholder} aria-label={t.programs.searchPlaceholder} />
      <select value={area} onChange={(event) => setArea(event.target.value)} aria-label={t.programs.areaFilter}>
        <option value="">{t.programs.allAreas}</option>
        {[...new Set(exerciseLibrary.map((item) => item.area))].sort((a, b) => a.localeCompare(b, "tr")).map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>

    <p className="programs-note">{t.programs.pickedCount(picked.length)}</p>
    <div className="program-picker">{results.map((item) => {
      const selected = picked.includes(item.name);
      return <button type="button" key={item.name} aria-pressed={selected} className={selected ? "program-pick selected" : "program-pick"} onClick={() => toggle(item.name)}>
        <strong>{item.name}</strong><small>{item.area}</small>
      </button>;
    })}</div>

    <div className="action-row">
      {onDelete && <button type="button" className="back-btn program-delete" onClick={onDelete}>{t.programs.deleteProgram}</button>}
      <button type="button" className="primary-btn" disabled={!picked.length} onClick={() => onSave({
        id: slotId,
        name: name.trim() || t.programs.customTitle,
        exerciseNames: picked,
        updatedAt: new Date().toISOString(),
      })}>{t.programs.saveProgram} <span>→</span></button>
    </div>
  </section>;
}
