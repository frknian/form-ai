import type { Exercise } from "@/types/exercise";

const labels: Record<string, string> = {
  abdominals: "Karın",
  abductors: "Kalça dışı",
  adductors: "İç bacak",
  biceps: "Biseps",
  calves: "Baldır",
  chest: "Göğüs",
  forearms: "Ön kol",
  glutes: "Kalça",
  hamstrings: "Arka bacak",
  lats: "Kanat",
  "lower back": "Bel",
  "middle back": "Orta sırt",
  quadriceps: "Ön bacak",
  shoulders: "Omuz",
  traps: "Trapez",
  triceps: "Arka kol",
  bands: "Direnç bandı",
  barbell: "Halter",
  "body only": "Vücut ağırlığı",
  cable: "Kablo",
  dumbbell: "Dambıl",
  "e-z curl bar": "EZ bar",
  "exercise ball": "Egzersiz topu",
  kettlebells: "Kettlebell",
  machine: "Makine",
  "medicine ball": "Sağlık topu",
  none: "Ekipmansız",
  other: "Diğer",
  beginner: "Başlangıç",
  intermediate: "Orta seviye",
  expert: "İleri seviye",
  cardio: "Kardiyo",
  "olympic weightlifting": "Olimpik kaldırış",
  plyometrics: "Pliyometrik",
  powerlifting: "Güç kaldırışı",
  strength: "Kuvvet",
  stretching: "Esneme",
  compound: "Bileşik",
  isolation: "İzole",
  push: "İtiş",
  pull: "Çekiş",
  static: "Sabit",
};

export function translateExerciseLabel(value: string | null | undefined, fallback = "Belirtilmemiş") {
  if (!value) return fallback;
  return labels[value.toLocaleLowerCase("en-US")] || value;
}

export function translateExerciseList(values: string[]) {
  return values.map((value) => translateExerciseLabel(value)).join(" · ");
}

export function turkishExerciseInstructions(exercise: Pick<Exercise, "name" | "force" | "category" | "primaryMuscles">) {
  const name = exercise.name.toLocaleLowerCase("en-US");
  const controlled = "Hareket boyunca gövdeni sabit tut, eklemlerini kilitleme ve ağrı hissedersen dur.";

  if (/stretch/.test(name) || exercise.category === "stretching") {
    return [
      "Rahat bir başlangıç pozisyonu al ve nefesini düzenle.",
      "İlgili kas grubunda hafif gerilme hissedene kadar yavaşça ilerle; yaylanma yapma.",
      "Pozisyonu kontrollü koru ve aynı hızla başlangıca dön.",
    ];
  }
  if (/sprint|throw|bound|jump/.test(name) || exercise.category === "cardio" || exercise.category === "plyometrics") {
    return [
      "Dengeli bir duruş al, merkez bölgeni sık ve hareket alanını boş bırak.",
      "Hareketi önce düşük hızda öğren, ardından formun bozulmadan ritmi artır.",
      "Yumuşak ve kontrollü bitir; nefesini tutma ve eklemlerini kilitleme.",
    ];
  }
  if (/squat|lunge|step|leg press/.test(name)) {
    return [
      "Ayaklarını dengeli yerleştir, göğsünü açık ve merkez bölgeni sıkı tut.",
      "Kalçanı kontrollü indirirken dizlerini ayak yönünde takip ettir.",
      "Topuklarından güç alarak yüksel ve dizlerini üstte kilitleme.",
    ];
  }
  if (/deadlift|good morning/.test(name)) {
    return [
      "Ağırlığı vücuduna yakın tut, omurganı nötr ve karnını sıkı konumlandır.",
      "Kalçanı geriye göndererek öne katlan; hareketi belinden değil kalçandan yap.",
      "Topuklarından güç alıp kalçanı öne getirerek kontrollü biçimde doğrul.",
    ];
  }
  if (/bridge|hip raise|hip extension/.test(name)) {
    return [
      "Sırtını destekle, ayaklarını yere sağlam bas ve karnını hafifçe sık.",
      "Topuklarından iterek kalçanı kaldır ve tepede kalça kaslarını sık.",
      "Belini aşırı kavislendirmeden yavaşça başlangıç pozisyonuna dön.",
    ];
  }
  if (/curl/.test(name) && !/leg curl/.test(name)) {
    return [
      "Dirseklerini gövdene yakın ve omuzlarını aşağıda sabitle.",
      "Ağırlığı sallanmadan kontrollü biçimde kendine doğru çek.",
      "Kasın gerilimini koruyarak ağırlığı yavaşça başlangıca indir.",
    ];
  }
  if (/row|pulldown|pull-up|pull up/.test(name) || exercise.force === "pull") {
    return [
      "Göğsünü açık, omuzlarını kulaklarından uzak ve gövdeni sabit tut.",
      "Dirseklerini geriye veya aşağıya çekerek kürek kemiklerini birbirine yaklaştır.",
      "Kontrolü bırakmadan kollarını uzat ve omuzlarını öne düşürme.",
    ];
  }
  if (/press|push|dip|extension/.test(name) || exercise.force === "push") {
    return [
      "Dengeli bir başlangıç pozisyonu al, kürek kemiklerini ve merkez bölgeni sabitle.",
      "Ağırlığı kontrollü indir, ardından nefes vererek güçlü ama sarsıntısız biçimde it.",
      "Dirseklerini kilitlemeden başlangıç pozisyonuna dön ve hareket çizgisini koru.",
    ];
  }
  if (/crunch|leg lift|leg raise/.test(name) || exercise.primaryMuscles.includes("abdominals")) {
    return [
      "Belini destekli konumda tut ve karnını içeri doğru sık.",
      "Hareketi boyundan veya momentumdan değil karın kaslarından başlat.",
      "Nefes vererek sıkış, ardından bel kontrolünü kaybetmeden yavaşça dön.",
    ];
  }
  if (/calf/.test(name)) {
    return [
      "Ayak tabanını dengeli yerleştir ve bir destek noktasından hafifçe yardım al.",
      "Topuklarını kontrollü yükselt, üst noktada baldırlarını kısa süre sık.",
      "Topuklarını yavaşça indir ve ayak bileğinin içe ya da dışa kaçmasına izin verme.",
    ];
  }

  return [
    "Dengeli bir başlangıç pozisyonu al ve nefesini düzenle.",
    controlled,
    "Tekrarı acele etmeden tamamla ve başlangıç pozisyonuna kontrollü dön.",
  ];
}
