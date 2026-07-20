"use client";

import { useEffect } from "react";
import { ExerciseAnimation } from "./ExerciseAnimation";
import type { Exercise } from "@/types/exercise";

const value = (text: string | null | undefined) => text || "Belirtilmemiş";

export function ExerciseDetail({ exercise, favorite, onClose, onFavorite, onAdd, onOpen }: { exercise: Exercise; favorite: boolean; onClose: () => void; onFavorite: () => void; onAdd: () => void; onOpen: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="exercise-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="exercise-detail"><button type="button" className="detail-close" aria-label="Egzersiz detayını kapat" onClick={onClose} autoFocus>×</button><ExerciseAnimation images={exercise.images} name={exercise.name} intervalMs={800} /><div className="detail-copy"><div className="eyebrow">EGZERSİZ VERİ TABANI</div><h2 id="exercise-detail-title">{exercise.name}</h2><div className="detail-tags"><span>{exercise.primaryMuscles.join(" · ") || "Genel"}</span><span>{value(exercise.equipment)}</span><span>{exercise.level}</span></div><div className="exercise-metadata"><div><span>YARDIMCI KASLAR</span><strong>{exercise.secondaryMuscles.join(" · ") || "—"}</strong></div><div><span>KATEGORİ</span><strong>{exercise.category}</strong></div><div><span>MEKANİK</span><strong>{value(exercise.mechanic)}</strong></div><div><span>KUVVET TÜRÜ</span><strong>{value(exercise.force)}</strong></div></div><section className="detail-instructions"><h3>Adım adım nasıl yapılır?</h3>{exercise.instructions.length ? <ol>{exercise.instructions.map((instruction, index) => <li key={`${exercise.id}-${index}`}>{instruction}</li>)}</ol> : <p>Bu egzersiz için ayrıntılı talimat bulunmuyor.</p>}</section><div className="detail-actions"><button type="button" className="detail-open" onClick={onOpen}>▶ Hareketi aç</button><button type="button" className="detail-add" onClick={onAdd}>＋ Antrenmanıma ekle</button><button type="button" className={favorite ? "detail-favorite active" : "detail-favorite"} aria-pressed={favorite} onClick={onFavorite}>{favorite ? "♥ Favorilerimde" : "♡ Favorilere ekle"}</button></div></div></article></div>;
}
