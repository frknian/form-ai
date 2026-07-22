"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { calculateAge, isValidBirthDate, type EditableProfile } from "@/lib/profile";
import { saveProfileWithHistory, signedAvatarUrl } from "@/lib/profile-service";
import { TrainingPlaceSwitch } from "@/components/TrainingPlaceSwitch";

type ProfileManagerProps = {
  user: User;
  profile: EditableProfile;
  avatarUrl: string | null;
  onSaved: (profile: EditableProfile, avatarUrl: string | null) => void;
  onFrozen: () => void;
  onDeleted: () => void;
  onSignOut: () => Promise<void>;
};

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function ProfileManager({ user, profile, avatarUrl, onSaved, onFrozen, onDeleted, onSignOut }: ProfileManagerProps) {
  const [draft, setDraft] = useState(profile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteAccepted, setDeleteAccepted] = useState(false);
  const deleteEmailRef = useRef<HTMLInputElement>(null);
  const age = useMemo(() => calculateAge(draft.birthDate), [draft.birthDate]);
  const shownAvatar = avatarPreview || avatarUrl;

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    if (!deleteOpen) return undefined;
    deleteEmailRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setDeleteOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteOpen, saving]);

  function update<K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMessage("Profil fotoğrafı JPG, PNG veya WebP biçiminde ve en fazla 5 MB olmalı.");
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidBirthDate(draft.birthDate)) {
      setMessage("Geçerli bir doğum tarihi gir.");
      return;
    }
    if (!draft.heightCm || draft.heightCm < 80 || draft.heightCm > 250 || !draft.weightKg || draft.weightKg < 20 || draft.weightKg > 500) {
      setMessage("Boy ve kilo değerlerini geçerli aralıklarda gir.");
      return;
    }
    const client = createClient();
    if (!client) { setMessage("Profil servisine ulaşılamadı."); return; }
    setSaving(true);
    setMessage("");
    let uploadedPath: string | null = null;
    try {
      let nextAvatarPath = draft.avatarPath;
      if (avatarFile) {
        const extension = avatarFile.name.split(".").pop()?.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await client.storage.from("profile-avatars").upload(path, avatarFile, { contentType: avatarFile.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPath = path;
        nextAvatarPath = path;
      }
      const nextProfile = { ...draft, avatarPath: nextAvatarPath };
      await saveProfileWithHistory(client, nextProfile);
      if (uploadedPath && draft.avatarPath) await client.storage.from("profile-avatars").remove([draft.avatarPath]);
      const nextAvatarUrl = await signedAvatarUrl(client, nextAvatarPath);
      setDraft(nextProfile);
      setAvatarFile(null);
      setAvatarPreview(null);
      onSaved(nextProfile, nextAvatarUrl);
      setMessage("Profilin kaydedildi.");
    } catch {
      if (uploadedPath) await client.storage.from("profile-avatars").remove([uploadedPath]);
      setMessage("Profil kaydedilemedi. Veritabanı migration’ını ve bağlantıyı kontrol et.");
    } finally {
      setSaving(false);
    }
  }

  async function freezeAccount() {
    if (!window.confirm("Hesabını dondurmak istediğine emin misin? Verilerin korunacak ve yeniden etkinleştirene kadar uygulama erişimin duracak.")) return;
    const client = createClient();
    if (!client) return;
    setSaving(true);
    const { error } = await client.from("profiles").update({ account_status: "frozen", frozen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", user.id);
    setSaving(false);
    if (error) setMessage("Hesap dondurulamadı.");
    else onFrozen();
  }

  async function deleteAccount() {
    if (deletePhrase !== "HESABIMI SİL" || deleteEmail.trim().toLocaleLowerCase("tr-TR") !== (user.email || "").toLocaleLowerCase("tr-TR") || !deleteAccepted) return;
    const client = createClient();
    if (!client) return;
    setSaving(true);
    setMessage("");
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) {
      setSaving(false);
      setMessage("Güvenli oturum doğrulanamadı. Yeniden giriş yapıp tekrar dene.");
      return;
    }
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ confirmation: deletePhrase, email: deleteEmail.trim() }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Hesap silinemedi");
      await client.auth.signOut();
      onDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hesap silinemedi.");
      setSaving(false);
    }
  }

  return <section className="profile-editor profile-manager" aria-labelledby="profile-manager-title">
    <div className="profile-manager-intro">
      <div className="eyebrow">PROFİLİM</div><h2 id="profile-manager-title">Bilgilerini güncel tut.</h2><p>Boy, kilo, hedef ve antrenman ortamını buradan değiştirebilirsin. Profil fotoğrafın, vücut analizi fotoğrafından ayrıdır.</p>
      <div className="profile-avatar-card"><div className="profile-avatar-preview">{shownAvatar ? <Image className="profile-avatar-image" src={shownAvatar} alt="Profil fotoğrafı" width={76} height={76} unoptimized /> : <span>{draft.displayName.charAt(0).toLocaleUpperCase("tr-TR") || "S"}</span>}</div><div><strong>Profil fotoğrafı</strong><small>JPG, PNG veya WebP · en fazla 5 MB</small><label className="profile-avatar-button">Fotoğrafı {shownAvatar ? "değiştir" : "yükle"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} /></label></div></div>
      <div className="profile-account"><span>DOĞRULANMIŞ HESAP</span><strong>{user.email}</strong><small>E-posta doğrulandı</small><button type="button" onClick={() => void onSignOut()}>Oturumu kapat</button></div>
    </div>

    <form className="profile-editor-fields" onSubmit={save}>
      <div className="profile-personal-grid"><label>ADIN<input required value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} /></label><label>DOĞUM TARİHİN<input required type="date" min="1905-01-01" max={new Date().toISOString().slice(0, 10)} value={draft.birthDate} onChange={(event) => update("birthDate", event.target.value)} /><small>{age === null ? "Yaş otomatik hesaplanır" : `${age} yaş`}</small></label><label>CİNSİYET<select value={draft.gender} onChange={(event) => update("gender", event.target.value)}><option>Kadın</option><option>Erkek</option><option>Belirtmek istemiyorum</option></select></label><label>BOY (CM)<input required type="number" min="80" max="250" step="0.1" value={draft.heightCm ?? ""} onChange={(event) => update("heightCm", numberOrNull(event.target.value))} /></label><label>KİLO (KG)<input required type="number" min="20" max="500" step="0.1" value={draft.weightKg ?? ""} onChange={(event) => update("weightKg", numberOrNull(event.target.value))} /></label></div>
      <TrainingPlaceSwitch value={draft.environment} onChange={(environment) => update("environment", environment)} />
      <label className="textarea-label">HEDEFİN<textarea maxLength={1000} value={draft.goalText} onChange={(event) => update("goalText", event.target.value)} /></label><label className="textarea-label">EKİPMANLARIN<textarea maxLength={1000} value={draft.equipmentText} onChange={(event) => update("equipmentText", event.target.value)} /></label><label className="textarea-label">İSTEDİĞİN HAREKETLER<textarea maxLength={1000} value={draft.requestedExercises} onChange={(event) => update("requestedExercises", event.target.value)} /></label>
      <button className="primary-btn" disabled={saving} type="submit">{saving ? "Kaydediliyor…" : "Profil değişikliklerini kaydet →"}</button>{message && <p className="profile-save-message" role="status">{message}</p>}
    </form>

    <div className="account-danger-zone"><div><span>HESAP YÖNETİMİ</span><strong>Verilerin üzerinde kontrol sende.</strong><p>Dondurma geri alınabilir ve verilerini korur. Silme işlemi tüm hesap verilerini kalıcı olarak kaldırır.</p></div><div><button type="button" disabled={saving} onClick={() => void freezeAccount()}>Hesabı dondur</button><button className="danger" type="button" disabled={saving} onClick={() => setDeleteOpen(true)}>Hesabı sil</button></div></div>

    {deleteOpen && <div className="account-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description"><div className="account-delete-dialog"><span className="danger-label">GERİ DÖNDÜRÜLEMEZ</span><h2 id="delete-account-title">Hesabını kalıcı olarak sil</h2><p id="delete-account-description">Profilin, fotoğrafın, antrenmanların, ölçümlerin, beslenme kayıtların ve diğer kullanıcı verilerin silinir. Bu işlem geri alınamaz.</p><label>E-posta adresini yaz<input ref={deleteEmailRef} type="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} placeholder={user.email || "E-posta"} /></label><label>Onay için <strong>HESABIMI SİL</strong> yaz<input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} /></label><label className="delete-checkbox"><input type="checkbox" checked={deleteAccepted} onChange={(event) => setDeleteAccepted(event.target.checked)} /><span>Tüm verilerimin kalıcı olarak silineceğini anlıyorum.</span></label><div><button type="button" disabled={saving} onClick={() => setDeleteOpen(false)}>Vazgeç</button><button className="danger" type="button" disabled={saving || deletePhrase !== "HESABIMI SİL" || deleteEmail.trim().toLocaleLowerCase("tr-TR") !== (user.email || "").toLocaleLowerCase("tr-TR") || !deleteAccepted} onClick={() => void deleteAccount()}>{saving ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}</button></div></div></div>}
  </section>;
}

export function FrozenAccountScreen({ user, onReactivated, onSignOut }: { user: User; onReactivated: () => void; onSignOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function reactivate() {
    const client = createClient();
    if (!client) return;
    setBusy(true);
    const { error: updateError } = await client.from("profiles").update({ account_status: "active", frozen_at: null, updated_at: new Date().toISOString() }).eq("id", user.id);
    setBusy(false);
    if (updateError) setError("Hesap yeniden etkinleştirilemedi.");
    else onReactivated();
  }
  return <main className="frozen-account"><div className="brand"><span className="brand-mark">↗</span><span>form<span className="brand-dot">.</span>ai</span></div><section><span>HESAP DONDURULDU</span><h1>Verilerin güvende,<br /><em>erişimin duraklatıldı.</em></h1><p>Antrenmanların, ölçümlerin ve profilin korunuyor. Devam etmek istediğinde hesabını yeniden etkinleştirebilirsin.</p>{error && <div role="alert">{error}</div>}<button type="button" disabled={busy} onClick={() => void reactivate()}>{busy ? "Etkinleştiriliyor…" : "Hesabımı yeniden etkinleştir"}</button><button type="button" className="text-button" onClick={() => void onSignOut()}>Oturumu kapat</button></section></main>;
}
