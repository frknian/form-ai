"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { adaptPrescription, summarizeTrainingAdaptation, type TrainingAdaptation, type WorkoutDifficulty } from "@/lib/training-adaptation";
import { ExerciseAnimation as ExerciseFrameAnimation } from "@/components/exercises/ExerciseAnimation";
import { ExerciseLibrary } from "@/components/exercises/ExerciseLibrary";
import { getExerciseById, getExercisesForAI } from "@/lib/exercise-service";
import type { Exercise } from "@/types/exercise";

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

const coreExerciseLibrary = [
  { name: "Goblet Squat", english: "Goblet Squat", area: "Bacak", tone: "orange", icon: "◒", requires: ["dambıl", "kettlebell"], bodyweight: false, goals: ["güç", "kas", "kilo"], instructions: "Ayaklarını omuz genişliğinde aç. Ağırlığı göğsünde tut, kalçanı geriye ve aşağıya indir; topuklardan güç alarak kalk." },
  { name: "Eğimli Şınav", english: "Incline Push-up", area: "Göğüs", tone: "blue", icon: "✦", requires: ["bench", "sehpa"], bodyweight: false, goals: ["güç", "kondisyon", "kilo"], instructions: "Ellerini sağlam bir yükseltiye koy. Vücudunu düz bir çizgide tut, göğsünü kontrollü indir ve yüksel." },
  { name: "Dambıl Row", english: "Dumbbell Row", area: "Sırt", tone: "purple", icon: "↗", requires: ["dambıl"], bodyweight: false, goals: ["güç", "kas"], instructions: "Gövdeni sabit ve sırtını düz tut. Dirseğini kalçana doğru çek, kürek kemiklerini sık ve ağırlığı yavaşça indir." },
  { name: "Yerde Dambıl Göğüs Presi", english: "Dumbbell Floor Press", area: "Göğüs", tone: "blue", icon: "✦", requires: ["dambıl"], bodyweight: false, goals: ["güç", "kas", "kilo"], instructions: "Sırt üstü yere yat, dizlerini bük ve ayaklarını yere bas. Dirseklerini yere kontrollü yaklaştır, dambılları göğsünün üzerinden yukarı it ve yavaşça indir." },
  { name: "Glute Bridge", english: "Glute Bridge", area: "Kalça", tone: "orange", icon: "◓", requires: [], bodyweight: true, goals: ["güç", "kilo"], instructions: "Sırt üstü yat, dizlerini bük. Topuklarından iterek kalçanı kaldır, tepede sık ve kontrollü indir." },
  { name: "Plank", english: "Plank", area: "Core", tone: "blue", icon: "—", requires: [], bodyweight: true, goals: ["güç", "kondisyon", "kilo"], instructions: "Dirseklerini omuzlarının altına yerleştir. Karnını ve kalçanı sık, belini çökertmeden düz çizgiyi koru." },
  { name: "Reverse Lunge", english: "Reverse Lunge", area: "Bacak", tone: "purple", icon: "↘", requires: [], bodyweight: true, goals: ["güç", "kilo", "kondisyon"], instructions: "Bir ayağınla geriye adım at. Ön dizini ayak bileğinin üzerinde tut, iki diz kontrollü bükülüp öndeki topuktan kalk." },
  { name: "Band Row", english: "Resistance Band Row", area: "Sırt", tone: "blue", icon: "↔", requires: ["band", "lastik"], bodyweight: false, goals: ["güç", "kas"], instructions: "Bandı göğüs hizasında sabitle. Dirseklerini geriye çek, omuzlarını kulaklarından uzak tut ve yavaşça bırak." },
  { name: "Şınav", english: "Push-up", area: "Göğüs", tone: "blue", icon: "✦", requires: [], bodyweight: true, goals: ["güç", "kas", "kilo", "kondisyon"], instructions: "Ellerini omuzlarının biraz dışına koy. Gövdeni düz tutarak göğsünü yere yaklaştır ve nefes vererek it." },
  { name: "Bulgarian Split Squat", english: "Bulgarian Split Squat", area: "Bacak", tone: "orange", icon: "◒", requires: ["bench", "sehpa"], bodyweight: false, goals: ["güç", "kas"], instructions: "Arka ayağını yükseltiye koy. Ön ayağınla dengeni koruyarak kalçanı indir, öndeki topuktan güç alarak yüksel." },
  { name: "Dambıl Omuz Press", english: "Dumbbell Shoulder Press", area: "Omuz", tone: "purple", icon: "↥", requires: ["dambıl"], bodyweight: false, goals: ["güç", "kas"], instructions: "Dambılları omuz hizasında başlat. Kaburgalarını kontrol altında tutarak ağırlıkları baş üstüne it ve yavaşça indir." },
  { name: "Dead Bug", english: "Dead Bug", area: "Core", tone: "orange", icon: "·", requires: [], bodyweight: true, goals: ["güç", "kilo"], instructions: "Sırt üstü yat ve belini zemine yaklaştır. Karşı kol ve bacağını uzat, merkezini sabit tutarak geri getir." },
  { name: "Mountain Climber", english: "Mountain Climber", area: "Kondisyon", tone: "blue", icon: "↯", requires: [], bodyweight: true, goals: ["kilo", "kondisyon"], instructions: "Yüksek plank pozisyonunda başla. Belini sabit tutarak dizlerini sırayla göğsüne çek; ritmi kontrollü artır." },
  { name: "Step-up", english: "Step-up", area: "Bacak", tone: "orange", icon: "↟", requires: ["bench", "sehpa"], bodyweight: false, goals: ["kilo", "kondisyon", "güç"], instructions: "Bir ayağını sağlam basamağa koy. O ayağın topuğundan iterek yüksel, diğer ayağı hafifçe yanına getir ve kontrollü in." },
  { name: "Lat Pulldown", english: "Lat Pulldown", area: "Sırt", tone: "purple", icon: "↡", requires: ["lat pulldown", "makine", "salon"], bodyweight: false, goals: ["güç", "kas"], instructions: "Barı omuz genişliğinden biraz açık tut. Göğsünü açık bırakıp barı üst göğse doğru çek, kontrollü bırak." },
  { name: "Leg Press", english: "Leg Press", area: "Bacak", tone: "orange", icon: "▣", requires: ["leg press", "makine", "salon"], bodyweight: false, goals: ["güç", "kas", "kilo"], instructions: "Belini pedde sabit tut. Dizleri kilitlemeden platformu it, inişte dizlerini ayak yönünde takip ettir." },
];

type ExerciseDefinition = [string, string, string, string, string[], boolean, string[], string];

const additionalExerciseDefinitions: ExerciseDefinition[] = [
  ["Eğimli Dambıl Press", "Incline Dumbbell Press", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["güç", "kas"], "Bench'i 30–45 dereceye ayarla, dambılları göğsünün üstünden kontrollü indirip yukarı it."],
  ["Düz Dambıl Press", "Flat Dumbbell Press", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["güç", "kas"], "Sırtını sehpaya sabitle, dambılları göğüs hizasında indir ve dirseklerini kontrollü kapat."],
  ["Barbell Bench Press", "Barbell Bench Press", "Göğüs", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı göğüs hizasına kontrollü indir, ayaklarını yere bas ve barı düz bir hatta yukarı it."],
  ["Eğimli Barbell Press", "Incline Barbell Bench Press", "Göğüs", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Eğimli sehpada kürek kemiklerini sabitle, barı üst göğse indirip yukarı it."],
  ["Decline Şınav", "Decline Push-up", "Göğüs", "blue", [], true, ["güç", "kas", "kondisyon"], "Ayaklarını yükseltiye koy, gövdeni düz tut ve göğsünü kontrollü şekilde yere yaklaştır."],
  ["Diz Üstü Şınav", "Knee Push-up", "Göğüs", "blue", [], true, ["güç", "kilo", "kondisyon"], "Dizlerini yerde tut, kalçanı sık ve göğsünü ellerinin arasında kontrollü indir."],
  ["Geniş Tutuş Şınav", "Wide Push-up", "Göğüs", "blue", [], true, ["güç", "kas", "kondisyon"], "Ellerini omuzlardan daha geniş aç, gövdeni düz tutarak aşağı in ve yukarı it."],
  ["Diamond Şınav", "Diamond Push-up", "Göğüs", "blue", [], true, ["güç", "kas"], "Başparmak ve işaret parmaklarını birleştir, dirseklerini gövdeye yakın tutarak itiş yap."],
  ["Archer Şınav", "Archer Push-up", "Göğüs", "blue", [], true, ["güç", "kas"], "Bir kolunu yana açarken diğer kolunla gövdeyi taşımayı kontrollü şekilde değiştir."],
  ["Kablo Göğüs Açış", "Cable Chest Fly", "Göğüs", "blue", ["kablo", "makine", "salon"], false, ["kas", "güç"], "Kollarını hafif bükülü tut, iki kolu göğüs önünde birleştirip kontrollü aç."],
  ["Dambıl Fly", "Dumbbell Fly", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["kas"], "Dambılları göğüs üzerinde birleştir, kolları hafif bükülü tutarak yana aç ve kapat."],
  ["Pec Deck", "Pec Deck Fly", "Göğüs", "blue", ["pec deck", "makine", "salon"], false, ["kas"], "Sırtını pedde sabitle, kolları göğüs önünde birleştir ve omuzlarını yükseltme."],
  ["Dambıl Pullover", "Dumbbell Pullover", "Göğüs", "blue", ["dambıl", "bench", "sehpa"], false, ["güç", "kas"], "Dambılı göğüs üzerinde tut, başının arkasına kontrollü indirip göğüs üzerinden geri getir."],
  ["Dar Tutuş Bench Press", "Close Grip Bench Press", "Göğüs", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı omuz genişliğinden dar tut, dirseklerini gövdeye yakın indirip yukarı it."],
  ["Svend Press", "Svend Press", "Göğüs", "blue", ["plaka", "plate", "dambıl"], false, ["güç", "kas"], "Ağırlığı göğüs önünde iki elinle sıkıştır, kolları öne uzatıp geri getir."],
  ["Landmine Press", "Landmine Press", "Göğüs", "blue", ["barbell", "bar", "landmine", "salon"], false, ["güç", "kas"], "Barın ucunu göğüs önünden çapraz yukarı it, gövdeni sabit tutarak kontrollü indir."],
  ["Göğüs Dipsi", "Chest Dips", "Göğüs", "blue", ["dip", "bar", "salon"], false, ["güç", "kas"], "Paralel barda gövdeni hafif öne eğ, dirsekleri büküp göğsü aşağı indir ve it."],
  ["Destekli Göğüs Dipsi", "Assisted Chest Dips", "Göğüs", "blue", ["dip", "makine", "salon"], false, ["güç", "kas"], "Makinenin desteğini kullan, omuzlarını aşağıda tutarak göğsü kontrollü indirip yüksel."],
  ["Barbell Row", "Barbell Row", "Sırt", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Kalçadan öne eğil, sırtını düz tut ve barı göbek yönüne çekip yavaşça bırak."],
  ["Pendlay Row", "Pendlay Row", "Sırt", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Gövdeyi yere yakın sabit tut, barı zeminden göğse doğru güçlü ve kontrollü çek."],
  ["Tek Kol Kablo Row", "One Arm Cable Row", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Tek kolu kalçaya doğru çek, kürek kemiğini sık ve kabloyu kontrollü geri bırak."],
  ["Oturarak Kablo Row", "Seated Cable Row", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Göğsünü açık tut, tutacağı göbeğe doğru çek ve omuzlarını öne düşürmeden bırak."],
  ["Göğüs Destekli Row", "Chest Supported Row", "Sırt", "purple", ["dambıl", "bench", "sehpa", "makine", "salon"], false, ["güç", "kas"], "Göğsünü sehpaya yasla, dirsekleri geriye çek ve ağırlığı kontrollü indir."],
  ["T-Bar Row", "T-Bar Row", "Sırt", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Kalçadan eğil, göğsünü açık tut ve barı gövdene çekerek sırtını sık."],
  ["Ters Row", "Inverted Row", "Sırt", "purple", ["bar", "salon"], false, ["güç", "kas", "kondisyon"], "Vücudunu düz çizgide tut, göğsünü bara yaklaştır ve kontrollü uzaklaş."],
  ["TRX Row", "TRX Row", "Sırt", "purple", ["trx", "askı", "salon"], false, ["güç", "kas"], "Askı tutacaklarını kavra, vücudunu düz tutarak göğsünü ellerine çek."],
  ["Barfiks", "Pull-up", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "kas"], "Barı üstten kavra, kürek kemiklerini aşağı çek ve çeneni bara yaklaştır."],
  ["Ters Tutuş Barfiks", "Chin-up", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "kas"], "Barı avuç içlerin sana bakacak şekilde tut, dirsekleri aşağı çekerek yüksel."],
  ["Destekli Barfiks", "Assisted Pull-up", "Sırt", "purple", ["barfiks", "makine", "salon"], false, ["güç", "kas"], "Makine desteğiyle göğsünü bara yaklaştır, inişi yavaş ve kontrollü yap."],
  ["Negatif Barfiks", "Negative Pull-up", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "kas"], "Üst pozisyondan başla ve kollar tamamen uzayana kadar 3–5 saniyede in."],
  ["Düz Kol Pulldown", "Straight Arm Pulldown", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Kolları düz ve gövdeyi sabit tut, barı kalçaya doğru indirip kontrollü yükselt."],
  ["Tek Kol Lat Pulldown", "Single Arm Lat Pulldown", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Tek kolu üst göğse doğru çek, gövdeyi yana yatırmadan yavaşça bırak."],
  ["Kablo Pullover", "Cable Pullover", "Sırt", "purple", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Kolları hafif bükülü tut, barı kalça hizasına indir ve sırtı sık."],
  ["Bel Ekstansiyonu", "Back Extension", "Sırt", "purple", ["bench", "sehpa", "salon"], false, ["güç"], "Kalçadan bükül, sırtı nötr tut ve gövdeyi kalça kaslarıyla düz çizgiye getir."],
  ["Superman", "Superman", "Sırt", "purple", [], true, ["güç", "kondisyon"], "Yüzüstü uzan, karşı kol ve bacağı kaldır, belini sıkıştırmadan kontrollü indir."],
  ["Face Pull", "Face Pull", "Omuz", "purple", ["kablo", "band", "lastik", "makine", "salon"], false, ["güç", "kas"], "Halatı yüz hizasına çek, dirsekleri dışarı aç ve kürek kemiklerini sık."],
  ["Ters Dambıl Açış", "Dumbbell Reverse Fly", "Omuz", "purple", ["dambıl"], false, ["kas", "güç"], "Gövdeyi öne eğ, dambılları yana aç ve omuzlarını kulaklarına çekmeden indir."],
  ["Arnold Press", "Arnold Press", "Omuz", "purple", ["dambıl"], false, ["güç", "kas"], "Avuç içleri sana bakacak şekilde başla, döndürerek ağırlıkları baş üstüne it."],
  ["Barbell Overhead Press", "Barbell Overhead Press", "Omuz", "purple", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Barı omuz hizasından başlat, gövdeyi sıkı tutarak baş üstüne dik it."],
  ["Landmine Shoulder Press", "Landmine Shoulder Press", "Omuz", "purple", ["barbell", "bar", "landmine", "salon"], false, ["güç", "kas"], "Barın ucunu tek kolla çapraz yukarı it, belini bükmeden kontrollü geri getir."],
  ["Makine Omuz Press", "Machine Shoulder Press", "Omuz", "purple", ["makine", "salon"], false, ["güç", "kas"], "Sırtını pedde sabitle, tutacakları yukarı it ve dirsekleri kilitlemeden indir."],
  ["Yana Dambıl Açış", "Dumbbell Lateral Raise", "Omuz", "purple", ["dambıl"], false, ["kas", "güç"], "Dambılları omuz yüksekliğine kadar yana aç, bilekleri nötr tutarak indir."],
  ["Kablo Yana Açış", "Cable Lateral Raise", "Omuz", "purple", ["kablo", "makine", "salon"], false, ["kas", "güç"], "Kabloyu tek kolla yana aç, omuz hizasında kısa duraklayıp kontrollü indir."],
  ["Ön Dambıl Raise", "Dumbbell Front Raise", "Omuz", "purple", ["dambıl"], false, ["kas", "güç"], "Dambılı omuz hizasına kadar öne kaldır, gövdeyi sallamadan yavaşça indir."],
  ["Plaka Front Raise", "Plate Front Raise", "Omuz", "purple", ["plaka", "plate"], false, ["kas", "güç"], "Plakayı iki elle göğüs önünde tut, omuz hizasına kaldırıp kontrollü indir."],
  ["Rear Delt Fly", "Rear Delt Fly", "Omuz", "purple", ["dambıl", "makine", "salon"], false, ["kas"], "Kolları yana ve geriye aç, sırtını sabit tutarak omuz arkasını sık."],
  ["Upright Row", "Upright Row", "Omuz", "purple", ["barbell", "dambıl", "kablo"], false, ["güç", "kas"], "Ağırlığı gövdeye yakın yukarı çek, dirsekleri omuz hizasından fazla yükseltme."],
  ["Cuban Rotation", "Cuban Rotation", "Omuz", "purple", ["dambıl", "band", "lastik"], false, ["güç"], "Dirsekleri 90 derece sabit tut, ön kolları dışa döndürüp kontrollü geri getir."],
  ["Scaption", "Scaption", "Omuz", "purple", ["dambıl", "band", "lastik"], false, ["güç"], "Kolları başparmaklar yukarı bakacak şekilde hafif öne ve yana kaldır."],
  ["Pike Şınav", "Pike Push-up", "Omuz", "purple", [], true, ["güç", "kas"], "Kalçanı yukarı kaldır, başını ellerin arasına indirip omuzlarınla geri it."],
  ["Duvar Amudu Bekleme", "Handstand Hold", "Omuz", "purple", ["duvar"], false, ["güç", "kondisyon"], "Duvara kontrollü çık, karnını sık ve omuzlarını aktif tutarak kısa süre bekle."],
  ["Barbell Curl", "Barbell Curl", "Kol", "blue", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Dirsekleri gövdeye sabitle, barı omuzlara doğru kıvırıp yavaşça indir."],
  ["Dambıl Curl", "Dumbbell Curl", "Kol", "blue", ["dambıl"], false, ["güç", "kas"], "Dirsekleri sabit tut, dambılları sırayla omuzlara yaklaştır ve kontrollü bırak."],
  ["Hammer Curl", "Hammer Curl", "Kol", "blue", ["dambıl"], false, ["güç", "kas"], "Avuç içlerini birbirine bakacak şekilde tut, dirsekleri oynatmadan kaldır."],
  ["Eğimli Dambıl Curl", "Incline Dumbbell Curl", "Kol", "blue", ["dambıl", "bench", "sehpa"], false, ["kas"], "Eğimli sehpada kolları aşağı sarkıt, bicepsleri gererek dambılları kıvır."],
  ["Concentration Curl", "Concentration Curl", "Kol", "blue", ["dambıl"], false, ["kas"], "Dirseği iç bacağa destekle, dambılı omuza doğru kıvırıp yavaşça aç."],
  ["Kablo Curl", "Cable Curl", "Kol", "blue", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Kabloyu tut, dirsekleri gövdede sabit tutarak elleri omuzlara çek."],
  ["Preacher Curl", "Preacher Curl", "Kol", "blue", ["makine", "bench", "sehpa", "salon"], false, ["kas"], "Kolları pedde sabitle, dirsekleri kilitlemeden ağırlığı yukarı ve aşağı taşı."],
  ["Ters Tutuş Curl", "Reverse Curl", "Kol", "blue", ["barbell", "bar", "dambıl"], false, ["güç", "kas"], "Avuç içlerini yere çevir, bilekleri sabit tutarak ağırlığı kıvır."],
  ["Triceps Pushdown", "Triceps Pushdown", "Kol", "blue", ["kablo", "makine", "salon"], false, ["güç", "kas"], "Dirsekleri gövdeye sabitle, ön kolları aşağı uzatıp kontrollü yukarı getir."],
  ["İp Triceps Pushdown", "Rope Triceps Pushdown", "Kol", "blue", ["kablo", "makine", "salon"], false, ["güç", "kas"], "İpi aşağı iterken uçları dışa aç, dirsekleri sabit tut."],
  ["Baş Üstü Triceps Extension", "Overhead Triceps Extension", "Kol", "blue", ["dambıl", "kablo"], false, ["güç", "kas"], "Ağırlığı baş üstünde tut, dirsekleri yakın koruyarak arkaya indirip uzat."],
  ["Dambıl Skull Crusher", "Dumbbell Skull Crusher", "Kol", "blue", ["dambıl", "bench", "sehpa"], false, ["kas"], "Dambılları alnın iki yanına kontrollü indir, dirsekleri sabit tutarak uzat."],
  ["Dar Şınav", "Close Grip Push-up", "Kol", "blue", [], true, ["güç", "kas"], "Ellerini omuz genişliğinde tut, dirsekleri gövdeye yakın indirip yukarı it."],
  ["Bench Dip", "Bench Dip", "Kol", "blue", ["bench", "sehpa"], false, ["güç", "kas"], "Ellerini sehpaya koy, kalçayı öne al ve dirsekleri büküp kontrollü yüksel."],
  ["Triceps Kickback", "Triceps Kickback", "Kol", "blue", ["dambıl"], false, ["kas"], "Gövdeyi öne eğ, üst kolları sabit tut ve ön kolları geriye uzat."],
  ["JM Press", "JM Press", "Kol", "blue", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı çene hizasına kontrollü indir, dirsekleri sabit tutarak yukarı it."],
  ["Barbell Back Squat", "Barbell Back Squat", "Bacak", "orange", ["barbell", "bar", "rack", "salon"], false, ["güç", "kas"], "Barı sırtında sabitle, kalçayı geriye indir ve topuklardan güç alarak kalk."],
  ["Front Squat", "Front Squat", "Bacak", "orange", ["barbell", "bar", "rack", "salon"], false, ["güç", "kas"], "Barı omuz önünde tut, gövdeyi dik koruyarak çömelip ayağa kalk."],
  ["Split Squat", "Split Squat", "Bacak", "orange", [], true, ["güç", "kas", "kilo"], "Bir ayağı öne al, arka dizini yere yaklaştır ve öndeki topuktan yüksel."],
  ["Sumo Squat", "Sumo Squat", "Bacak", "orange", ["dambıl", "kettlebell"], false, ["güç", "kas", "kilo"], "Ayakları geniş ve dışa dönük aç, dizleri ayak yönünde takip ettirerek çömel."],
  ["Vücut Ağırlığı Squat", "Bodyweight Squat", "Bacak", "orange", [], true, ["güç", "kilo", "kondisyon"], "Ayakları omuz genişliğinde aç, kalçayı geriye indir ve topuklardan yüksel."],
  ["Jump Squat", "Jump Squat", "Bacak", "orange", [], true, ["kilo", "kondisyon"], "Çömelmeden güçlü sıçra, dizleri yumuşak karşıla ve ritmi kontrollü koru."],
  ["Wall Sit", "Wall Sit", "Bacak", "orange", ["duvar"], false, ["güç", "kilo", "kondisyon"], "Sırtını duvara yasla, dizleri yaklaşık 90 derecede tut ve nefesi düzenli al."],
  ["Romanian Deadlift", "Romanian Deadlift", "Bacak", "orange", ["dambıl", "barbell", "bar"], false, ["güç", "kas"], "Dizleri hafif bük, kalçayı geriye gönder ve sırtı nötr tutarak ağırlığı indir."],
  ["Stiff Leg Deadlift", "Stiff Leg Deadlift", "Bacak", "orange", ["dambıl", "barbell", "bar"], false, ["güç", "kas"], "Bacakları uzun tut, kalçadan katlan ve hamstring gerilince ağırlığı geri kaldır."],
  ["Conventional Deadlift", "Conventional Deadlift", "Bacak", "orange", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Barı bacaklara yakın tut, sırtı nötr koru ve yerden kalçayla birlikte yüksel."],
  ["Sumo Deadlift", "Sumo Deadlift", "Bacak", "orange", ["barbell", "bar", "salon"], false, ["güç", "kas"], "Geniş duruş al, dizleri ayak yönünde aç ve barı yere yakın çek."],
  ["Good Morning", "Good Morning", "Bacak", "orange", ["barbell", "bar", "salon"], false, ["güç"], "Barı sırtında tut, kalçadan öne eğil ve sırtı düz koruyarak yüksel."],
  ["Hip Thrust", "Hip Thrust", "Kalça", "orange", ["bench", "sehpa", "dambıl"], false, ["güç", "kas", "kilo"], "Sırtını sehpaya yasla, topuklardan iterek kalçayı kaldır ve tepede sık."],
  ["Barbell Hip Thrust", "Barbell Hip Thrust", "Kalça", "orange", ["barbell", "bar", "bench", "sehpa", "salon"], false, ["güç", "kas"], "Barı kalça üzerinde sabitle, pelvisini nötr tutarak kalçayı yukarı sür."],
  ["Tek Bacak Glute Bridge", "Single Leg Glute Bridge", "Kalça", "orange", [], true, ["güç", "kilo"], "Bir bacağı uzat, diğer topuktan iterek kalçayı kaldır ve kontrollü indir."],
  ["Frog Pump", "Frog Pump", "Kalça", "orange", [], true, ["güç", "kilo"], "Ayak tabanlarını birleştir, dizleri yana aç ve kalçayı kısa kontrollü tekrarlarla kaldır."],
  ["Fire Hydrant", "Fire Hydrant", "Kalça", "orange", [], true, ["güç", "kilo"], "Dört ayak pozisyonunda dizini yana kaldır, kalçayı döndürmeden geri indir."],
  ["Donkey Kick", "Donkey Kick", "Kalça", "orange", [], true, ["güç", "kilo"], "Dört ayak pozisyonunda topuğu tavana it, belini çökertmeden bacağı indir."],
  ["Kablo Glute Kickback", "Cable Glute Kickback", "Kalça", "orange", ["kablo", "makine", "salon"], false, ["güç", "kas", "kilo"], "Bacağı geriye uzat, leğen kemiğini sabit tut ve kabloyu kontrollü bırak."],
  ["Leg Extension", "Leg Extension", "Bacak", "orange", ["leg extension", "makine", "salon"], false, ["güç", "kas"], "Sırtını pedde tut, dizleri kontrollü uzat ve ağırlığı yavaşça indir."],
  ["Oturarak Leg Curl", "Seated Leg Curl", "Bacak", "orange", ["leg curl", "makine", "salon"], false, ["güç", "kas"], "Kalçayı pedde sabitle, topukları geriye çek ve kontrollü başlangıca dön."],
  ["Yatarak Leg Curl", "Lying Leg Curl", "Bacak", "orange", ["leg curl", "makine", "salon"], false, ["güç", "kas"], "Karnını pedde sabitle, topukları kalçaya çekip yavaşça uzat."],
  ["Nordic Curl", "Nordic Curl", "Bacak", "orange", ["bench", "sehpa", "salon"], false, ["güç", "kas"], "Ayakları sabitle, gövdeyi hamstringlerle yavaşça öne indir ve ellerle destek al."],
  ["Ayakta Baldır Raise", "Standing Calf Raise", "Bacak", "orange", ["dambıl", "makine", "salon"], false, ["güç", "kilo"], "Ayak ucuna yüksel, tepede baldırı sık ve topukları kontrollü indir."],
  ["Oturarak Baldır Raise", "Seated Calf Raise", "Bacak", "orange", ["makine", "salon"], false, ["güç", "kas"], "Dizler üzerindeki ağırlığı kullan, topukları kaldırıp yavaşça aşağı bırak."],
  ["Tibialis Raise", "Tibialis Raise", "Bacak", "orange", ["duvar"], false, ["güç", "kondisyon"], "Topukları yerde bırak, ayak uçlarını yukarı çekip kontrollü indir."],
  ["Cossack Squat", "Cossack Squat", "Bacak", "orange", [], true, ["güç", "esneklik", "kilo"], "Bir yana çömelirken diğer bacağı uzat, göğsü açık tut ve ortaya dön."],
  ["Curtsy Lunge", "Curtsy Lunge", "Bacak", "orange", [], true, ["güç", "kilo"], "Bir ayağı çapraz geriye al, kalçayı indir ve öndeki topuktan yüksel."],
  ["Walking Lunge", "Walking Lunge", "Bacak", "orange", [], true, ["güç", "kilo", "kondisyon"], "Öne adım at, iki dizi bük ve arkadaki ayağı öne getirerek ilerle."],
  ["Lateral Lunge", "Lateral Lunge", "Bacak", "orange", [], true, ["güç", "esneklik", "kilo"], "Yana geniş adım at, kalçayı geriye indir ve itiş yapan bacakla dön."],
  ["Box Jump", "Box Jump", "Bacak", "orange", ["kutu", "bench", "sehpa"], false, ["kilo", "kondisyon"], "Kollarla destek alarak sağlam kutuya sıçra, dizleri yumuşak karşıla ve in."],
  ["Crunch", "Crunch", "Core", "blue", [], true, ["güç", "kilo"], "Belini zemine yaklaştır, omuzları hafif kaldır ve boynu çekmeden geri in."],
  ["Reverse Crunch", "Reverse Crunch", "Core", "blue", [], true, ["güç", "kilo"], "Dizleri göğse çek, kalçayı hafif kaldır ve belini yere kontrollü bırak."],
  ["Bicycle Crunch", "Bicycle Crunch", "Core", "blue", [], true, ["güç", "kilo", "kondisyon"], "Karşı dirseği karşı dize yaklaştır, beli yere yakın tutarak taraf değiştir."],
  ["Russian Twist", "Russian Twist", "Core", "blue", ["dambıl", "kettlebell"], false, ["güç", "kilo"], "Gövdeyi hafif geriye al, ağırlığı sağa sola döndürürken kalçayı sabit tut."],
  ["Side Plank", "Side Plank", "Core", "blue", [], true, ["güç", "kilo"], "Dirseği omuz altına koy, kalçayı kaldır ve vücudu düz çizgide tut."],
  ["Hollow Body Hold", "Hollow Body Hold", "Core", "blue", [], true, ["güç", "kilo"], "Belini zemine bastır, omuz ve bacakları hafif kaldırarak pozisyonu koru."],
  ["V-Up", "V-Up", "Core", "blue", [], true, ["güç", "kilo"], "Kolları ve bacakları aynı anda merkeze getir, kontrollü uzayarak geri dön."],
  ["Leg Raise", "Leg Raise", "Core", "blue", [], true, ["güç", "kilo"], "Bacakları düz kaldır, belin yerden ayrılmadan yavaşça aşağı indir."],
  ["Hanging Knee Raise", "Hanging Knee Raise", "Core", "blue", ["barfiks", "bar", "salon"], false, ["güç", "kilo"], "Barfiks barında asılı kal, dizleri göğse çekip salınım yapmadan indir."],
  ["Hanging Leg Raise", "Hanging Leg Raise", "Core", "blue", ["barfiks", "bar", "salon"], false, ["güç", "kilo"], "Asılı pozisyonda düz bacakları kaldır, kalçayı kontrollü kullan ve indir."],
  ["Pallof Press", "Pallof Press", "Core", "blue", ["kablo", "band", "lastik", "salon"], false, ["güç"], "Kabloyu göğüs önünde tut, kolları uzatırken gövdenin dönmesine diren."],
  ["Kablo Woodchop", "Cable Woodchop", "Core", "blue", ["kablo", "makine", "salon"], false, ["güç", "kilo"], "Kabloyu çapraz aşağı çek, kalça ve gövdeyi birlikte döndürerek kontrollü dön."],
  ["Ab Wheel Rollout", "Ab Wheel Rollout", "Core", "blue", ["ab wheel", "tekerlek"], false, ["güç"], "Dizlerden başla, gövdeyi düz uzat ve belini çökertmeden geri çek."],
  ["Bear Crawl", "Bear Crawl", "Core", "blue", [], true, ["kilo", "kondisyon"], "Dizleri yerden hafif kaldır, karşı el ve ayağı sırayla ilerlet."],
  ["Burpee", "Burpee", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Çömel, elleri yere koy, ayakları geriye al ve kontrollü kalkıp sıçra."],
  ["Jumping Jack", "Jumping Jack", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Kolları ve bacakları ritmik açıp kapat, inişlerde dizleri yumuşak tut."],
  ["High Knees", "High Knees", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Dizleri kalça hizasına doğru sırayla kaldır, gövdeyi dik ve ritmi kontrollü koru."],
  ["Butt Kicks", "Butt Kicks", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Topukları sırayla kalçaya yaklaştır, gövdeyi dik tut ve yumuşak bas."],
  ["Skater", "Skater", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Yana sıçrayıp karşı ayağın arkasına uzan, dengeyi koruyarak taraf değiştir."],
  ["Squat Thrust", "Squat Thrust", "Kondisyon", "orange", [], true, ["kilo", "kondisyon"], "Çömelip elleri yere koy, ayakları geriye alıp tekrar öne çek ve kalk."],
  ["Inchworm", "Inchworm", "Kondisyon", "orange", [], true, ["kilo", "kondisyon", "esneklik"], "Ayakta öne katlan, ellerle plank pozisyonuna yürü ve kontrollü geri dön."],
  ["Bear Plank", "Bear Plank", "Core", "blue", [], true, ["güç", "kondisyon"], "Dizleri yerden kaldır, omuz ve kalçayı sabit tutarak kısa süre bekle."],
  ["Hollow Rock", "Hollow Rock", "Core", "blue", [], true, ["güç"], "Hollow pozisyonunu koru, gövdeyi küçük salınımlarla kontrol ederek hareket ettir."],
  ["Dead Hang", "Dead Hang", "Sırt", "purple", ["barfiks", "bar", "salon"], false, ["güç", "esneklik"], "Barı kavra, omuzları aktif tut ve vücudu kontrollü şekilde asılı koru."],
  ["Cat Cow", "Cat Cow", "Esneklik", "orange", [], true, ["esneklik"], "Dört ayak pozisyonunda sırayla omurgayı yuvarla ve göğsü öne aç."],
  ["Child's Pose", "Child's Pose", "Esneklik", "orange", [], true, ["esneklik"], "Kalçayı topuklara gönder, kolları öne uzat ve nefesle gevşe."],
  ["Downward Dog", "Downward Dog", "Esneklik", "orange", [], true, ["esneklik"], "Kalçayı yukarı kaldır, omurgayı uzat ve topukları zemine doğru rahat bırak."],
  ["World's Greatest Stretch", "World's Greatest Stretch", "Esneklik", "orange", [], true, ["esneklik", "kondisyon"], "Öne hamle pozisyonunda bir dirseği yere yaklaştır, göğsü döndür ve taraf değiştir."],
  ["Kalça Fleksör Esnetme", "Hip Flexor Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Bir diz yerdeyken kalçayı hafif öne taşı, beli çökertmeden ön kalçayı esnet."],
  ["Hamstring Esnetme", "Hamstring Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Bacağı uzat, kalçadan öne eğil ve sırtı yuvarlamadan rahat nefes al."],
  ["90/90 Hip Switch", "90/90 Hip Switch", "Esneklik", "orange", [], true, ["esneklik"], "Dizleri iki yana 90 derece yerleştir, kalçadan kontrollü bir tarafa dön."],
  ["Thoracic Rotation", "Thoracic Rotation", "Esneklik", "orange", [], true, ["esneklik"], "Yan yatışta üst kolu açarak göğsü tavana döndür, kalçayı sabit tut."],
  ["Omuz Dislocate", "Shoulder Dislocate", "Esneklik", "orange", ["band", "lastik", "çubuk"], false, ["esneklik"], "Bandı geniş kavra, kolları baş üstünden arkaya ve öne yavaşça taşı."],
  ["Ankle Rocker", "Ankle Rocker", "Esneklik", "orange", [], true, ["esneklik"], "Ön ayağın topuğu yerdeyken dizi ayak parmaklarına doğru kontrollü taşı."],
  ["Glute Stretch", "Glute Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Bir bacağı diğerinin üzerinden geçir, gövdeyi hafif öne al ve kalçayı gevşet."],
  ["Pigeon Stretch", "Pigeon Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Ön bacağı bük, arka bacağı uzat ve kalçayı kontrollü şekilde yere yaklaştır."],
  ["Cobra Stretch", "Cobra Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Yüzüstü yat, ellerle göğsü hafif kaldır ve omuzları kulaklardan uzak tut."],
  ["Wrist Stretch", "Wrist Stretch", "Esneklik", "orange", [], true, ["esneklik"], "Avuç ve parmakları nazikçe ger, bilekte keskin ağrı olmadan nefes al."],
];

function buildExerciseInstruction(name: string, cue: string) {
  return `${cue} ${name} hareketinde ağrı hissedersen dur ve hareket açıklığını azalt.`;
}

const additionalExerciseLibrary = additionalExerciseDefinitions.map(([name, english, area, tone, requires, bodyweight, goals, cue], index) => ({
  name,
  english,
  area,
  tone,
  icon: index % 3 === 0 ? "✦" : index % 3 === 1 ? "↗" : "◒",
  requires,
  bodyweight,
  goals,
  instructions: buildExerciseInstruction(name, cue),
}));

const exerciseLibrary = [...coreExerciseLibrary, ...additionalExerciseLibrary];

function createPersonalPlan(gym: string, equipmentText: string, history: string[], goalText: string, requestedExercises = "") {
  const profileText = `${equipmentText} ${goalText} ${requestedExercises} ${history.join(" ")}`.toLowerCase();
  const goal = profileText.includes("kilo") || profileText.includes("yağ") ? "kilo" : profileText.includes("kas") ? "kas" : profileText.includes("kondisyon") ? "kondisyon" : "güç";
  const isBeginner = history[2] === "Yeni başlıyorum" || !history[2];
  const wantsGym = gym === "Salon";
  const equipment = equipmentText.toLowerCase();
  const durationText = history[3] || goalText.match(/(15|30|45|60)/)?.[1] || "30";
  const duration = Number(durationText.match(/\d+/)?.[0] || "30");
  const pain = history[6]?.toLowerCase() || "";
  const matchesEquipment = (item: typeof exerciseLibrary[number]) => wantsGym || item.bodyweight || item.requires.some((requirement) => equipment.includes(requirement));
  const avoidKneeLoad = pain.includes("diz");
  const avoidShoulderLoad = pain.includes("omuz");
  const safeForPain = (item: typeof exerciseLibrary[number]) => !(avoidKneeLoad && ["Reverse Lunge", "Bulgarian Split Squat", "Step-up", "Mountain Climber", "Leg Press"].includes(item.name)) && !(avoidShoulderLoad && ["Şınav", "Eğimli Şınav", "Dambıl Omuz Press", "Lat Pulldown"].includes(item.name));
  const seed = [...profileText].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 997, 7);
  const goalItems = exerciseLibrary.filter((item) => matchesEquipment(item) && safeForPain(item) && item.goals.includes(goal));
  const fallback = exerciseLibrary.filter((item) => matchesEquipment(item) && safeForPain(item));
  const requestedItems = findRequestedLibraryExercises(requestedExercises, goalText, gym, equipmentText, history);
  const score = (name: string) => [...name].reduce((total, character) => total + character.charCodeAt(0), seed) % 997;
  const chosen = [...requestedItems, ...goalItems, ...fallback].filter((item, index, list) => list.findIndex((candidate) => candidate.name === item.name) === index).sort((a, b) => (requestedItems.includes(a) ? -1 : requestedItems.includes(b) ? 1 : score(a.name) - score(b.name))).slice(0, duration <= 15 ? 3 : duration >= 60 ? 6 : 5);
  const sets = isBeginner ? (duration <= 15 ? 2 : 3) : duration >= 60 ? 4 : 3;
  const reps = goal === "kondisyon" || goal === "kilo" ? (isBeginner ? 10 : 14) : isBeginner ? 10 : 8;
  const rest = goal === "kondisyon" ? 45 : isBeginner ? 60 : 90;
  return chosen.map((item) => ({ ...item, level: item.area, sets: `${sets} set · ${item.name === "Plank" || item.name === "Dead Bug" ? "30 sn" : `${reps} tekrar`}`, rest: `${rest} sn dinlenme`, seconds: item.name === "Plank" || item.name === "Dead Bug" ? 30 : 45 }));
}

type AiWorkout = { id?: string; name: string; english: string; area: string; sets: string; rest: string; seconds: number; tone: string; icon: string; level: string; instructions: string; images?: string[]; equipment?: string | null; secondaryMuscles?: string[]; category?: string };
type MotionPattern = "floor-press" | "pushup" | "press" | "overhead" | "row" | "pulldown" | "squat" | "lunge" | "hinge" | "bridge" | "plank" | "core" | "cardio" | "mobility" | "curl" | "triceps" | "raise" | "fly" | "calf" | "leg-machine";
type MotionPose = "start" | "mid" | "finish";
type WorkoutPhase = "work" | "rest" | "done";
type WorkoutSessionRecord = { id: string; completedAt: string; durationSeconds: number; calories: number; completedExercises: number; totalExercises: number; exerciseNames: string[]; difficulty?: WorkoutDifficulty; fatigue?: number; painAreas?: string[]; feedbackNote?: string };
type AiPlanAnalysis = { experienceLevel: string; weeklyFrequency: string; sessionMinutes: number; primaryGoal: string; intensity: string; equipmentMode: string; focusAreas: string[]; adaptations: string[] };
type AiScheduleDay = { day: string; focus: string; durationMinutes: number };
type EnergyMetrics = { bmr: number; tdee: number; activityLabel: string; activityFactor: number };
type AiStage = "profile" | "history" | "planning" | "complete";

const motionGuides: Record<MotionPattern, { action: string; focus: string; start: string; move: string; finish: string; breathe: string; mistake: string }> = {
  "floor-press": { action: "YUKARI İT", focus: "Göğüs · triceps", start: "Sırt üstü yat, dizleri bük ve dambılları dirseklerin üzerinde tut.", move: "Dambılları göğsünün üzerinde birbirine yaklaştırarak yukarı it.", finish: "Dirsekleri yere çarpmadan kontrollü indir.", breathe: "İterken nefes ver, indirirken nefes al.", mistake: "Omuzları kulaklara çekme; bilekleri geriye kırma." },
  pushup: { action: "GÖVDENİ İT", focus: "Göğüs · omuz · core", start: "Eller omuzlardan biraz açık, baştan topuğa düz çizgi kur.", move: "Dirsekleri yaklaşık 45 dereceyle büküp göğsü kontrollü indir.", finish: "Zemini iterek gövdeyi tek parça halinde yükselt.", breathe: "İnerken nefes al, yükselirken ver.", mistake: "Belini çökertme ve başını öne uzatma." },
  press: { action: "İLERİ İT", focus: "Göğüs · ön omuz · triceps", start: "Kürek kemiklerini sabitle, ağırlığı göğüs hizasında tut.", move: "Dirsekleri kontrollü bük, ardından ağırlığı düz hatta it.", finish: "Kolları kilitlemeden başlangıca dön.", breathe: "İterken nefes ver, dönüşte al.", mistake: "Dirsekleri omuz hizasında tamamen yana açma." },
  overhead: { action: "BAŞ ÜSTÜNE İT", focus: "Omuz · triceps · core", start: "Ağırlıkları omuz hizasında, kaburgaları aşağıda tut.", move: "Ağırlıkları başının iki yanından yukarı taşı.", finish: "Belini kamburlaştırmadan kontrollü indir.", breathe: "Yukarı iterken nefes ver.", mistake: "Bel boşluğunu artırma ve ağırlıkları öne kaçırma." },
  row: { action: "DİRSEĞİ GERİ ÇEK", focus: "Sırt · arka omuz · biceps", start: "Kalçadan hafif eğil, sırtı düz ve omuzları aşağıda tut.", move: "Dirseği kalçaya doğru çekip kürek kemiğini sık.", finish: "Gövdeyi döndürmeden kolu yavaşça uzat.", breathe: "Çekerken nefes ver, uzatırken al.", mistake: "Omzu kulağa çekme ve ağırlığı savurma." },
  pulldown: { action: "AŞAĞI ÇEK", focus: "Kanat · sırt · biceps", start: "Göğsü açık tut, barı omuzlardan biraz geniş kavra.", move: "Dirsekleri aşağı ve geriye sürerek barı üst göğse çek.", finish: "Omuzları yükseltmeden kolları kontrollü uzat.", breathe: "Barı çekerken nefes ver.", mistake: "Barı enseye çekme ve gövdeyi geriye savurma." },
  squat: { action: "KALÇAYI İNDİR", focus: "Ön bacak · kalça · core", start: "Ayakları sağlam bas, dizleri ayak uçlarıyla aynı yöne çevir.", move: "Kalçayı geriye-aşağı indirirken göğsü açık tut.", finish: "Topuklardan güç alıp kalçayı sıkarak yüksel.", breathe: "İnerken nefes al, kalkarken ver.", mistake: "Dizleri içeri düşürme ve topukları kaldırma." },
  lunge: { action: "TEK BACAK İN", focus: "Bacak · kalça · denge", start: "Ayakları ray üzerindeymiş gibi ayrı tut, gövdeyi dikleştir.", move: "İki dizi kontrollü büküp arka dizi zemine yaklaştır.", finish: "Öndeki topuktan güç alarak başlangıca dön.", breathe: "İnerken nefes al, kalkarken ver.", mistake: "Ön dizi içeri kaçırma ve adımı fazla dar tutma." },
  hinge: { action: "KALÇAYI GERİ İT", focus: "Arka bacak · kalça · sırt", start: "Dizleri hafif bük, omurgayı nötr ve ağırlığı bacağa yakın tut.", move: "Kalçayı geriye gönderirken gövdeyi tek parça öne eğ.", finish: "Topuklardan itip kalçayı sıkarak doğrul.", breathe: "İnişte nefes al, doğrulurken ver.", mistake: "Belini yuvarlama ve ağırlığı vücuttan uzaklaştırma." },
  bridge: { action: "KALÇAYI KALDIR", focus: "Kalça · arka bacak · core", start: "Sırt üstü yat, topukları kalçaya yaklaştır ve beli nötr tut.", move: "Topuklardan iterek kalçayı omuz-diz hattına kaldır.", finish: "Tepede kalçayı sık, beli aşırı yaymadan kontrollü in.", breathe: "Yükselirken nefes ver.", mistake: "Hareketi belden yapma ve dizleri dışa savurma." },
  plank: { action: "GÖVDEYİ SABİTLE", focus: "Core · omuz · kalça", start: "Dirsekleri omuzların altına yerleştir, ayakları geriye uzat.", move: "Karnı ve kalçayı sıkıp baştan topuğa düz çizgiyi koru.", finish: "Süre boyunca nefesi kesmeden pozisyonu sürdür.", breathe: "Kısa ve düzenli nefes alıp ver.", mistake: "Belini çökertme veya kalçayı fazla yükseltme." },
  core: { action: "MERKEZİ KONTROL ET", focus: "Karın · bel çevresi · kalça", start: "Bel boşluğunu kontrol et, kaburgaları aşağıda tut.", move: "Kol veya bacak hareket ederken gövdeyi sabit bırak.", finish: "Kontrolü kaybetmeden başlangıca dön.", breathe: "Zor bölümde yavaşça nefes ver.", mistake: "Hız için bel kontrolünden vazgeçme." },
  cardio: { action: "RİTMİ KORU", focus: "Nabız · bacak · koordinasyon", start: "Gövdeyi dengeli tut, iniş için dizleri yumuşat.", move: "Kollar ve bacakları eş zamanlı, kontrollü ritimde hareket ettir.", finish: "Yumuşak inişlerle ritmi sürdür.", breathe: "Konuşabilecek kadar düzenli nefes al.", mistake: "Sert iniş yapma ve kontrolsüz hızlanma." },
  mobility: { action: "KONTROLLÜ UZAT", focus: "Hareket açıklığı · nefes", start: "Omurgayı uzun tut, eklemleri rahat bırak.", move: "Ağrısız aralıkta gerilimi yavaşça artır.", finish: "Sekmeden ve zorlamadan başlangıca dön.", breathe: "Burundan yavaşça nefes alıp ver.", mistake: "Ağrının içine ilerleme ve nefesi tutma." },
  curl: { action: "DİRSEĞİ BÜK", focus: "Biceps · ön kol", start: "Dirsekleri gövdenin yanında sabitle, bilekleri düz tut.", move: "Ağırlığı omuza doğru kaldırırken yalnızca dirseği bük.", finish: "Üstte kısa süre sık, ağırlığı savurmadan yavaşça indir.", breathe: "Kaldırırken nefes ver, indirirken al.", mistake: "Dirsekleri öne taşıma ve gövdeyi geriye savurma." },
  triceps: { action: "DİRSEĞİ AÇ", focus: "Triceps · omuz dengesi", start: "Üst kolu sabitle, dirseği kontrollü bükülü tut.", move: "Ön kolu uzatarak dirseği aç ve tricepsi sık.", finish: "Dirseği yerinden oynatmadan yavaşça başlangıca dön.", breathe: "Kolu uzatırken nefes ver.", mistake: "Omzu öne düşürme ve dirseği yana açma." },
  raise: { action: "KOLU KALDIR", focus: "Omuz · üst sırt", start: "Kolları gövdenin yanında, dirsekleri hafif bükülü tut.", move: "Ağırlıkları omuz hizasına kadar kontrollü kaldır.", finish: "Omuzları aşağıda tutarak aynı yoldan yavaşça indir.", breathe: "Kaldırırken nefes ver.", mistake: "Ağırlığı savurma ve omuz hizasının çok üstüne çıkma." },
  fly: { action: "KOLLARI KAPAT", focus: "Göğüs · ön omuz", start: "Kolları iki yana aç, dirseklerde yumuşak bir açı bırak.", move: "Göğsünü sıkarak kolları geniş bir yay çizerek birleştir.", finish: "Omuz kontrolünü kaybetmeden kolları yavaşça yeniden aç.", breathe: "Kolları kapatırken nefes ver.", mistake: "Dirsek açısını değiştirme ve omuzu öne yuvarlama." },
  calf: { action: "TOPUKLARI KALDIR", focus: "Baldır · ayak bileği", start: "Ayak tabanını dengeli bas, dizleri kilitleme.", move: "Başparmak kökünden güç alıp topukları kontrollü yükselt.", finish: "Üstte kısa dur, topukları yavaşça aşağı indir.", breathe: "Yükselirken nefes ver.", mistake: "Ayak bileklerini dışa kaçırma ve zıplama." },
  "leg-machine": { action: "DİZİ AÇ / BÜK", focus: "Ön veya arka bacak", start: "Kalçanı ve belini mindere sabitle, makine eksenini dizinle hizala.", move: "Dizi kontrollü aç veya bük; hareketi bacak kasıyla yönet.", finish: "Ağırlıkları birbirine çarptırmadan yavaşça başlangıca dön.", breathe: "Zor bölümde nefes ver.", mistake: "Kalçayı minderden kaldırma ve ağırlığı hızla bırakma." },
};

function getMotionPattern(exercise: { name: string; english: string }): MotionPattern {
  const text = `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR");
  if (/floor press|yerde dambıl göğüs/.test(text)) return "floor-press";
  if (/lateral raise|front raise|yana .*açış|ön dambıl|scaption/.test(text)) return "raise";
  if (/chest fly|fly|pec deck|crossover|göğüs açış/.test(text)) return "fly";
  if (/curl/.test(text) && !/leg curl/.test(text)) return "curl";
  if (/triceps|skull crusher|kickback|jm press|dar şınav|close grip/.test(text)) return "triceps";
  if (/calf|baldır/.test(text)) return "calf";
  if (/leg extension|leg curl|bacak açış|bacak curl/.test(text)) return "leg-machine";
  if (/push-up|şınav|dip/.test(text)) return "pushup";
  if (/shoulder press|military press|arnold press|overhead press/.test(text)) return "overhead";
  if (/pulldown|pull-up|chin-up|barfiks|hang/.test(text)) return "pulldown";
  if (/row|face pull|reverse fly|rear delt/.test(text)) return "row";
  if (/deadlift|romanian|good morning|pull-through|swing/.test(text)) return "hinge";
  if (/hip thrust|glute bridge|bridge/.test(text)) return "bridge";
  if (/lunge|split squat|step-up|step up|cossack/.test(text)) return "lunge";
  if (/squat|leg press|wall sit/.test(text)) return "squat";
  if (/plank|mountain climber|bear crawl|inchworm/.test(text)) return "plank";
  if (/crunch|dead bug|hollow|v-up|leg raise|pallof|woodchop|ab wheel|russian twist|bird dog|superman/.test(text)) return "core";
  if (/stretch|pose|rotation|mobility|90\/90|dislocate|rocker/.test(text)) return "mobility";
  if (/burpee|jumping|high knees|butt kicks|skater|squat thrust|box jump|march|run/.test(text)) return "cardio";
  return "press";
}

function getMotionGuide(exercise: { name: string; english: string }) {
  return motionGuides[getMotionPattern(exercise)];
}

function MotionFigure({ pattern, pose }: { pattern: MotionPattern; pose: MotionPose }) {
  return <span className={`motion-figure pattern-${pattern} pose-${pose}`} aria-hidden="true"><span className="motion-support" /><span className="motion-muscle" /><span className="motion-head" /><span className="motion-torso" /><span className="motion-arm arm-left" /><span className="motion-arm arm-right" /><span className="motion-leg leg-left" /><span className="motion-leg leg-right" /><span className="motion-joint joint-shoulder" /><span className="motion-joint joint-hip" /><span className="motion-joint joint-knee" /><span className="motion-load load-left" /><span className="motion-load load-right" /></span>;
}

function MotionFigureAnimation({ exercise, compact = false }: { exercise: { name: string; english: string; tone: string }; compact?: boolean }) {
  const pattern = getMotionPattern(exercise);
  const guide = motionGuides[pattern];
  const [motionStep, setMotionStep] = useState(0);
  const [motionPlaying, setMotionPlaying] = useState(true);
  useEffect(() => {
    if (!motionPlaying) return;
    const interval = window.setInterval(() => setMotionStep((step) => (step + 1) % 3), compact ? 850 : 1050);
    return () => window.clearInterval(interval);
  }, [compact, motionPlaying]);
  const poses: Array<{ pose: MotionPose; label: string }> = [{ pose: "start", label: "Başlangıç" }, { pose: "mid", label: "Hareket" }, { pose: "finish", label: "Kontrol" }];
  const activePose = poses[motionStep];
  return <div className={`exercise-media exercise-live ${exercise.tone} movement-${pattern} ${compact ? "compact" : ""}`} aria-label={`${exercise.name}: canlı hareket gösterimi`}>
    {!compact && <div className="motion-header"><span><i /> CANLI HAREKET REHBERİ</span><strong>{guide.action}</strong></div>}
    <div className="motion-stage motion-live-stage">
      <span className="motion-floor" />
      <div className="motion-anatomy"><MotionFigure pattern={pattern} pose={activePose.pose} /></div>
      {!compact && <div className="motion-muscle-label"><span>HEDEF KASLAR</span><strong>{guide.focus}</strong></div>}
      {!compact && <div className="motion-phase"><span>{String(motionStep + 1).padStart(2, "0")}</span><strong>{activePose.label}</strong></div>}
    </div>
    {!compact && <><div className="motion-controls"><div aria-label={`Gösterilen aşama: ${motionStep + 1} / 3`}>{poses.map((item, index) => <button type="button" aria-label={`${index + 1}. aşamayı göster: ${item.label}`} className={motionStep === index ? "active" : ""} onClick={() => { setMotionStep(index); setMotionPlaying(false); }} key={item.pose} />)}</div><button type="button" className="motion-play" onClick={() => setMotionPlaying((playing) => !playing)}>{motionPlaying ? "Durdur Ⅱ" : "Yavaş oynat ▶"}</button></div><div className="motion-caption"><strong>{activePose.label}</strong><span>{guide.move}</span></div></>}
  </div>;
}

function ExerciseAnimation({ exercise, compact = false }: { exercise: { name: string; english: string; tone: string; images?: string[] }; compact?: boolean }) {
  return exercise.images?.length ? <ExerciseFrameAnimation images={exercise.images} name={exercise.name} compact={compact} /> : <MotionFigureAnimation exercise={exercise} compact={compact} />;
}

function workoutPrescription(workout: AiWorkout) {
  const totalSets = Math.max(1, Number.parseInt(workout.sets, 10) || 3);
  const restSeconds = Math.max(10, Number.parseInt(workout.rest, 10) || 60);
  const target = workout.sets.split("·")[1]?.trim() || `${workout.seconds} sn`;
  return { totalSets, restSeconds, target, workSeconds: Math.max(10, workout.seconds || 45) };
}

function isExerciseSafeForAdaptivePain(exercise: AiWorkout, painAreas: string[]) {
  const text = `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR");
  const pain = painAreas.join(" ").toLocaleLowerCase("tr-TR");
  if (pain.includes("diz") && /squat|lunge|step-up|step up|jump|leg press|bacak açış/.test(text)) return false;
  if (pain.includes("omuz") && /push|press|dip|fly|overhead|raise|pulldown|barfiks/.test(text)) return false;
  if (pain.includes("bel") && /deadlift|good morning|back extension|woodchop|superman|russian twist/.test(text)) return false;
  return true;
}

function adaptWorkoutsToHistory(workouts: AiWorkout[], adaptation: TrainingAdaptation, fallbackPlan: AiWorkout[]) {
  const adjusted = workouts.map((workout) => {
    const currentSets = Math.max(1, Number.parseInt(workout.sets, 10) || 3);
    const currentRest = Math.max(30, Number.parseInt(workout.rest, 10) || 60);
    const target = workout.sets.split("·")[1]?.trim() || "10 tekrar";
    const isTimed = /sn|saniye/i.test(target);
    const currentReps = Math.max(1, Number.parseInt(target, 10) || 10);
    const prescription = adaptPrescription(currentSets, currentReps, currentRest, adaptation);
    const nextTarget = isTimed ? `${Math.max(15, currentReps + adaptation.repDelta * 2)} sn` : `${prescription.reps} tekrar`;
    return { ...workout, sets: `${prescription.sets} set · ${nextTarget}`, rest: `${prescription.restSeconds} sn dinlenme`, seconds: isTimed ? Math.max(15, currentReps + adaptation.repDelta * 2) : workout.seconds };
  });
  if (!adaptation.painAreas.length) return adjusted;
  const safeFallback = fallbackPlan.filter((exercise) => isExerciseSafeForAdaptivePain(exercise, adaptation.painAreas));
  const safeAdjusted = adjusted.filter((exercise) => isExerciseSafeForAdaptivePain(exercise, adaptation.painAreas));
  const replacements = safeFallback.filter((exercise) => !safeAdjusted.some((current) => exerciseKey(current) === exerciseKey(exercise)));
  return [...safeAdjusted, ...replacements].slice(0, workouts.length);
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function databaseExerciseAsWorkout(exercise: Exercise): AiWorkout {
  const muscle = exercise.primaryMuscles[0] || "full body";
  const area = muscle === "chest" ? "Göğüs" : ["lats", "middle back"].includes(muscle) ? "Sırt" : muscle === "shoulders" ? "Omuz" : ["biceps", "triceps", "forearms"].includes(muscle) ? "Kol" : muscle === "abdominals" ? "Core" : ["glutes"].includes(muscle) ? "Kalça" : "Bacak";
  const tone = area === "Bacak" || area === "Kalça" ? "orange" : area === "Göğüs" || area === "Core" ? "blue" : "purple";
  return { id: exercise.id, name: exercise.name, english: exercise.name, area, level: exercise.level, sets: "3 set · 10 tekrar", rest: "60 sn dinlenme", seconds: 45, tone, icon: "↗", instructions: exercise.instructions[0] || "Hareketi kontrollü uygula ve ağrı hissedersen dur.", images: exercise.images, equipment: exercise.equipment, secondaryMuscles: exercise.secondaryMuscles, category: exercise.category };
}

function calculateEnergyMetrics(gender: string, ageValue: string, heightValue: string, weightValue: string, movementLevel: string): EnergyMetrics | null {
  const age = Number(ageValue);
  const height = Number(heightValue);
  const weight = Number(weightValue);
  if (!age || !height || !weight) return null;
  const sexConstant = gender === "Erkek" ? 5 : -161;
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + sexConstant);
  const activity = movementLevel === "Yüksek" ? { factor: 1.55, label: "Yüksek hareket" } : movementLevel === "Orta" ? { factor: 1.375, label: "Orta hareket" } : { factor: 1.2, label: "Düşük hareket" };
  return { bmr, tdee: Math.round(bmr * activity.factor), activityLabel: activity.label, activityFactor: activity.factor };
}

function workoutMet(exercise: AiWorkout, phase: WorkoutPhase, intensity: string) {
  if (phase === "rest") return 2.0;
  const pattern = getMotionPattern(exercise);
  const vigorous = /yüksek|ileri/i.test(intensity);
  if (pattern === "cardio") return vigorous ? 8 : 7.5;
  if (["squat", "lunge", "hinge"].includes(pattern)) return vigorous ? 6 : 5;
  if (["pushup", "plank", "core"].includes(pattern)) return vigorous ? 6.5 : 3.8;
  if (pattern === "mobility") return 2.8;
  return vigorous ? 6 : 3.5;
}

function fallbackAnalysis(gym: string, equipmentText: string, history: string[], goalText: string): AiPlanAnalysis {
  const duration = Number(history[3]?.match(/\d+/)?.[0]) || 30;
  const primaryGoal = history[4] || goalText || "Güçlenme";
  const experienceLevel = history[2] || "Yeni başlıyorum";
  return { experienceLevel, weeklyFrequency: history[1] || "1–2 gün", sessionMinutes: duration, primaryGoal, intensity: /ileri|yüksek/i.test(`${experienceLevel} ${history[7]}`) ? "Orta-yüksek" : "Düşük-orta", equipmentMode: gym === "Salon" ? "Spor salonu ekipmanları" : equipmentText || "Ekipmansız", focusAreas: primaryGoal.toLowerCase().includes("kilo") ? ["Tüm vücut", "Kondisyon"] : primaryGoal.toLowerCase().includes("kas") ? ["Direnç", "Kas grubu dengesi"] : ["Temel kuvvet", "Hareket kalitesi"], adaptations: [`${duration} dakikalık seansa göre hareket sayısı ayarlandı.`, `${experienceLevel} seviyesine göre set ve dinlenme seçildi.`, history[6] && history[6] !== "Yok" ? `${history[6]} bölgesi için riskli hareketler elendi.` : "Belirtilen ağrı bölgesi olmadığı için dengeli seçim yapıldı."] };
}

function findRequestedLibraryExercises(requestedExercises: string, goalText: string, gym: string, equipmentText: string, history: string[]) {
  const requestedNames = `${requestedExercises} ${goalText}`.toLowerCase().split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  const equipment = equipmentText.toLowerCase();
  const pain = history[6]?.toLowerCase() || "";
  const matchesEquipment = (item: typeof exerciseLibrary[number]) => gym === "Salon" || item.bodyweight || item.requires.some((requirement) => equipment.includes(requirement));
  const safeForPain = (item: typeof exerciseLibrary[number]) => !(pain.includes("diz") && ["Reverse Lunge", "Bulgarian Split Squat", "Step-up", "Mountain Climber", "Leg Press"].includes(item.name)) && !(pain.includes("omuz") && ["Şınav", "Eğimli Şınav", "Dambıl Omuz Press", "Lat Pulldown"].includes(item.name));
  return exerciseLibrary.filter((item) => requestedNames.some((requested) => item.name.toLowerCase().includes(requested) || item.english.toLowerCase().includes(requested) || requested.includes("yerde") && item.name === "Yerde Dambıl Göğüs Presi") && matchesEquipment(item) && safeForPain(item));
}

function exerciseKey(exercise: { name: string; english: string }) {
  return `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function findLibraryExercise(exercise: { name: string; english: string }) {
  const values = [exerciseKey({ name: exercise.name, english: "" }), exerciseKey({ name: exercise.english, english: "" })].filter(Boolean);
  return exerciseLibrary.find((candidate) => values.some((value) => {
    const candidateValues = [exerciseKey({ name: candidate.name, english: "" }), exerciseKey({ name: candidate.english, english: "" })];
    return candidateValues.includes(value) || candidateValues.some((candidateValue) => candidateValue.length > 5 && (candidateValue.includes(value) || value.includes(candidateValue)));
  }));
}

function profileGoal(goalText: string, history: string[]) {
  const text = `${history[4] || ""} ${goalText}`.toLocaleLowerCase("tr-TR");
  return text.includes("kilo") || text.includes("yağ") ? "kilo" : text.includes("kas") ? "kas" : text.includes("kondisyon") ? "kondisyon" : "güç";
}

function isExerciseSafeForProfile(exercise: { id?: string; name: string; english: string }, gym: string, equipmentText: string, history: string[]) {
  const text = `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR");
  const pain = (history[6] || "").toLocaleLowerCase("tr-TR");
  const equipment = equipmentText.toLocaleLowerCase("tr-TR");
  if (pain.includes("diz") && /squat|lunge|jump|step|leg press|mountain climber|box jump|skater/.test(text)) return false;
  if (pain.includes("omuz") && /push|press|dip|shoulder|fly|overhead|lateral raise|pulldown|barfiks/.test(text)) return false;
  if (pain.includes("bel") && /deadlift|good morning|back extension|woodchop|superman|russian twist/.test(text)) return false;
  const databaseExercise = exercise.id ? getExerciseById(exercise.id) : null;
  if (databaseExercise) return gym === "Salon" || !databaseExercise.equipment || ["body only", "none"].includes(databaseExercise.equipment) || equipment.includes(databaseExercise.equipment);
  const libraryExercise = findLibraryExercise(exercise);
  if (!libraryExercise) return false;
  return gym === "Salon" || libraryExercise.bodyweight || libraryExercise.requires.some((requirement) => equipment.includes(requirement));
}

function personalizeAiWorkouts(items: AiWorkout[], gym: string, equipmentText: string, history: string[], goalText: string, requestedExercises: string) {
  const localPlan = createPersonalPlan(gym, equipmentText, history, goalText, requestedExercises);
  const goal = profileGoal(goalText, history);
  const safeAi = items.filter((item) => isExerciseSafeForProfile(item, gym, equipmentText, history)).map((item) => {
    const libraryExercise = findLibraryExercise(item);
    return libraryExercise ? { ...item, name: libraryExercise.name, english: libraryExercise.english, area: libraryExercise.area, tone: libraryExercise.tone, icon: libraryExercise.icon, instructions: item.instructions || libraryExercise.instructions } : item;
  });
  const requestedItems = findRequestedLibraryExercises(requestedExercises, goalText, gym, equipmentText, history).map((item) => ({ ...item, level: item.area, sets: "3 set · 10 tekrar", rest: "60 sn dinlenme", seconds: 45 }));
  const safeAiKeys = new Set(safeAi.map(exerciseKey));
  const requestedKeys = new Set(requestedItems.map(exerciseKey));
  const aiRequested = safeAi.filter((item) => requestedKeys.has(exerciseKey(item)));
  const goalArea = goal === "kilo" || goal === "kondisyon" ? "Kondisyon" : "";
  const requiredGoalAnchors = exerciseLibrary.filter((item) => item.goals.includes(goal) && (!goalArea || item.area === goalArea) && isExerciseSafeForProfile(item, gym, equipmentText, history)).map((item) => ({ ...item, level: item.area, sets: "3 set · 10 tekrar", rest: goalArea ? "45 sn dinlenme" : "60 sn dinlenme", seconds: 45 })).slice(0, goalArea ? 1 : 0);
  const localGoalAnchors = [...requiredGoalAnchors, ...localPlan].filter((item) => item.goals.includes(goal) && !safeAiKeys.has(exerciseKey(item)) && !requestedKeys.has(exerciseKey(item))).slice(0, 2);
  const candidates = [...requestedItems.filter((item) => !safeAiKeys.has(exerciseKey(item))), ...aiRequested, ...localGoalAnchors, ...safeAi.filter((item) => !requestedKeys.has(exerciseKey(item))), ...localPlan];
  const targetCount = Math.min(6, Math.max(3, localPlan.length || safeAi.length || 5));
  return candidates.filter((item, index, list) => list.findIndex((candidate) => exerciseKey(candidate) === exerciseKey(item)) === index).slice(0, targetCount);
}

function normalizeAiWorkouts(items: Array<{ id: string; name: string; english: string; area: string; sets: number; reps: string; restSeconds: number; instructions?: string }>): AiWorkout[] {
  const visuals: Record<string, { tone: string; icon: string }> = { Bacak: { tone: "orange", icon: "◒" }, Göğüs: { tone: "blue", icon: "✦" }, Sırt: { tone: "purple", icon: "↗" }, Kalça: { tone: "orange", icon: "◓" }, Core: { tone: "blue", icon: "—" } };
  return items.map((item) => {
    const databaseExercise = getExerciseById(item.id);
    if (!databaseExercise) return null;
    const libraryExercise = findLibraryExercise(item);
    const base = databaseExerciseAsWorkout(databaseExercise);
    const area = libraryExercise?.area || base.area || item.area;
    return { ...base, name: databaseExercise.name, english: databaseExercise.name, area, instructions: item.instructions || databaseExercise.instructions[0] || libraryExercise?.instructions || "Hareketi kontrollü yap, nefesini tutma ve ağrı hissedersen dur.", sets: `${item.sets} set · ${item.reps}`, rest: `${item.restSeconds} sn dinlenme`, seconds: item.reps.includes("sn") ? 30 : 45, level: databaseExercise.level, ...(libraryExercise ? { tone: libraryExercise.tone, icon: libraryExercise.icon } : visuals[area] || { tone: "purple", icon: "✦" }) };
  }).filter((item): item is AiWorkout => Boolean(item));
}

function AiScanFigure({ compact = false, status = "scanning", stage = "profile" }: { compact?: boolean; status?: "idle" | "scanning" | "complete" | "fallback"; stage?: AiStage }) {
  const stageCopy: Record<AiStage, [string, string]> = { profile: ["Profil ölçüleri taranıyor", "Yaş, boy, kilo, ortam ve ekipman değerlendiriliyor"], history: ["Spor geçmişi çözümleniyor", "10 test cevabı, hedef ve ağrı bölgeleri birlikte okunuyor"], planning: ["Program kişiselleştiriliyor", "Hareket, set, tekrar ve dinlenme seçiliyor"], complete: ["AI verileri taradı", "Kişisel programın ve uyarlamaların hazır"] };
  const copy = status === "complete" ? stageCopy.complete : status === "fallback" ? ["Veriler tarandı", "Güvenli yerel plan hazırlandı; AI bağlantısı yeniden denenebilir"] : status === "idle" ? ["AI analizi hazır", "Profil, test ve ölçümler birlikte değerlendirilecek"] : stageCopy[stage];
  return <div className={`${compact ? "ai-scan compact" : "ai-scan"} ${status}`}><div className="scan-figure"><span className="scan-head" /><span className="scan-body" /><span className="scan-line" /></div><div><strong>{copy[0]}</strong><small>{copy[1]}</small>{!compact && status === "scanning" && <div className="analysis-steps"><i className="done" /><i className={stage === "history" || stage === "planning" || stage === "complete" ? "done" : ""} /><i className={stage === "planning" || stage === "complete" ? "done" : ""} /></div>}</div></div>;
}

function AiPlanInsights({ analysis, schedule, progression, fingerprint }: { analysis: AiPlanAnalysis; schedule: AiScheduleDay[]; progression: string[]; fingerprint: string }) {
  return <section className="ai-insights"><div className="section-title"><div><div className="eyebrow">AI KİŞİSELLEŞTİRME RAPORU</div><h2>Programını değiştiren veriler</h2></div><span className="analysis-id">ANALİZ {fingerprint || "YEREL"}</span></div><div className="analysis-grid"><article><span>SEVİYE</span><strong>{analysis.experienceLevel}</strong><small>{analysis.intensity} yoğunluk</small></article><article><span>SIKLIK</span><strong>{analysis.weeklyFrequency}</strong><small>{analysis.sessionMinutes} dk / seans</small></article><article><span>ORTAM</span><strong>{analysis.equipmentMode}</strong><small>{analysis.focusAreas.join(" · ")}</small></article></div><div className="adaptation-list"><div><span>NEDEN FARKLI?</span>{analysis.adaptations.map((adaptation) => <p key={adaptation}>✓ {adaptation}</p>)}</div><div><span>4 HAFTALIK İLERLEME</span>{progression.slice(0, 4).map((item, index) => <p key={`${item}-${index}`}><b>{index + 1}</b>{item}</p>)}</div></div>{schedule.length > 0 && <div className="week-schedule">{schedule.map((item) => <div key={`${item.day}-${item.focus}`}><span>{item.day}</span><strong>{item.focus}</strong><small>{item.durationMinutes} dk</small></div>)}</div>}</section>;
}

function AdaptivePlanCard({ adaptation, sessionCount }: { adaptation: TrainingAdaptation; sessionCount: number }) {
  const changeText = adaptation.direction === "increase" ? `+${adaptation.setDelta} set · +${adaptation.repDelta} tekrar · ${adaptation.restDelta} sn dinlenme` : adaptation.direction === "deload" ? `${adaptation.setDelta} set · ${adaptation.repDelta} tekrar · +${adaptation.restDelta} sn dinlenme` : "Set, tekrar ve dinlenme korunuyor";
  return <section className={`adaptive-card ${adaptation.direction}`}><div className="adaptive-icon">↗</div><div><div className="eyebrow">ZAMANLA UYARLANAN PROGRAM</div><h2>{adaptation.title}</h2><p>{adaptation.summary}</p><div className="adaptive-change"><strong>Sonraki plan</strong><span>{changeText}</span></div>{adaptation.painAreas.length > 0 && <div className="adaptive-pain">Korunan bölgeler: {adaptation.painAreas.join(" · ")}</div>}<ul>{adaptation.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul></div><span className="adaptive-count">{sessionCount}<small>kayıt</small></span></section>;
}

function ProgressView({ name, sessions, referenceTime, energyMetrics }: { name: string; sessions: WorkoutSessionRecord[]; referenceTime: number; energyMetrics: EnergyMetrics | null }) {
  const weekAgo = referenceTime - 7 * 24 * 60 * 60 * 1000;
  const weeklySessions = sessions.filter((session) => new Date(session.completedAt).getTime() >= weekAgo);
  const totalSeconds = sessions.reduce((total, session) => total + session.durationSeconds, 0);
  const totalCalories = sessions.reduce((total, session) => total + session.calories, 0);
  const referenceDate = new Date(referenceTime);
  const monthlySessions = sessions.filter((session) => { const date = new Date(session.completedAt); return date.getMonth() === referenceDate.getMonth() && date.getFullYear() === referenceDate.getFullYear(); });
  const monthlyMinutes = Math.round(monthlySessions.reduce((total, session) => total + session.durationSeconds, 0) / 60);
  const monthlyCalories = monthlySessions.reduce((total, session) => total + session.calories, 0);
  const completedTotal = monthlySessions.reduce((total, session) => total + session.completedExercises, 0);
  const exerciseTotal = monthlySessions.reduce((total, session) => total + session.totalExercises, 0);
  const completionRate = exerciseTotal ? Math.round((completedTotal / exerciseTotal) * 100) : 0;
  const weekBuckets = [3, 2, 1, 0].map((weeksAgo) => { const end = referenceTime - weeksAgo * 7 * 24 * 60 * 60 * 1000; const start = end - 7 * 24 * 60 * 60 * 1000; return sessions.filter((session) => { const time = new Date(session.completedAt).getTime(); return time > start && time <= end; }).length; });
  const maxWeek = Math.max(1, ...weekBuckets);
  return <div className="subview"><div className="eyebrow">İLERLEMEM</div><h1>{name || "Sporcu"}, <em>ritmini gör.</em></h1><p className="lead">Tamamladığın antrenmanlar, süreler ve tahmini enerji verileri burada birikir.</p><div className="progress-cards"><div><span>BU HAFTA</span><strong>{weeklySessions.length}</strong><small>tamamlanan antrenman</small></div><div><span>TOPLAM SÜRE</span><strong>{Math.round(totalSeconds / 60)} dk</strong><small>{sessions.length ? "tüm kayıtlar" : "ilk antrenmanı bekliyor"}</small></div><div><span>YAKILAN ENERJİ</span><strong>{totalCalories} kcal</strong><small>MET tabanlı tahmin</small></div></div><section className="monthly-report"><div><div className="eyebrow">AYLIK RAPOR</div><h2>{new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(referenceDate)} özeti</h2><p>Kalori ve enerji değerleri tahminidir; tıbbi ölçüm veya beslenme hedefi değildir.</p><div className="monthly-numbers"><span><strong>{monthlySessions.length}</strong>antrenman</span><span><strong>{monthlyMinutes}</strong>dakika</span><span><strong>{monthlyCalories}</strong>kcal</span><span><strong>%{completionRate}</strong>tamamlama</span></div></div><div className="month-bars" aria-label="Son dört haftadaki antrenman sayısı">{weekBuckets.map((count, index) => <div key={index}><span style={{ height: `${Math.max(8, (count / maxWeek) * 100)}%` }} /><small>{index + 1}. hf</small><b>{count}</b></div>)}</div></section>{energyMetrics && <div className="energy-reference"><div><span>BAZAL ENERJİ (BMR)</span><strong>{energyMetrics.bmr} kcal</strong><small>Dinlenme enerjisi tahmini</small></div><div><span>GÜNLÜK TOPLAM (TDEE)</span><strong>{energyMetrics.tdee} kcal</strong><small>{energyMetrics.activityLabel} katsayısı</small></div><p>Bu değerler Mifflin–St Jeor denklemi ve testteki hareket düzeyine göre yaklaşık hesaplanır.</p></div>}<div className="progress-panel"><div className="section-title"><div><div className="eyebrow">İLERLEME GÜNLÜĞÜ</div><h2>{sessions.length ? "Son antrenmanların" : "İlk kaydını oluşturalım"}</h2></div><span className="progress-status">{sessions.length ? `${sessions.length} kayıt` : "Hazır"}</span></div>{sessions.length ? <div className="session-list">{sessions.slice(0, 6).map((session) => <article key={session.id}><div><strong>{session.exerciseNames.slice(0, 3).join(" · ") || "Kişisel antrenman"}</strong><small>{new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(session.completedAt))}</small>{session.difficulty && <div className="session-feedback"><span>{session.difficulty}</span><span>Yorgunluk {session.fatigue || 3}/5</span>{session.painAreas?.filter((area) => area !== "Yok").map((area) => <span className="pain" key={area}>{area}</span>)}</div>}</div><div><b>{Math.max(1, Math.round(session.durationSeconds / 60))} dk</b><span>{session.calories} kcal · {session.completedExercises}/{session.totalExercises} hareket</span></div></article>)}</div> : <div className="empty-progress"><span>✦</span><p>İlk antrenmanını bitirdiğinde süre, kalori ve tamamlanan hareketler burada görünecek.</p></div>}</div></div>;
}

function LibraryView({ onOpenWorkout, onAddWorkout }: { onOpenWorkout: (exercise: AiWorkout) => void; onAddWorkout: (exercise: AiWorkout) => void }) {
  return <ExerciseLibrary onOpenWorkout={(exercise) => onOpenWorkout(databaseExerciseAsWorkout(exercise))} onAddWorkout={(exercise) => onAddWorkout(databaseExerciseAsWorkout(exercise))} />;
}

const readyPrograms = [
  { title: "Ekipmansız başlangıç", detail: "15 dk · Evde", names: ["Şınav", "Glute Bridge", "Dead Bug"] },
  { title: "Dambıl ile güç", detail: "30 dk · Evde", names: ["Goblet Squat", "Dambıl Row", "Dambıl Omuz Press", "Plank"] },
  { title: "Salon full body", detail: "45 dk · Spor salonu", names: ["Leg Press", "Lat Pulldown", "Dambıl Omuz Press", "Reverse Lunge", "Plank"] },
];

function ReadyPrograms({ onApply }: { onApply: (program: typeof readyPrograms[number]) => void }) {
  return <div className="ready-programs"><div className="section-title"><div><div className="eyebrow">HAZIR PROGRAMLAR</div><h2>İstersen hemen başla</h2></div><span className="ready-note">Kişisel planına alternatif</span></div><div className="ready-grid">{readyPrograms.map((program) => <article className="ready-card" key={program.title}><div><h3>{program.title}</h3><p>{program.detail}</p><small>{program.names.join(" · ")}</small></div><button type="button" onClick={() => onApply(program)}>Kullan →</button></article>)}</div></div>;
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
  const [requestedExercises, setRequestedExercises] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(Array(10).fill(""));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<number | null>(null);
  const [playerQueue, setPlayerQueue] = useState<AiWorkout[]>([]);
  const [timer, setTimer] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [workoutPhase, setWorkoutPhase] = useState<WorkoutPhase>("work");
  const [currentSet, setCurrentSet] = useState(1);
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);
  const [skippedExercises, setSkippedExercises] = useState<number[]>([]);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionCalories, setSessionCalories] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<WorkoutSessionRecord[]>([]);
  const [pendingSession, setPendingSession] = useState<WorkoutSessionRecord | null>(null);
  const [feedbackDifficulty, setFeedbackDifficulty] = useState<WorkoutDifficulty>("Uygun");
  const [feedbackFatigue, setFeedbackFatigue] = useState(3);
  const [feedbackPainAreas, setFeedbackPainAreas] = useState<string[]>(["Yok"]);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [progressReferenceTime] = useState(() => Date.now());
  const [aiWorkouts, setAiWorkouts] = useState<AiWorkout[]>([]);
  const [aiRationale, setAiRationale] = useState("");
  const [aiSafetyNote, setAiSafetyNote] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<AiPlanAnalysis | null>(null);
  const [aiSchedule, setAiSchedule] = useState<AiScheduleDay[]>([]);
  const [aiProgression, setAiProgression] = useState<string[]>([]);
  const [aiFingerprint, setAiFingerprint] = useState("");
  const [aiStage, setAiStage] = useState<AiStage>("profile");
  const [activeView, setActiveView] = useState<"plan" | "progress" | "library">("plan");
  const [aiStatus, setAiStatus] = useState<"idle" | "scanning" | "complete" | "fallback">("idle");
  const [aiError, setAiError] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);

  const localPlan = useMemo(() => createPersonalPlan(gym, equipmentText, history, goalText, requestedExercises), [gym, equipmentText, history, goalText, requestedExercises]);
  const adaptation = useMemo(() => summarizeTrainingAdaptation(sessionHistory), [sessionHistory]);
  const workouts = useMemo(() => adaptWorkoutsToHistory(aiWorkouts.length ? aiWorkouts : localPlan, adaptation, localPlan), [adaptation, aiWorkouts, localPlan]);
  const currentWorkout = activeWorkout === null ? null : playerQueue[activeWorkout] || null;
  const currentGuide = currentWorkout ? getMotionGuide(currentWorkout) : null;
  const currentPrescription = currentWorkout ? workoutPrescription(currentWorkout) : null;
  const energyMetrics = useMemo(() => calculateEnergyMetrics(gender, age, height, weight, history[7]), [age, gender, height, history, weight]);
  const displayedSessionCalories = Math.round(sessionCalories);
  const planLevel = history[2] || "Yeni başlıyorum";
  const planGoal = history[4] || goalText || "Güçlenme";
  const bmi = useMemo(() => {
    const h = Number(height) / 100;
    const w = Number(weight);
    return h && w ? (w / (h * h)).toFixed(1) : "22.4";
  }, [height, weight]);

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPhoto(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(file);
    }
  }

  function setAnswer(answer: string) {
    setHistory((current) => current.map((value, index) => index === questionIndex ? answer : value));
    if (questionIndex < 9 && questionIndex !== 6) window.setTimeout(() => setQuestionIndex((current) => current + 1), 220);
  }

  function toggleInjury(answer: string) {
    setHistory((current) => {
      const selected = current[6] ? current[6].split(" · ").filter(Boolean) : [];
      const next = answer === "Yok" ? ["Yok"] : [...selected.filter((value) => value !== "Yok"), ...(selected.includes(answer) ? [] : [answer])];
      return current.map((value, index) => index === 6 ? next.join(" · ") : value);
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function loadWorkoutHistory() {
      try {
        const supabase = createClient();
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("workout_sessions").select("*").order("completed_at", { ascending: false }).limit(20);
        if (!cancelled && data) setSessionHistory(data.map((session) => ({ id: String(session.id), completedAt: String(session.completed_at), durationSeconds: Number(session.duration_seconds), calories: Number(session.calories), completedExercises: Number(session.completed_exercises), totalExercises: Number(session.total_exercises), exerciseNames: Array.isArray(session.exercise_names) ? session.exercise_names.map(String) : [], difficulty: session.difficulty === "Kolay" || session.difficulty === "Uygun" || session.difficulty === "Zor" ? session.difficulty : undefined, fatigue: session.fatigue ? Number(session.fatigue) : undefined, painAreas: Array.isArray(session.pain_areas) ? session.pain_areas.map(String) : [], feedbackNote: typeof session.feedback_note === "string" ? session.feedback_note : undefined })));
      } catch {
        // Oturum içinde tamamlanan antrenmanlar yine de ekranda gösterilir.
      }
    }
    void loadWorkoutHistory();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isRunning || !currentWorkout) return;
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current > 1) return current - 1;
        const prescription = workoutPrescription(currentWorkout);
        if (workoutPhase === "work" && currentSet < prescription.totalSets) {
          setWorkoutPhase("rest");
          return prescription.restSeconds;
        }
        if (workoutPhase === "rest") {
          setCurrentSet((set) => set + 1);
          setWorkoutPhase("work");
          setIsRunning(false);
          return prescription.workSeconds;
        }
        setWorkoutPhase("done");
        if (activeWorkout !== null) setCompletedExercises((completed) => completed.includes(activeWorkout) ? completed : [...completed, activeWorkout]);
        setIsRunning(false);
        return 0;
      });
      setSessionSeconds((current) => {
        const next = current + 1;
        const userWeight = Math.max(40, Number(weight) || 70);
        const met = workoutMet(currentWorkout, workoutPhase, aiAnalysis?.intensity || "Orta");
        const caloriesPerSecond = ((met * 3.5 * userWeight) / 200) / 60;
        setSessionCalories((calories) => calories + caloriesPerSecond);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeWorkout, aiAnalysis?.intensity, currentSet, currentWorkout, isRunning, weight, workoutPhase]);

  function openWorkout(index: number, queue: AiWorkout[] = workouts) {
    const nextWorkout = queue[index];
    if (!nextWorkout) return;
    setPlayerQueue(queue);
    setActiveWorkout(index);
    setTimer(workoutPrescription(nextWorkout).workSeconds);
    setIsRunning(false);
    setWorkoutPhase("work");
    setCurrentSet(1);
    setCompletedExercises([]);
    setSkippedExercises([]);
    setSessionSeconds(0);
    setSessionCalories(0);
  }

  function goToWorkout(index: number) {
    const nextWorkout = playerQueue[index];
    if (!nextWorkout) return;
    setActiveWorkout(index);
    setTimer(workoutPrescription(nextWorkout).workSeconds);
    setIsRunning(false);
    setWorkoutPhase("work");
    setCurrentSet(1);
  }

  function completeCurrentPhase() {
    if (!currentWorkout || activeWorkout === null) return;
    const prescription = workoutPrescription(currentWorkout);
    setIsRunning(false);
    if (workoutPhase === "rest") {
      setCurrentSet((set) => set + 1);
      setWorkoutPhase("work");
      setTimer(prescription.workSeconds);
      return;
    }
    if (currentSet < prescription.totalSets) {
      setWorkoutPhase("rest");
      setTimer(prescription.restSeconds);
      return;
    }
    setWorkoutPhase("done");
    setTimer(0);
    setCompletedExercises((current) => current.includes(activeWorkout) ? current : [...current, activeWorkout]);
  }

  function skipExercise() {
    if (activeWorkout === null) return;
    setSkippedExercises((current) => current.includes(activeWorkout) ? current : [...current, activeWorkout]);
    if (activeWorkout < playerQueue.length - 1) goToWorkout(activeWorkout + 1);
    else {
      setWorkoutPhase("done");
      setTimer(0);
      setIsRunning(false);
    }
  }

  function finishWorkout() {
    if (!playerQueue.length) return;
    setIsRunning(false);
    const completed = activeWorkout !== null && workoutPhase === "done" && !skippedExercises.includes(activeWorkout) && !completedExercises.includes(activeWorkout) ? [...completedExercises, activeWorkout] : completedExercises;
    const record: WorkoutSessionRecord = { id: crypto.randomUUID(), completedAt: new Date().toISOString(), durationSeconds: Math.max(1, sessionSeconds), calories: Math.max(1, Math.round(sessionCalories)), completedExercises: completed.length, totalExercises: playerQueue.length, exerciseNames: playerQueue.map((exercise) => exercise.name) };
    setActiveWorkout(null);
    setFeedbackDifficulty("Uygun");
    setFeedbackFatigue(3);
    setFeedbackPainAreas(["Yok"]);
    setFeedbackNote("");
    setPendingSession(record);
  }

  function toggleFeedbackPain(area: string) {
    setFeedbackPainAreas((current) => area === "Yok" ? ["Yok"] : [...current.filter((item) => item !== "Yok"), ...(current.includes(area) ? [] : [area])]);
  }

  async function saveWorkoutFeedback() {
    if (!pendingSession) return;
    const record: WorkoutSessionRecord = { ...pendingSession, difficulty: feedbackDifficulty, fatigue: feedbackFatigue, painAreas: feedbackPainAreas.length ? feedbackPainAreas : ["Yok"], feedbackNote: feedbackNote.trim() || undefined };
    setSessionHistory((current) => [record, ...current]);
    setPendingSession(null);
    setActiveView("progress");
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const baseRecord = { id: record.id, user_id: user.id, completed_at: record.completedAt, duration_seconds: record.durationSeconds, calories: record.calories, completed_exercises: record.completedExercises, total_exercises: record.totalExercises, exercise_names: record.exerciseNames };
      const { error } = await supabase.from("workout_sessions").insert({ ...baseRecord, difficulty: record.difficulty, fatigue: record.fatigue, pain_areas: record.painAreas, feedback_note: record.feedbackNote || null });
      if (error) await supabase.from("workout_sessions").insert(baseRecord);
    } catch {
      // Bağlantı yoksa kayıt bu oturumun ilerleme ekranında kalır.
    }
  }

  async function createPlan() {
    setSaving(true);
    setAiStatus("scanning");
    setAiStage("profile");
    setAiError("");
    setAiWorkouts([]);
    setAiAnalysis(null);
    setAiSchedule([]);
    setAiProgression([]);
    setAiFingerprint("");
    try {
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
    } catch {
      // Profil kaydı başarısız olsa bile AI planı üretmeye devam eder.
    }
    setAiStage("history");
    try {
      const exerciseCatalog = getExercisesForAI();
      setAiStage("planning");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 45_000);
      const trainingHistory = sessionHistory.slice(0, 8).map((session) => ({ completedAt: session.completedAt, completedExercises: session.completedExercises, totalExercises: session.totalExercises, difficulty: session.difficulty, fatigue: session.fatigue, painAreas: session.painAreas, feedbackNote: session.feedbackNote }));
      const aiResponse = await fetch("/api/generate-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, age, gender, height, weight, environment: gym, equipment: equipmentText, goal: goalText, requestedExercises, history, trainingHistory, adaptation, exerciseCatalog, photoDataUrl }), signal: controller.signal }).finally(() => window.clearTimeout(timeout));
      if (aiResponse.ok) {
        const aiPlan = await aiResponse.json() as { workouts?: Array<{ id: string; name: string; english: string; area: string; sets: number; reps: string; restSeconds: number; instructions?: string }>; rationale?: string; safetyNote?: string; analysis?: AiPlanAnalysis; weeklySchedule?: AiScheduleDay[]; progression?: string[]; profileFingerprint?: string };
        const normalizedWorkouts = aiPlan.workouts?.length ? normalizeAiWorkouts(aiPlan.workouts) : [];
        const personalizedWorkouts = personalizeAiWorkouts(normalizedWorkouts, gym, equipmentText, history, goalText, requestedExercises);
        if (personalizedWorkouts.length) setAiWorkouts(personalizedWorkouts);
        setAiRationale(aiPlan.rationale || "");
        setAiSafetyNote(aiPlan.safetyNote || "");
        setAiAnalysis(aiPlan.analysis || fallbackAnalysis(gym, equipmentText, history, goalText));
        setAiSchedule(Array.isArray(aiPlan.weeklySchedule) ? aiPlan.weeklySchedule : []);
        setAiProgression(Array.isArray(aiPlan.progression) ? aiPlan.progression : []);
        setAiFingerprint(aiPlan.profileFingerprint || "AI");
        setAiStage("complete");
        setAiStatus(personalizedWorkouts.length ? "complete" : "fallback");
      } else {
        const errorPayload = await aiResponse.json().catch(() => null) as { error?: string } | null;
        setAiError(errorPayload?.error || "AI analizi tamamlanamadı");
        setAiAnalysis(fallbackAnalysis(gym, equipmentText, history, goalText));
        setAiProgression(["Formu öğren ve hareketleri kontrollü tamamla.", "Uygun hareketlerde bir set veya iki tekrar ekle.", "Dinlenmeyi koruyarak hareket kalitesini sürdür.", "Ağrısız ilerlediysen yükü küçük oranda artır."]);
        setAiFingerprint("YEREL");
        setAiStatus("fallback");
      }
    } catch {
      setAiStatus("fallback");
      setAiError("AI bağlantısına ulaşılamadı; verilerinle yerel kişisel plan oluşturuldu.");
      setAiAnalysis(fallbackAnalysis(gym, equipmentText, history, goalText));
      setAiProgression(["Formu öğren ve hareketleri kontrollü tamamla.", "Uygun hareketlerde bir set veya iki tekrar ekle.", "Dinlenmeyi koruyarak hareket kalitesini sürdür.", "Ağrısız ilerlediysen yükü küçük oranda artır."]);
      setAiFingerprint("YEREL");
    }
    setAiStage("complete");
    setSaving(false);
    setStep(5);
  }

  function applyReadyProgram(program: typeof readyPrograms[number]) {
    const prepared = program.names.map((name) => exerciseLibrary.find((exercise) => exercise.name === name)).filter((exercise): exercise is typeof exerciseLibrary[number] => Boolean(exercise)).map((exercise) => ({ ...exercise, level: exercise.area, sets: `3 set · ${exercise.name === "Plank" || exercise.name === "Dead Bug" ? "30 sn" : "10 tekrar"}`, rest: "60 sn dinlenme", seconds: exercise.name === "Plank" || exercise.name === "Dead Bug" ? 30 : 45 }));
    setAiWorkouts(prepared);
    setAiRationale(`${program.title} seçildi. Bu hazır program, profilindeki AI planına alternatif olarak uygulanır.`);
    setAiAnalysis(fallbackAnalysis(gym, equipmentText, history, goalText));
    setAiSchedule([]);
    setAiProgression(["Tekniği öğren.", "Tekrarları düzenli tamamla.", "Dinlenme sürelerini koru.", "Hazır olduğunda küçük bir yük artışı yap."]);
    setAiFingerprint("HAZIR");
    setAiStatus("complete");
    setActiveView("plan");
  }

  return (
    <main className="app-shell">
      {step === 5 && <nav className="topbar">
        <div className="brand"><span className="brand-mark">↗</span><span>form<span className="brand-dot">.</span>ai</span></div>
        <div className="top-links"><button type="button" className={activeView === "plan" ? "active" : ""} onClick={() => setActiveView("plan")}>Antrenmanım</button><button type="button" className={activeView === "progress" ? "active" : ""} onClick={() => setActiveView("progress")}>İlerlemem</button><button type="button" className={activeView === "library" ? "active" : ""} onClick={() => setActiveView("library")}>Hareket kütüphanesi</button></div>
        <button type="button" className="profile-mini" onClick={() => step === 5 && setProfileEditing((editing) => !editing)}><span className="mini-avatar">{name ? name.charAt(0).toUpperCase() : "E"}</span><span>Profilim</span><span className="chevron">⌄</span></button>
      </nav>}

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
            <label className="textarea-label">ÖZELLİKLE İSTEDİĞİN HAREKETLER <small>İsteğe bağlı</small><textarea value={requestedExercises} onChange={(e) => setRequestedExercises(e.target.value)} placeholder="Örn. Yerde Dambıl Göğüs Presi, Goblet Squat" /></label>
            <div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(1)}>← Geri</button><button className="primary-btn" type="button" onClick={() => setStep(3)}>Devam et <span>→</span></button></div>
          </div>}

          {step === 3 && <div className="step-content photo-step">
            <div className="eyebrow">İSTEĞE BAĞLI VÜCUT ANALİZİ</div><h1>Vücudunu daha iyi<br /><em>anlayalım.</em></h1><p className="lead">Fotoğraf profil resmi değildir. İzninle vücut kompozisyonu ve yağlanma dağılımı hakkında yaklaşık gözlem yapıp programı buna göre uyarlayacağız.</p>
            <label className="upload-box">{photo ? <Image src={photo} alt="Vücut analizi için yüklenen fotoğraf" width={300} height={160} unoptimized /> : <><span className="upload-icon">＋</span><strong>Vücut fotoğrafı ekle</strong><small>Yüz görünmek zorunda değil · İsteğe bağlı</small></>}<input type="file" accept="image/*" onChange={handlePhoto} /></label>
            <AiScanFigure status="idle" /><div className="privacy-note"><span>⌁</span> Analiz tahminidir; tıbbi yağ oranı ölçümü değildir. Fotoğrafını istediğinde silebilirsin.</div><div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(2)}>← Geri</button><button className="primary-btn" type="button" onClick={() => setStep(4)}>Teste başla <span>→</span></button></div>
          </div>}

          {step === 4 && <div className="step-content history-step">
            <div className="eyebrow">SORU {questionIndex + 1} / 10</div><h1>Seni biraz<br /><em>daha tanıyalım.</em></h1><p className="lead">Cevapların programın yoğunluğunu, hareket seçimini ve ilerleme hızını belirleyecek.</p>
            <div className="question-card"><span className="question-number">{String(questionIndex + 1).padStart(2, "0")}</span><h2>{historyQuestions[questionIndex]}</h2>{questionIndex === 6 && <p className="multi-select-note">Birden fazla bölge seçebilirsin.</p>}<div className="answer-grid">{(answerOptions[questionIndex] ?? []).map((answer) => { const selected = questionIndex === 6 ? history[6].split(" · ").includes(answer) : history[questionIndex] === answer; return <button type="button" key={answer} className={selected ? "answer selected" : "answer"} onClick={() => questionIndex === 6 ? toggleInjury(answer) : setAnswer(answer)}>{answer}</button>; })}</div>{questionIndex === 9 && <textarea className="question-note" value={history[9]} onChange={(e) => setAnswer(e.target.value)} placeholder="Buraya yazabilirsin..." />}</div>
            {saving && <AiScanFigure status="scanning" stage={aiStage} />}<div className="action-row"><button className="back-btn" type="button" onClick={() => questionIndex ? setQuestionIndex(questionIndex - 1) : setStep(3)}>← Geri</button>{questionIndex < 9 ? <button className="primary-btn" type="button" onClick={() => setQuestionIndex(questionIndex + 1)}>Sonraki <span>→</span></button> : <button className="primary-btn" type="button" onClick={createPlan} disabled={saving}>{saving ? "AI verileri analiz ediyor…" : "Planımı oluştur ✦"}</button>}</div>
          </div>}
          <aside className="side-note"><div className="orb"><span>✦</span></div><p><strong>Bilim + senin ritmin.</strong><br />Her plan, hedeflerine ve günlük hayatına uyum sağlar.</p></aside>
        </section>
      ) : (
        <section className="dashboard">
          {profileEditing && <div className="profile-editor"><div><div className="eyebrow">PROFİLİ GÜNCELLE</div><h2>Spor ortamını ve ekipmanlarını değiştir</h2><p>Kaydettiğinde AI, yeni profil verilerinle programı yeniden oluşturur.</p></div><div className="profile-editor-fields"><div className="choice-cards"><button type="button" className={gym === "Evde" ? "choice selected" : "choice"} onClick={() => setGym("Evde")}><span>⌂</span><strong>Evde</strong><small>Ekipmansız veya ev ekipmanı</small></button><button type="button" className={gym === "Salon" ? "choice selected" : "choice"} onClick={() => setGym("Salon")}><span>▦</span><strong>Spor salonunda</strong><small>Salon makineleri ve ağırlıklar</small></button></div><label className="textarea-label">EKİPMANLARIN<textarea value={equipmentText} onChange={(event) => setEquipmentText(event.target.value)} placeholder="Örn. dambıl, direnç bandı, bench" /></label><label className="textarea-label">İSTEDİĞİN HAREKETLER<textarea value={requestedExercises} onChange={(event) => setRequestedExercises(event.target.value)} placeholder="Örn. Yerde Dambıl Göğüs Presi" /></label><button className="primary-btn" type="button" onClick={() => { setProfileEditing(false); void createPlan(); }} disabled={saving}>{saving ? "AI yeniden tarıyor…" : "Profili kaydet ve programı yenile →"}</button></div></div>}
          {activeView === "progress" ? <ProgressView name={name} sessions={sessionHistory} referenceTime={progressReferenceTime} energyMetrics={energyMetrics} /> : activeView === "library" ? <LibraryView onOpenWorkout={(exercise) => { setActiveView("plan"); openWorkout(0, [exercise]); }} onAddWorkout={(exercise) => setAiWorkouts((current) => current.some((item) => item.id === exercise.id) ? current : [...current, exercise])} /> : <>
          {activeWorkout !== null && currentWorkout && currentGuide && currentPrescription ? <div className="workout-player">
            <button className="back-btn" type="button" onClick={() => { setIsRunning(false); setActiveWorkout(null); }}>← Plana dön</button>
            <div className="workout-session-progress" aria-label="Antrenman ilerlemesi">{playerQueue.map((exercise, index) => <span key={`${exercise.name}-${index}`} className={completedExercises.includes(index) ? "complete" : skippedExercises.includes(index) ? "skipped" : index === activeWorkout ? "active" : ""} />)}</div>
            <ExerciseAnimation exercise={currentWorkout} />
            <div className="player-title-row"><div><div className="eyebrow">HAREKET {activeWorkout + 1} / {playerQueue.length}</div><h1>{currentWorkout.name}</h1></div><span className={`phase-badge ${workoutPhase}`}>{workoutPhase === "rest" ? "DİNLENME" : workoutPhase === "done" ? "TAMAMLANDI" : `SET ${currentSet}/${currentPrescription.totalSets}`}</span></div>
            <div className="movement-guide"><div className="guide-heading"><span>3 ADIMDA UYGULA</span><strong>{currentGuide.focus}</strong></div><ol><li>{currentGuide.start}</li><li>{currentWorkout.instructions}</li><li>{currentGuide.finish}</li></ol></div>
            <div className="form-cues"><div><span>NEFES</span><strong>{currentGuide.breathe}</strong></div><div className="warning"><span>SIK HATA</span><strong>{currentGuide.mistake}</strong></div></div>
            <div className={`timer-card phase-${workoutPhase}`}><span>{isRunning ? workoutPhase === "rest" ? "DİNLENME SÜRÜYOR" : "AKTİF SET" : workoutPhase === "done" ? "HAREKET TAMAM" : workoutPhase === "rest" ? "DİNLENMEYE HAZIR" : "HAZIR"}</span><strong>{formatClock(timer)}</strong><small>{workoutPhase === "rest" ? `Sonraki: set ${Math.min(currentSet + 1, currentPrescription.totalSets)}` : `${currentPrescription.target} · yaklaşık ${displayedSessionCalories} kcal`}</small></div>
            <div className="set-tracker"><div><span>SETLER</span><strong>{currentSet} / {currentPrescription.totalSets}</strong></div><div className="set-dots">{Array.from({ length: currentPrescription.totalSets }, (_, index) => <i key={index} className={index + 1 < currentSet || workoutPhase === "done" ? "complete" : index + 1 === currentSet ? "active" : ""} />)}</div><small>{currentWorkout.rest}</small></div>
            <div className="player-tools"><button type="button" onClick={() => activeWorkout > 0 && goToWorkout(activeWorkout - 1)} disabled={activeWorkout === 0}>← Önceki</button>{workoutPhase !== "done" && <button type="button" onClick={completeCurrentPhase}>{workoutPhase === "rest" ? "Dinlenmeyi atla" : "Seti tamamla"}</button>}<button type="button" onClick={skipExercise}>Hareketi atla →</button></div>
            <div className="player-actions"><button className="start-btn" type="button" onClick={() => workoutPhase === "done" ? activeWorkout < playerQueue.length - 1 ? goToWorkout(activeWorkout + 1) : void finishWorkout() : setIsRunning((running) => !running)}>{workoutPhase === "done" ? activeWorkout < playerQueue.length - 1 ? "Sonraki harekete geç" : "Antrenmanı kaydet" : isRunning ? "Duraklat" : workoutPhase === "rest" ? "Dinlenmeyi başlat" : "Seti başlat"} <span>→</span></button></div>
            <button className="finish-btn" type="button" onClick={() => void finishWorkout()}>✓ Antrenmanı bitir ve kaydet</button>
          </div> : <>
          <div className="dashboard-head"><div><div className="eyebrow">BUGÜNÜN PLANI · 01</div><h1>{name || "Ece"}, <em>hazır mısın?</em></h1><p>Verilerine göre ilk program taslağını hazırladık. İlerledikçe daha da kişiselleştireceğiz.</p></div><div className="streak-card"><span>✦</span><strong>4</strong><small>günlük seri</small></div></div>
          <div className="stats-row"><div><span>Vücut kitle indeksi</span><strong>{bmi}</strong><small>İlk ölçüm</small></div><div><span>Hedef</span><strong>{goalText ? "Kişisel" : "Güçlenme"}</strong><small>Profiline göre</small></div><div><span>Ortam</span><strong>{gym}</strong><small>{equipmentText || "Ekipmansız"}</small></div></div>
          <div className="wellness-row"><div className="wellness-card calorie-card"><div><span>BUGÜNÜN ANTRENMAN ENERJİSİ</span><strong>{displayedSessionCalories} <small>kcal</small></strong><p>Hareket türü, yoğunluk, süre ve kilona göre MET tabanlı tahmin.</p></div><div className="calorie-ring"><i>{displayedSessionCalories}</i></div><div className="calorie-note"><span>TAKİP</span><strong>Antrenman içi</strong><small>Aktif set ve dinlenme ayrı hesaplanır</small></div></div></div>
          {energyMetrics && <div className="energy-dashboard"><article><span>BAZAL ENERJİ · BMR</span><strong>{energyMetrics.bmr} <small>kcal/gün</small></strong><p>Vücudunun dinlenme halindeki yaklaşık enerji ihtiyacı.</p></article><article><span>GÜNLÜK TOPLAM · TDEE</span><strong>{energyMetrics.tdee} <small>kcal/gün</small></strong><p>{energyMetrics.activityLabel} düzeyine göre bakım tahmini.</p></article><div><strong>Yaklaşık değer</strong><p>Beslenme hedefi veya tıbbi ölçüm değildir. İlerleme raporunda gerçekleşen antrenman süresi ayrıca hesaplanır.</p></div></div>}
          <div className="plan-explanation"><div><div className="eyebrow">PLANIN NEDEN BÖYLE?</div><h2>{planLevel} · {planGoal}</h2><p>{aiRationale || "Programın; seçtiğin ortam, ekipmanların, spor geçmişin ve yazdığın hedef birlikte değerlendirilerek oluşturuldu. İlerledikçe set, tekrar ve hareket varyasyonları güncellenecek."}</p>{aiSafetyNote && <div className="ai-safety"><strong>Güvenlik notu</strong><span>{aiSafetyNote}</span></div>}{aiError && <div className="ai-error">{aiError}</div>}</div><AiScanFigure compact status={aiStatus} stage={aiStage} /></div>
          <AdaptivePlanCard adaptation={adaptation} sessionCount={sessionHistory.length} />
          {aiAnalysis && <AiPlanInsights analysis={aiAnalysis} schedule={aiSchedule} progression={aiProgression} fingerprint={aiFingerprint} />}
          <ReadyPrograms onApply={applyReadyProgram} />
          <div className="workout-layout"><div className="workout-main"><div className="section-title"><div><div className="eyebrow">BUGÜN</div><h2>Full body · {planLevel}</h2></div><button className="outline-btn" type="button">⋮</button></div><div className="workout-list">{workouts.map((workout, index) => { const guide = getMotionGuide(workout); return <article className="workout-card" key={workout.name}><ExerciseAnimation exercise={workout} compact /><div className="exercise-info"><div className="exercise-labels"><div className="pill">{workout.level}</div><span>{guide.action}</span></div><h3>{workout.name} <small>{workout.english}</small></h3><p>{workout.sets} · {workout.rest}</p><details className="how-to"><summary>3 adımda nasıl yapılır?</summary><ol className="mini-steps"><li>{guide.start}</li><li>{workout.instructions}</li><li>{guide.finish}</li></ol></details></div><button className="play-btn" type="button" aria-label={`${workout.name} hareket akışını ve sayacını aç`} onClick={() => openWorkout(index)}><span>▶</span><small>Aç</small></button></article>; })}</div><button className="start-btn" type="button" onClick={() => openWorkout(0)}>Antrenmana başla <span>→</span></button></div><aside className="coach-card"><div className="coach-top"><span className="spark">✦</span><span>FORM AI</span></div><h2>Bugün senden<br /><em>tek bir şey</em> istiyor:</h2><p>Hareketi mükemmel yapmak değil, devam etmek.</p><div className="coach-line" /><small>İyi antrenmanlar, {name || "Ece"}.</small></aside></div></>}
          </>}
        </section>
      )}
      {pendingSession && <div className="feedback-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><div className="feedback-dialog"><div className="feedback-check">✓</div><div className="eyebrow">ANTRENMAN TAMAMLANDI</div><h2 id="feedback-title">Programını bir sonraki<br /><em>seviyeye uyarlayalım.</em></h2><p>Bu kısa geri bildirim sonraki antrenmanın set, tekrar, dinlenme ve hareket seçimini belirler.</p><fieldset><legend>Antrenman nasıl hissettirdi?</legend><div className="feedback-options">{(["Kolay", "Uygun", "Zor"] as WorkoutDifficulty[]).map((option) => <button type="button" className={feedbackDifficulty === option ? "selected" : ""} onClick={() => setFeedbackDifficulty(option)} key={option}>{option}</button>)}</div></fieldset><fieldset><legend>Antrenman sonrası yorgunluk</legend><div className="fatigue-scale">{[1, 2, 3, 4, 5].map((value) => <button type="button" className={feedbackFatigue === value ? "selected" : ""} onClick={() => setFeedbackFatigue(value)} key={value}><strong>{value}</strong><small>{value === 1 ? "Çok düşük" : value === 3 ? "Orta" : value === 5 ? "Çok yüksek" : ""}</small></button>)}</div></fieldset><fieldset><legend>Ağrı veya rahatsızlık var mı?</legend><div className="feedback-options pain-options">{["Yok", "Bel", "Diz", "Omuz", "Diğer"].map((area) => <button type="button" className={feedbackPainAreas.includes(area) ? "selected" : ""} onClick={() => toggleFeedbackPain(area)} key={area}>{area}</button>)}</div></fieldset><label className="feedback-note">Eklemek istediğin bir not <small>İsteğe bağlı</small><textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="Örn. Son sette formum bozuldu veya dizimde hassasiyet hissettim." /></label><div className="feedback-summary"><span>SONRAKİ ADIM</span><strong>{feedbackPainAreas.some((area) => area !== "Yok") || feedbackDifficulty === "Zor" || feedbackFatigue >= 4 ? "Toparlanma ve güvenlik öncelikli plan" : feedbackDifficulty === "Kolay" && feedbackFatigue <= 2 ? "Kontrollü yük artışı için veri kaydı" : "Mevcut yükü değerlendiren dengeli plan"}</strong></div><button className="primary-btn feedback-save" type="button" onClick={() => void saveWorkoutFeedback()}>Kaydet ve programımı uyarla <span>→</span></button></div></div>}
      <footer><span>form.ai · daha güçlü bir sen için</span><span>© 2024</span></footer>
    </main>
  );
}
