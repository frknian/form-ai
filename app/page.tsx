"use client";

import { ChangeEvent, useMemo, useState } from "react";

const equipment = ["Dambıl", "Direnç bandı", "Barfiks barı", "Bench", "Kettlebell"];

const workouts = [
  { name: "Goblet Squat", sets: "3 set · 12 tekrar", level: "Bacak", tone: "orange", icon: "◒" },
  { name: "Şınav", sets: "3 set · 10 tekrar", level: "Göğüs", tone: "blue", icon: "✦" },
  { name: "Dambıl Row", sets: "3 set · 12 tekrar", level: "Sırt", tone: "purple", icon: "↗" },
];

export default function Home() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("Kadın");
  const [gym, setGym] = useState("Evde");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(["Dambıl"]);
  const [photo, setPhoto] = useState<string | null>(null);

  const bmi = useMemo(() => {
    const h = Number(height) / 100;
    const w = Number(weight);
    return h && w ? (w / (h * h)).toFixed(1) : "22.4";
  }, [height, weight]);

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
  }

  function toggleEquipment(item: string) {
    setSelectedEquipment((current) => current.includes(item) ? current.filter((x) => x !== item) : [...current, item]);
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark">↗</span><span>form<span className="brand-dot">.</span>ai</span></div>
        <div className="top-links"><span className="active">Antrenmanım</span><span>İlerlemem</span><span>Hareket kütüphanesi</span></div>
        <div className="profile-mini"><span className="mini-avatar">{photo ? <img src={photo} alt="Profil" /> : "E"}</span><span>Profilim</span><span className="chevron">⌄</span></div>
      </nav>

      {step < 4 ? (
        <section className="onboarding-wrap">
          <div className="progress-row"><span className="progress-label">PROFİLİNİ OLUŞTUR</span><span>{step} / 3</span></div>
          <div className="progress-track"><span style={{ width: `${(step / 3) * 100}%` }} /></div>

          {step === 1 && <div className="step-content">
            <div className="eyebrow">Sana özel başlangıç</div>
            <h1>Vücudunu tanı,<br /><em>gücünü keşfet.</em></h1>
            <p className="lead">Birkaç bilgiyle sana uygun, sürdürülebilir bir antrenman planı oluşturalım.</p>
            <div className="form-grid">
              <label className="wide">Adın<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nasıl hitap edelim?" /></label>
              <label>Yaşın<input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="24" /></label>
              <label>Cinsiyet<div className="segmented"><button className={gender === "Kadın" ? "selected" : ""} onClick={() => setGender("Kadın")}>Kadın</button><button className={gender === "Erkek" ? "selected" : ""} onClick={() => setGender("Erkek")}>Erkek</button></div></label>
              <label>Boyun (cm)<input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="168" /></label>
              <label>Kilon (kg)<input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="62" /></label>
            </div>
            <button className="primary-btn" onClick={() => setStep(2)}>Devam et <span>→</span></button>
          </div>}

          {step === 2 && <div className="step-content equipment-step">
            <div className="eyebrow">Planını şekillendirelim</div><h1>Nerede<br /><em>hareket ediyorsun?</em></h1><p className="lead">Sahip olduğun alan ve ekipmanları seç. Programın buna göre uyarlansın.</p>
            <div className="choice-cards"><button className={gym === "Evde" ? "choice selected" : "choice"} onClick={() => setGym("Evde")}><span>⌂</span><strong>Evde</strong><small>Kendi alanımda</small></button><button className={gym === "Salon" ? "choice selected" : "choice"} onClick={() => setGym("Salon")}><span>▦</span><strong>Spor salonunda</strong><small>Full ekipman erişimi</small></button></div>
            <div className="field-caption">SAHİP OLDUĞUN EKİPMANLAR <small>İsteğe bağlı</small></div><div className="equipment-list">{equipment.map((item) => <button key={item} className={selectedEquipment.includes(item) ? "equipment selected" : "equipment"} onClick={() => toggleEquipment(item)}><span className="check">{selectedEquipment.includes(item) ? "✓" : "+"}</span>{item}</button>)}</div>
            <div className="action-row"><button className="back-btn" onClick={() => setStep(1)}>← Geri</button><button className="primary-btn" onClick={() => setStep(3)}>Devam et <span>→</span></button></div>
          </div>}

          {step === 3 && <div className="step-content photo-step">
            <div className="eyebrow">Son dokunuş</div><h1>Hazır olduğunda<br /><em>başlayalım.</em></h1><p className="lead">İstersen bir fotoğraf ekle. Form AI, duruşunu ve hareket formunu analiz ederek önerilerini daha da kişiselleştirsin.</p>
            <label className="upload-box">{photo ? <img src={photo} alt="Yüklenen profil fotoğrafı" /> : <><span className="upload-icon">＋</span><strong>Fotoğraf ekle</strong><small>JPG veya PNG · İsteğe bağlı</small></>}<input type="file" accept="image/*" onChange={handlePhoto} /></label>
            <div className="privacy-note"><span>⌁</span> Fotoğrafın yalnızca analiz için kullanılır ve güvenle saklanır.</div><div className="action-row"><button className="back-btn" onClick={() => setStep(2)}>← Geri</button><button className="primary-btn" onClick={() => setStep(4)}>Planımı oluştur <span>✦</span></button></div>
          </div>}
          <aside className="side-note"><div className="orb"><span>✦</span></div><p><strong>Bilim + senin ritmin.</strong><br />Her plan, hedeflerine ve günlük hayatına uyum sağlar.</p></aside>
        </section>
      ) : (
        <section className="dashboard">
          <div className="dashboard-head"><div><div className="eyebrow">BUGÜNÜN PLANI · 01</div><h1>{name || "Ece"}, <em>hazır mısın?</em></h1><p>Bugün 32 dakika ayırman yeterli. Vücudun teşekkür edecek.</p></div><div className="streak-card"><span>✦</span><strong>4</strong><small>günlük seri</small></div></div>
          <div className="stats-row"><div><span>Vücut kitle indeksi</span><strong>{bmi}</strong><small>Normal aralık</small></div><div><span>Hedef</span><strong>Güçlenme</strong><small>Başlangıç seviyesi</small></div><div><span>Ortam</span><strong>{gym}</strong><small>{selectedEquipment.length ? selectedEquipment.join(" · ") : "Ekipmansız"}</small></div></div>
          <div className="workout-layout"><div className="workout-main"><div className="section-title"><div><div className="eyebrow">BUGÜN</div><h2>Full body · Başlangıç</h2></div><button className="outline-btn">⋮</button></div><div className="workout-list">{workouts.map((workout, index) => <article className="workout-card" key={workout.name}><div className={`exercise-art ${workout.tone}`}><span>{workout.icon}</span><i>{String(index + 1).padStart(2, "0")}</i></div><div className="exercise-info"><div className="pill">{workout.level}</div><h3>{workout.name}</h3><p>{workout.sets}</p></div><button className="play-btn" aria-label={`${workout.name} animasyonunu oynat`}>▶</button></article>)}</div><button className="start-btn" onClick={() => setStep(1)}>Antrenmana başla <span>→</span></button></div><aside className="coach-card"><div className="coach-top"><span className="spark">✦</span><span>FORM AI</span></div><h2>Bugün senden<br /><em>tek bir şey</em> istiyor:</h2><p>Hareketi mükemmel yapmak değil, devam etmek.</p><div className="coach-line" /><small>İyi antrenmanlar, {name || "Ece"}.</small></aside></div>
        </section>
      )}
      <footer><span>form.ai · daha güçlü bir sen için</span><span>© 2024</span></footer>
    </main>
  );
}
