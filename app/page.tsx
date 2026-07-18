"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fitnessSources } from "@/lib/knowledge-sources";

const historyQuestions = [
  "Daha önce düzenli olarak spor yaptın mı?",
  "Son 3 ayda haftada kaç gün hareket ettin?",
  "Kendini hangi seviyede görüyorsun?",
  "Bir antrenmana ortalama ne kadar zaman ayırabilirsin?",
  "Şu anki ana hedefin nedir?",
  "Hangi antrenman türleri ilgini çekiyor?",
  "Bilinen bir sakatlığın veya ağrı bölgen var mı?",
  "Gün içinde genel hareket düzeyin nasıl?",
  "Uyku düzenini nasıl değerlendirirsin?",
  "Programınla ilgili özellikle bilmemiz gereken başka bir şey var mı?",
];

const answerOptions = [
  ["Hayır", "Ara sıra", "Düzenli"],
  ["0 gün", "1–2 gün", "3–4 gün", "5+ gün"],
  ["Yeni başlıyorum", "Orta seviye", "İleri seviye"],
  ["15 dakika", "30 dakika", "45 dakika", "60+ dakika"],
  ["Kilo vermek", "Güçlenmek", "Kas geliştirmek", "Kondisyon"],
  ["Kuvvet", "Kardiyo", "Esneklik", "Karışık"],
  ["Yok", "Bel", "Diz", "Omuz", "Diğer"],
  ["Düşük", "Orta", "Yüksek"],
  ["Düzensiz", "Fena değil", "İyi"],
];

const exerciseLibrary = [
  { name: "Goblet Squat", english: "Goblet Squat", area: "Bacak", tone: "orange", icon: "◒", requires: ["dambıl", "kettlebell"], bodyweight: true, goals: ["güç", "kas", "kilo"] },
  { name: "Eğimli Şınav", english: "Incline Push-up", area: "Göğüs", tone: "blue", icon: "✦", requires: ["bench", "sehpa"], bodyweight: true, goals: ["güç", "kondisyon", "kilo"] },
  { name: "Dambıl Row", english: "Dumbbell Row", area: "Sırt", tone: "purple", icon: "↗", requires: ["dambıl"], bodyweight: false, goals: ["güç", "kas"] },
  { name: "Glute Bridge", english: "Glute Bridge", area: "Kalça", tone: "orange", icon: "◓", requires: [], bodyweight: true, goals: ["güç", "kilo"] },
  { name: "Plank", english: "Plank", area: "Core", tone: "blue", icon: "—", requires: [], bodyweight: true, goals: ["güç", "kondisyon", "kilo"] },
  { name: "Reverse Lunge", english: "Reverse Lunge", area: "Bacak", tone: "purple", icon: "↘", requires: [], bodyweight: true, goals: ["güç", "kilo", "kondisyon"] },
  { name: "Band Row", english: "Resistance Band Row", area: "Sırt", tone: "blue", icon: "↔", requires: ["band", "lastik"], bodyweight: false, goals: ["güç", "kas"] },
];

function createPersonalPlan(gym: string, equipmentText: string, history: string[], goalText: string) {
  const profileText = `${equipmentText} ${goalText} ${history.join(" ")}`.toLowerCase();
  const goal = profileText.includes("kilo") || profileText.includes("yağ") ? "kilo" : profileText.includes("kas") ? "kas" : profileText.includes("kondisyon") ? "kondisyon" : "güç";
  const isBeginner = history[2] === "Yeni başlıyorum" || !history[2];
  const wantsGym = gym === "Salon";
  const equipment = equipmentText.toLowerCase();
  const matchesEquipment = (item: typeof exerciseLibrary[number]) => wantsGym || item.bodyweight || item.requires.some((requirement) => equipment.includes(requirement));
  const selected = exerciseLibrary.filter((item) => matchesEquipment(item) && item.goals.includes(goal));
  const fallback = exerciseLibrary.filter(matchesEquipment);
  const chosen = [...selected, ...fallback].filter((item, index, list) => list.findIndex((candidate) => candidate.name === item.name) === index).slice(0, 5);
  const sets = isBeginner ? 3 : 4;
  const reps = goal === "kondisyon" || goal === "kilo" ? 12 : isBeginner ? 10 : 8;
  const rest = isBeginner ? 60 : 90;
  return chosen.map((item) => ({ ...item, level: item.area, sets: `${sets} set · ${item.name === "Plank" ? "30 sn" : `${reps} tekrar`}`, rest: `${rest} sn dinlenme`, seconds: item.name === "Plank" ? 30 : 45 }));
}

type AiWorkout = { name: string; english: string; area: string; sets: string; rest: string; seconds: number; tone: string; icon: string; level: string };

function normalizeAiWorkouts(items: Array<{ name: string; english: string; area: string; sets: number; reps: string; restSeconds: number }>): AiWorkout[] {
  const visuals: Record<string, { tone: string; icon: string }> = { Bacak: { tone: "orange", icon: "◒" }, Göğüs: { tone: "blue", icon: "✦" }, Sırt: { tone: "purple", icon: "↗" }, Kalça: { tone: "orange", icon: "◓" }, Core: { tone: "blue", icon: "—" } };
  return items.map((item) => ({ ...item, sets: `${item.sets} set · ${item.reps}`, rest: `${item.restSeconds} sn dinlenme`, seconds: item.reps.includes("sn") ? 30 : 45, level: item.area, ...(visuals[item.area] || { tone: "purple", icon: "✦" }) }));
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("Kadın");
  const [gym, setGym] = useState("Evde");
  const [equipmentText, setEquipmentText] = useState("");
  const [goalText, setGoalText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(Array(10).fill(""));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCalories, setSessionCalories] = useState(0);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [aiWorkouts, setAiWorkouts] = useState<AiWorkout[]>([]);
  const [aiRationale, setAiRationale] = useState("");
  const [aiSafetyNote, setAiSafetyNote] = useState("");

  const workouts = useMemo(() => aiWorkouts.length ? aiWorkouts : createPersonalPlan(gym, equipmentText, history, goalText), [aiWorkouts, gym, equipmentText, history, goalText]);
  const planLevel = history[2] || "Yeni başlıyorum";
  const planGoal = history[4] || goalText || "Güçlenme";
  const planSources = fitnessSources.slice(0, 3);

  const bmi = useMemo(() => {
    const h = Number(height) / 100;
    const w = Number(weight);
    return h && w ? (w / (h * h)).toFixed(1) : "22.4";
  }, [height, weight]);

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
  }

  function setAnswer(answer: string) {
    setHistory((current) => current.map((value, index) => index === questionIndex ? answer : value));
    if (questionIndex < 9) window.setTimeout(() => setQuestionIndex((current) => current + 1), 220);
  }

  useEffect(() => {
    if (!isRunning || activeWorkout === null) return;
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          setIsRunning(false);
          return 0;
        }
        return current - 1;
      });
      setSessionCalories((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, activeWorkout]);

  function openWorkout(index: number) {
    setActiveWorkout(index);
    setTimer(workouts[index].seconds);
    setIsRunning(false);
  }

  function finishWorkout() {
    setIsRunning(false);
    setSessionCalories((current) => Math.max(current, 1));
    setActiveWorkout(null);
  }

  async function createPlan() {
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        display_name: name || "Sporcu",
        age: Number(age) || null,
        gender,
        height_cm: Number(height) || null,
        weight_kg: Number(weight) || null,
        environment: gym,
        equipment_text: equipmentText,
        goal_text: goalText,
        history_answers: history,
        photo_url: null,
      }, { onConflict: "id" });
      }
    }
    try {
      const aiResponse = await fetch("/api/generate-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, age, gender, height, weight, environment: gym, equipment: equipmentText, goal: goalText, history }) });
      if (aiResponse.ok) {
        const aiPlan = await aiResponse.json() as { workouts?: Array<{ name: string; english: string; area: string; sets: number; reps: string; restSeconds: number }>; rationale?: string; safetyNote?: string };
        if (aiPlan.workouts?.length) setAiWorkouts(normalizeAiWorkouts(aiPlan.workouts));
        setAiRationale(aiPlan.rationale || "");
        setAiSafetyNote(aiPlan.safetyNote || "");
      }
    } catch {
      // The local source-based planner remains the safe fallback when the API is unavailable.
    }
    setSaving(false);
    setStep(5);
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark">↗</span><span>form<span className="brand-dot">.</span>ai</span></div>
        <div className="top-links"><span className="active">Antrenmanım</span><span>İlerlemem</span><span>Hareket kütüphanesi</span></div>
        <div className="profile-mini"><span className="mini-avatar">{name ? name.charAt(0).toUpperCase() : "E"}</span><span>Profilim</span><span className="chevron">⌄</span></div>
      </nav>

      {step < 5 ? (
        <section className="onboarding-wrap">
          <div className="progress-row"><span className="progress-label">{step === 4 ? "SPOR GEÇMİŞİ TESTİ" : "PROFİLİNİ OLUŞTUR"}</span><span>{step} / 4</span></div>
          <div className="progress-track"><span style={{ width: `${(step / 4) * 100}%` }} /></div>

          {step === 1 && <div className="step-content">
            <div className="eyebrow">Sana özel başlangıç</div><h1>Vücudunu tanı,<br /><em>gücünü keşfet.</em></h1><p className="lead">Birkaç bilgiyle sana uygun, sürdürülebilir bir antrenman planı oluşturalım.</p>
            <div className="form-grid">
              <label className="wide">Adın<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nasıl hitap edelim?" /></label>
              <label>Yaşın<input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="24" /></label>
              <label>Cinsiyet<div className="segmented"><button type="button" className={gender === "Kadın" ? "selected" : ""} onClick={() => setGender("Kadın")}>Kadın</button><button type="button" className={gender === "Erkek" ? "selected" : ""} onClick={() => setGender("Erkek")}>Erkek</button></div></label>
              <label>Boyun (cm)<input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="168" /></label>
              <label>Kilon (kg)<input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="62" /></label>
            </div>
            <button className="primary-btn" type="button" onClick={() => setStep(2)}>Devam et <span>→</span></button>
          </div>}

          {step === 2 && <div className="step-content equipment-step">
            <div className="eyebrow">Planını şekillendirelim</div><h1>Nerede<br /><em>hareket ediyorsun?</em></h1><p className="lead">Ortamını ve elindeki ekipmanları kendi cümlelerinle anlat.</p>
            <div className="choice-cards"><button type="button" className={gym === "Evde" ? "choice selected" : "choice"} onClick={() => setGym("Evde")}><span>⌂</span><strong>Evde</strong><small>Kendi alanımda</small></button><button type="button" className={gym === "Salon" ? "choice selected" : "choice"} onClick={() => setGym("Salon")}><span>▦</span><strong>Spor salonunda</strong><small>Full ekipman erişimi</small></button></div>
            <label className="textarea-label">EKİPMANLARIN <small>İsteğe bağlı</small><textarea value={equipmentText} onChange={(e) => setEquipmentText(e.target.value)} placeholder="Örn. 2 adet 5 kg dambıl, yoga matı ve direnç bandı" /></label>
            <label className="textarea-label">HEDEFİN <small>Programı daha kişisel yapar</small><textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder="Örn. Daha güçlü olmak ve 30 dakikada tamamlanan programlar yapmak istiyorum." /></label>
            <div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(1)}>← Geri</button><button className="primary-btn" type="button" onClick={() => setStep(3)}>Devam et <span>→</span></button></div>
          </div>}

          {step === 3 && <div className="step-content photo-step">
            <div className="eyebrow">İSTEĞE BAĞLI VÜCUT ANALİZİ</div><h1>Vücudunu daha iyi<br /><em>anlayalım.</em></h1><p className="lead">Fotoğraf profil resmi değildir. İzninle vücut kompozisyonu ve yağlanma dağılımı hakkında yaklaşık gözlem yapıp programı buna göre uyarlayacağız.</p>
            <label className="upload-box">{photo ? <img src={photo} alt="Vücut analizi için yüklenen fotoğraf" /> : <><span className="upload-icon">＋</span><strong>Vücut fotoğrafı ekle</strong><small>Yüz görünmek zorunda değil · İsteğe bağlı</small></>}<input type="file" accept="image/*" onChange={handlePhoto} /></label>
            <div className="privacy-note"><span>⌁</span> Analiz tahminidir; tıbbi yağ oranı ölçümü değildir. Fotoğrafını istediğinde silebilirsin.</div><div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(2)}>← Geri</button><button className="primary-btn" type="button" onClick={() => setStep(4)}>Teste başla <span>→</span></button></div>
          </div>}

          {step === 4 && <div className="step-content history-step">
            <div className="eyebrow">SORU {questionIndex + 1} / 10</div><h1>Seni biraz<br /><em>daha tanıyalım.</em></h1><p className="lead">Cevapların programın yoğunluğunu, hareket seçimini ve ilerleme hızını belirleyecek.</p>
            <div className="question-card"><span className="question-number">{String(questionIndex + 1).padStart(2, "0")}</span><h2>{historyQuestions[questionIndex]}</h2><div className="answer-grid">{(answerOptions[questionIndex] ?? []).map((answer) => <button type="button" key={answer} className={history[questionIndex] === answer ? "answer selected" : "answer"} onClick={() => setAnswer(answer)}>{answer}</button>)}</div>{questionIndex === 9 && <textarea className="question-note" value={history[9]} onChange={(e) => setAnswer(e.target.value)} placeholder="Buraya yazabilirsin..." />}</div>
            <div className="action-row"><button className="back-btn" type="button" onClick={() => questionIndex ? setQuestionIndex(questionIndex - 1) : setStep(3)}>← Geri</button>{questionIndex < 9 ? <button className="primary-btn" type="button" onClick={() => setQuestionIndex(questionIndex + 1)}>Sonraki <span>→</span></button> : <button className="primary-btn" type="button" onClick={createPlan} disabled={saving}>{saving ? "Kaydediliyor…" : "Planımı oluştur ✦"}</button>}</div>
          </div>}
          <aside className="side-note"><div className="orb"><span>✦</span></div><p><strong>Bilim + senin ritmin.</strong><br />Her plan, hedeflerine ve günlük hayatına uyum sağlar.</p></aside>
        </section>
      ) : (
        <section className="dashboard">
          {activeWorkout !== null ? <div className="workout-player"><button className="back-btn" type="button" onClick={() => { setIsRunning(false); setActiveWorkout(null); }}>← Plana dön</button><div className={`player-art ${workouts[activeWorkout].tone} ${isRunning ? "is-animating" : ""}`}><span>{workouts[activeWorkout].icon}</span><i>HAREKET ANİMASYONU</i></div><div className="eyebrow">HAREKET {activeWorkout + 1} / {workouts.length}</div><h1>{workouts[activeWorkout].name}</h1><p className="lead">Hareketi kontrollü yap, nefesini tutma ve ağrı hissedersen dur.</p><div className="timer-card"><span>{isRunning ? "AKTİF SET" : timer === 0 ? "SET TAMAMLANDI" : "HAZIR"}</span><strong>00:{String(timer).padStart(2, "0")}</strong><small>Yaklaşık {sessionCalories} kcal</small></div><div className="player-meta"><strong>{workouts[activeWorkout].sets}</strong><span>{workouts[activeWorkout].level}</span></div><div className="player-actions"><button className="outline-btn" type="button" onClick={() => openWorkout(activeWorkout > 0 ? activeWorkout - 1 : workouts.length - 1)}>← Önceki</button><button className="start-btn" type="button" onClick={() => timer === 0 ? openWorkout((activeWorkout + 1) % workouts.length) : setIsRunning((running) => !running)}>{isRunning ? "Duraklat" : timer === 0 ? "Sonraki hareket" : "Seti başlat"} <span>→</span></button></div><button className="finish-btn" type="button" onClick={finishWorkout}>✓ Antrenmanı bitir</button></div> : <>
          <div className="dashboard-head"><div><div className="eyebrow">BUGÜNÜN PLANI · 01</div><h1>{name || "Ece"}, <em>hazır mısın?</em></h1><p>Verilerine göre ilk program taslağını hazırladık. İlerledikçe daha da kişiselleştireceğiz.</p></div><div className="streak-card"><span>✦</span><strong>4</strong><small>günlük seri</small></div></div>
          <div className="stats-row"><div><span>Vücut kitle indeksi</span><strong>{bmi}</strong><small>İlk ölçüm</small></div><div><span>Hedef</span><strong>{goalText ? "Kişisel" : "Güçlenme"}</strong><small>Profiline göre</small></div><div><span>Ortam</span><strong>{gym}</strong><small>{equipmentText || "Ekipmansız"}</small></div></div>
          <div className="wellness-row"><div className="wellness-card calorie-card"><div><span>BUGÜNÜN KALORİSİ</span><strong>{sessionCalories || 0} <small>kcal</small></strong><p>Antrenman + adım verileriyle hesaplanır.</p></div><div className="calorie-ring"><i>{sessionCalories || 0}</i></div></div><div className="wellness-card"><div className="integration-title"><span>SPOTIFY</span><b>♫</b></div><h3>{spotifyConnected ? "Antrenman listesi bağlı" : "Ritmini seç"}</h3><p>{spotifyConnected ? "Form AI Workout çalıyor." : "Antrenman sırasında playlist'in yanında olsun."}</p><button className="connect-btn" type="button" onClick={() => setSpotifyConnected((connected) => !connected)}>{spotifyConnected ? "Bağlantıyı kes" : "Spotify'ı bağla"}</button></div><div className="wellness-card"><div className="integration-title"><span>ADIM TAKİBİ</span><b>⌁</b></div><h3>{healthConnected ? "Adımlar bağlı" : "Hareketini içeri al"}</h3><p>{healthConnected ? "Bugünkü adımların senkronize ediliyor." : "Google Fit, Samsung Health, Huawei Health veya Xiaomi desteği."}</p><button className="connect-btn" type="button" onClick={() => setHealthConnected((connected) => !connected)}>{healthConnected ? "Bağlantıyı kes" : "Adım hesabını bağla"}</button></div></div>
          <div className="plan-explanation"><div><div className="eyebrow">PLANIN NEDEN BÖYLE?</div><h2>{planLevel} · {planGoal}</h2><p>{aiRationale || "Programın; seçtiğin ortam, ekipmanların, spor geçmişin ve yazdığın hedef birlikte değerlendirilerek oluşturuldu. İlerledikçe set, tekrar ve hareket varyasyonları güncellenecek."}</p>{aiSafetyNote && <div className="ai-safety"><strong>Güvenlik notu</strong><span>{aiSafetyNote}</span></div>}</div><div className="source-stack">{planSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title.split(" — ")[0]} <span>↗</span></a>)}</div></div>
          <div className="workout-layout"><div className="workout-main"><div className="section-title"><div><div className="eyebrow">BUGÜN</div><h2>Full body · {planLevel}</h2></div><button className="outline-btn" type="button">⋮</button></div><div className="workout-list">{workouts.map((workout, index) => <article className="workout-card" key={workout.name}><div className={`exercise-art ${workout.tone}`}><span>{workout.icon}</span><i>{String(index + 1).padStart(2, "0")}</i></div><div className="exercise-info"><div className="pill">{workout.level}</div><h3>{workout.name} <small>{workout.english}</small></h3><p>{workout.sets} · {workout.rest}</p></div><button className="play-btn" type="button" aria-label={`${workout.name} animasyonunu oynat`} onClick={() => openWorkout(index)}>▶</button></article>)}</div><button className="start-btn" type="button" onClick={() => openWorkout(0)}>Antrenmana başla <span>→</span></button></div><aside className="coach-card"><div className="coach-top"><span className="spark">✦</span><span>FORM AI</span></div><h2>Bugün senden<br /><em>tek bir şey</em> istiyor:</h2><p>Hareketi mükemmel yapmak değil, devam etmek.</p><div className="coach-line" /><small>İyi antrenmanlar, {name || "Ece"}.</small></aside></div></>}
        </section>
      )}
      <footer><span>form.ai · daha güçlü bir sen için</span><span>© 2024</span></footer>
    </main>
  );
}
