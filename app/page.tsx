"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type AiWorkout = { name: string; english: string; area: string; sets: string; rest: string; seconds: number; tone: string; icon: string; level: string; instructions: string };

const motionGuides: Record<string, { action: string; focus: string; start: string; move: string; finish: string }> = {
  push: { action: "İT", focus: "Göğüs · omuz · triceps", start: "Ağırlığı göğüs hizasında başlat.", move: "Dirsekleri kontrollü bük, sonra ağırlığı ileri veya yukarı it.", finish: "Kolları kilitlemeden başlangıç pozisyonuna dön." },
  pull: { action: "ÇEK", focus: "Sırt · arka omuz · kol", start: "Gövdeyi sabitle, omuzları kulaklardan uzak tut.", move: "Dirsekleri geriye ve kalçaya doğru çek.", finish: "Kolları kontrollü uzat, ağırlığı bırakma." },
  lower: { action: "İN → KALK", focus: "Bacak · kalça · merkez bölge", start: "Ayakları sabitle, göğsü açık ve karnı sık tut.", move: "Kalçayı geriye indir, topuktan güç alarak yüksel.", finish: "Dizleri kilitlemeden dik pozisyona dön." },
  core: { action: "SABİTLE", focus: "Karın · bel çevresi · kalça", start: "Bel boşluğunu kontrol et, kaburgaları aşağıda tut.", move: "Kol veya bacakları uzatırken gövdeyi oynatma.", finish: "Merkezi sıkı tutarak başlangıca dön." },
  cardio: { action: "RİTİM", focus: "Nabız · bacak · koordinasyon", start: "Eller ve ayaklar hazır, gövde hafif öne eğik.", move: "Hareketi ritimli ve küçük adımlarla sürdür.", finish: "Nefesi düzenle, yumuşak inişlerle devam et." },
  stretch: { action: "UZAT", focus: "Hareket açıklığı · nefes", start: "Omurgayı uzun tut, eklemleri rahat bırak.", move: "Gerilimi hafifçe artır, nefesini yavaşlat.", finish: "Zorlamadan başlangıç pozisyonuna dön." },
};

function getMotionGuide(exercise: { name: string; english: string }) {
  return motionGuides[getMotionClass(exercise)];
}

function MotionFigure({ pose = "start" }: { pose?: "start" | "finish" }) {
  return <span className={`motion-figure pose-${pose}`}><span className="motion-head" /><span className="motion-torso" /><span className="motion-arm arm-left" /><span className="motion-arm arm-right" /><span className="motion-leg leg-left" /><span className="motion-leg leg-right" /></span>;
}

function getMotionClass(exercise: { name: string; english: string }) {
  const text = `${exercise.name} ${exercise.english}`.toLowerCase();
  if (/stretch|pose|rotation|mobility|cossack|90\/90|dislocate|rocker/.test(text)) return "stretch";
  if (/burpee|jumping|high knees|butt kicks|skater|mountain climber|bear crawl|inchworm|squat thrust|box jump/.test(text)) return "cardio";
  if (/plank|crunch|dead bug|hollow|v-up|leg raise|pallof|woodchop|ab wheel|russian twist/.test(text)) return "core";
  if (/squat|lunge|deadlift|leg |calf|glute|hip thrust|bridge|kickback|fire hydrant|step-up|nordic/.test(text)) return "lower";
  if (/row|pulldown|pull-up|chin-up|back|superman|face pull|hang/.test(text)) return "pull";
  return "push";
}

function ExerciseAnimation({ exercise, compact = false }: { exercise: { name: string; english: string; tone: string }; compact?: boolean }) {
  const motionClass = getMotionClass(exercise);
  const guide = motionGuides[motionClass];
  return <div className={`exercise-media ${exercise.tone} motion-${motionClass} ${compact ? "compact" : ""}`} aria-label={`${exercise.name} hareket akışı`}>
    {!compact && <div className="motion-header"><span>HAREKET AKIŞI</span><strong>{guide.action}</strong></div>}
    <div className="motion-stage">
      <span className="motion-floor" />
      <div className="motion-sequence">
        <div className="motion-position"><MotionFigure pose="start" /><small>Başlangıç</small></div>
        <div className="motion-route"><span>→</span><small>{guide.action}</small></div>
        <div className="motion-position"><MotionFigure pose="finish" /><small>Hareket</small></div>
      </div>
    </div>
    {!compact && <div className="motion-caption"><strong>{guide.focus}</strong><span>{guide.move}</span></div>}
  </div>;
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

function isExerciseSafeForProfile(exercise: { name: string; english: string }, gym: string, equipmentText: string, history: string[]) {
  const text = `${exercise.name} ${exercise.english}`.toLocaleLowerCase("tr-TR");
  const pain = (history[6] || "").toLocaleLowerCase("tr-TR");
  const equipment = equipmentText.toLocaleLowerCase("tr-TR");
  if (pain.includes("diz") && /squat|lunge|jump|step|leg press|mountain climber|box jump|skater/.test(text)) return false;
  if (pain.includes("omuz") && /push|press|dip|shoulder|fly|overhead|lateral raise|pulldown|barfiks/.test(text)) return false;
  if (pain.includes("bel") && /deadlift|good morning|back extension|woodchop|superman|russian twist/.test(text)) return false;
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

function normalizeAiWorkouts(items: Array<{ name: string; english: string; area: string; sets: number; reps: string; restSeconds: number; instructions?: string }>): AiWorkout[] {
  const visuals: Record<string, { tone: string; icon: string }> = { Bacak: { tone: "orange", icon: "◒" }, Göğüs: { tone: "blue", icon: "✦" }, Sırt: { tone: "purple", icon: "↗" }, Kalça: { tone: "orange", icon: "◓" }, Core: { tone: "blue", icon: "—" } };
  return items.map((item) => {
    const libraryExercise = findLibraryExercise(item);
    const area = libraryExercise?.area || item.area;
    return { ...item, name: libraryExercise?.name || item.name, english: libraryExercise?.english || item.english, area, instructions: item.instructions || libraryExercise?.instructions || "Hareketi kontrollü yap, nefesini tutma ve ağrı hissedersen dur.", sets: `${item.sets} set · ${item.reps}`, rest: `${item.restSeconds} sn dinlenme`, seconds: item.reps.includes("sn") ? 30 : 45, level: area, ...(libraryExercise ? { tone: libraryExercise.tone, icon: libraryExercise.icon } : visuals[area] || { tone: "purple", icon: "✦" }) };
  });
}

function AiScanFigure({ compact = false, status = "scanning" }: { compact?: boolean; status?: "idle" | "scanning" | "complete" | "fallback" }) {
  const copy = status === "complete" ? ["AI verileri taradı", "Kişisel programın hazırlandı"] : status === "fallback" ? ["Veriler tarandı", "Yedek plan hazırlandı; AI bağlantısı yeniden denenebilir"] : status === "idle" ? ["AI analizi hazır", "Profil, test ve ölçümler birlikte değerlendirilecek"] : ["AI verilerini tarıyor", "Metin, test ve ölçümler birlikte analiz ediliyor"];
  return <div className={`${compact ? "ai-scan compact" : "ai-scan"} ${status}`}><div className="scan-figure"><span className="scan-head" /><span className="scan-body" /><span className="scan-line" /></div><div><strong>{copy[0]}</strong><small>{copy[1]}</small></div></div>;
}

function ProgressView({ name, calories }: { name: string; calories: number }) {
  return <div className="subview"><div className="eyebrow">İLERLEMEM</div><h1>{name || "Sporcu"}, <em>ritmini gör.</em></h1><p className="lead">Tamamladığın antrenmanlar, süreler ve enerji verileri burada birikir.</p><div className="progress-cards"><div><span>BU HAFTA</span><strong>0</strong><small>tamamlanan antrenman</small></div><div><span>TOPLAM SÜRE</span><strong>0 dk</strong><small>hareket kaydı bekleniyor</small></div><div><span>YAKILAN ENERJİ</span><strong>{calories} kcal</strong><small>bu oturum</small></div></div><div className="progress-panel"><div className="section-title"><div><div className="eyebrow">İLERLEME GÜNLÜĞÜ</div><h2>İlk kaydını oluşturalım</h2></div><span className="progress-status">Hazır</span></div><div className="empty-progress"><span>✦</span><p>İlk antrenmanını bitirdiğinde süre, kalori ve devamlılık verilerin burada görünecek.</p></div></div></div>;
}

function LibraryView({ onOpenWorkout }: { onOpenWorkout: (index: number) => void }) {
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState("Tümü");
  const [visibleCount, setVisibleCount] = useState(30);
  const areas = ["Tümü", ...Array.from(new Set(exerciseLibrary.map((exercise) => exercise.area)))];
  const filteredExercises = exerciseLibrary.filter((exercise) => {
    const matchesArea = areaFilter === "Tümü" || exercise.area === areaFilter;
    const searchText = `${exercise.name} ${exercise.english} ${exercise.area}`.toLowerCase();
    return matchesArea && searchText.includes(query.toLowerCase().trim());
  });
  const visibleExercises = filteredExercises.slice(0, visibleCount);

  return <div className="subview"><div className="eyebrow">HAREKET KÜTÜPHANESİ</div><h1>Doğru form,<br /><em>net hareket.</em></h1><p className="lead">{exerciseLibrary.length}+ hareketi ara. Her kartta başlangıçtan bitişe hareket akışını ve ilk form ipucunu gör.</p><div className="library-toolbar"><strong>{filteredExercises.length} hareket</strong><span>{exerciseLibrary.length} toplam kayıt</span></div><div className="library-filters"><input aria-label="Hareket ara" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(30); }} placeholder="Hareket ara…" /><select aria-label="Hareket kategorisi" value={areaFilter} onChange={(event) => { setAreaFilter(event.target.value); setVisibleCount(30); }}>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></div><div className="library-grid">{visibleExercises.map((exercise) => { const index = exerciseLibrary.findIndex((candidate) => candidate.name === exercise.name); const guide = getMotionGuide(exercise); return <article className="library-card" key={exercise.name}><ExerciseAnimation exercise={exercise} compact /><div className="library-card-copy"><div className="pill">{exercise.area}</div><h3>{exercise.name}</h3><small>{exercise.english}</small><p>{guide.move}</p><div className="library-actions"><button type="button" className="play-library" onClick={() => onOpenWorkout(index)}>Hareketi aç →</button></div></div></article>; })}</div>{visibleExercises.length < filteredExercises.length && <button className="outline-btn library-more" type="button" onClick={() => setVisibleCount((count) => count + 30)}>Daha fazla hareket göster →</button>}{!filteredExercises.length && <p className="library-empty">Bu aramayla eşleşen hareket bulunamadı.</p>}</div>;
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
  const [timer, setTimer] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCalories, setSessionCalories] = useState(0);
  const [aiWorkouts, setAiWorkouts] = useState<AiWorkout[]>([]);
  const [aiRationale, setAiRationale] = useState("");
  const [aiSafetyNote, setAiSafetyNote] = useState("");
  const [activeView, setActiveView] = useState<"plan" | "progress" | "library">("plan");
  const [aiStatus, setAiStatus] = useState<"idle" | "scanning" | "complete" | "fallback">("idle");
  const [aiError, setAiError] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);

  const workouts = useMemo(() => aiWorkouts.length ? aiWorkouts : createPersonalPlan(gym, equipmentText, history, goalText, requestedExercises), [aiWorkouts, gym, equipmentText, history, goalText, requestedExercises]);
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
    setAiStatus("scanning");
    setAiError("");
    setAiWorkouts([]);
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
    try {
      const exerciseCatalog = exerciseLibrary.map(({ name: exerciseName, english, area, requires, bodyweight, goals }) => ({ name: exerciseName, english, area, requires, bodyweight, goals }));
      const aiResponse = await fetch("/api/generate-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, age, gender, height, weight, environment: gym, equipment: equipmentText, goal: goalText, requestedExercises, history, exerciseCatalog, photoDataUrl }) });
      if (aiResponse.ok) {
        const aiPlan = await aiResponse.json() as { workouts?: Array<{ name: string; english: string; area: string; sets: number; reps: string; restSeconds: number; instructions?: string }>; rationale?: string; safetyNote?: string };
        const normalizedWorkouts = aiPlan.workouts?.length ? normalizeAiWorkouts(aiPlan.workouts) : [];
        const personalizedWorkouts = personalizeAiWorkouts(normalizedWorkouts, gym, equipmentText, history, goalText, requestedExercises);
        if (personalizedWorkouts.length) setAiWorkouts(personalizedWorkouts);
        setAiRationale(aiPlan.rationale || "");
        setAiSafetyNote(aiPlan.safetyNote || "");
        setAiStatus(personalizedWorkouts.length ? "complete" : "fallback");
      } else {
        const errorPayload = await aiResponse.json().catch(() => null) as { error?: string } | null;
        setAiError(errorPayload?.error || "AI analizi tamamlanamadı");
        setAiStatus("fallback");
      }
    } catch {
      setAiStatus("fallback");
      setAiError("AI bağlantısına ulaşılamadı; verilerinle yerel kişisel plan oluşturuldu.");
    }
    setSaving(false);
    setStep(5);
  }

  function applyReadyProgram(program: typeof readyPrograms[number]) {
    const prepared = program.names.map((name) => exerciseLibrary.find((exercise) => exercise.name === name)).filter((exercise): exercise is typeof exerciseLibrary[number] => Boolean(exercise)).map((exercise) => ({ ...exercise, level: exercise.area, sets: `3 set · ${exercise.name === "Plank" || exercise.name === "Dead Bug" ? "30 sn" : "10 tekrar"}`, rest: "60 sn dinlenme", seconds: exercise.name === "Plank" || exercise.name === "Dead Bug" ? 30 : 45 }));
    setAiWorkouts(prepared);
    setAiRationale(`${program.title} seçildi. Bu hazır program, profilindeki AI planına alternatif olarak uygulanır.`);
    setAiStatus("complete");
    setActiveView("plan");
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark">↗</span><span>form<span className="brand-dot">.</span>ai</span></div>
        <div className="top-links"><button type="button" className={activeView === "plan" ? "active" : ""} onClick={() => setActiveView("plan")}>Antrenmanım</button><button type="button" className={activeView === "progress" ? "active" : ""} onClick={() => setActiveView("progress")}>İlerlemem</button><button type="button" className={activeView === "library" ? "active" : ""} onClick={() => setActiveView("library")}>Hareket kütüphanesi</button></div>
        <button type="button" className="profile-mini" onClick={() => step === 5 && setProfileEditing((editing) => !editing)}><span className="mini-avatar">{name ? name.charAt(0).toUpperCase() : "E"}</span><span>Profilim</span><span className="chevron">⌄</span></button>
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
            <label className="textarea-label">ÖZELLİKLE İSTEDİĞİN HAREKETLER <small>İsteğe bağlı</small><textarea value={requestedExercises} onChange={(e) => setRequestedExercises(e.target.value)} placeholder="Örn. Yerde Dambıl Göğüs Presi, Goblet Squat" /></label>
            <div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(1)}>← Geri</button><button className="primary-btn" type="button" onClick={() => setStep(3)}>Devam et <span>→</span></button></div>
          </div>}

          {step === 3 && <div className="step-content photo-step">
            <div className="eyebrow">İSTEĞE BAĞLI VÜCUT ANALİZİ</div><h1>Vücudunu daha iyi<br /><em>anlayalım.</em></h1><p className="lead">Fotoğraf profil resmi değildir. İzninle vücut kompozisyonu ve yağlanma dağılımı hakkında yaklaşık gözlem yapıp programı buna göre uyarlayacağız.</p>
            <label className="upload-box">{photo ? <img src={photo} alt="Vücut analizi için yüklenen fotoğraf" /> : <><span className="upload-icon">＋</span><strong>Vücut fotoğrafı ekle</strong><small>Yüz görünmek zorunda değil · İsteğe bağlı</small></>}<input type="file" accept="image/*" onChange={handlePhoto} /></label>
            <AiScanFigure status="idle" /><div className="privacy-note"><span>⌁</span> Analiz tahminidir; tıbbi yağ oranı ölçümü değildir. Fotoğrafını istediğinde silebilirsin.</div><div className="action-row"><button className="back-btn" type="button" onClick={() => setStep(2)}>← Geri</button><button className="primary-btn" type="button" onClick={() => setStep(4)}>Teste başla <span>→</span></button></div>
          </div>}

          {step === 4 && <div className="step-content history-step">
            <div className="eyebrow">SORU {questionIndex + 1} / 10</div><h1>Seni biraz<br /><em>daha tanıyalım.</em></h1><p className="lead">Cevapların programın yoğunluğunu, hareket seçimini ve ilerleme hızını belirleyecek.</p>
            <div className="question-card"><span className="question-number">{String(questionIndex + 1).padStart(2, "0")}</span><h2>{historyQuestions[questionIndex]}</h2>{questionIndex === 6 && <p className="multi-select-note">Birden fazla bölge seçebilirsin.</p>}<div className="answer-grid">{(answerOptions[questionIndex] ?? []).map((answer) => { const selected = questionIndex === 6 ? history[6].split(" · ").includes(answer) : history[questionIndex] === answer; return <button type="button" key={answer} className={selected ? "answer selected" : "answer"} onClick={() => questionIndex === 6 ? toggleInjury(answer) : setAnswer(answer)}>{answer}</button>; })}</div>{questionIndex === 9 && <textarea className="question-note" value={history[9]} onChange={(e) => setAnswer(e.target.value)} placeholder="Buraya yazabilirsin..." />}</div>
            {saving && <AiScanFigure status="scanning" />}<div className="action-row"><button className="back-btn" type="button" onClick={() => questionIndex ? setQuestionIndex(questionIndex - 1) : setStep(3)}>← Geri</button>{questionIndex < 9 ? <button className="primary-btn" type="button" onClick={() => setQuestionIndex(questionIndex + 1)}>Sonraki <span>→</span></button> : <button className="primary-btn" type="button" onClick={createPlan} disabled={saving}>{saving ? "AI verileri tarıyor…" : "Planımı oluştur ✦"}</button>}</div>
          </div>}
          <aside className="side-note"><div className="orb"><span>✦</span></div><p><strong>Bilim + senin ritmin.</strong><br />Her plan, hedeflerine ve günlük hayatına uyum sağlar.</p></aside>
        </section>
      ) : (
        <section className="dashboard">
          {profileEditing && <div className="profile-editor"><div><div className="eyebrow">PROFİLİ GÜNCELLE</div><h2>Spor ortamını ve ekipmanlarını değiştir</h2><p>Kaydettiğinde AI, yeni profil verilerinle programı yeniden oluşturur.</p></div><div className="profile-editor-fields"><div className="choice-cards"><button type="button" className={gym === "Evde" ? "choice selected" : "choice"} onClick={() => setGym("Evde")}><span>⌂</span><strong>Evde</strong><small>Ekipmansız veya ev ekipmanı</small></button><button type="button" className={gym === "Salon" ? "choice selected" : "choice"} onClick={() => setGym("Salon")}><span>▦</span><strong>Spor salonunda</strong><small>Salon makineleri ve ağırlıklar</small></button></div><label className="textarea-label">EKİPMANLARIN<textarea value={equipmentText} onChange={(event) => setEquipmentText(event.target.value)} placeholder="Örn. dambıl, direnç bandı, bench" /></label><label className="textarea-label">İSTEDİĞİN HAREKETLER<textarea value={requestedExercises} onChange={(event) => setRequestedExercises(event.target.value)} placeholder="Örn. Yerde Dambıl Göğüs Presi" /></label><button className="primary-btn" type="button" onClick={() => { setProfileEditing(false); void createPlan(); }} disabled={saving}>{saving ? "AI yeniden tarıyor…" : "Profili kaydet ve programı yenile →"}</button></div></div>}
          {activeView === "progress" ? <ProgressView name={name} calories={sessionCalories} /> : activeView === "library" ? <LibraryView onOpenWorkout={(index) => { setActiveView("plan"); openWorkout(index); }} /> : <>
          {activeWorkout !== null ? <div className="workout-player"><button className="back-btn" type="button" onClick={() => { setIsRunning(false); setActiveWorkout(null); }}>← Plana dön</button><ExerciseAnimation exercise={workouts[activeWorkout]} /><div className="eyebrow">HAREKET {activeWorkout + 1} / {workouts.length}</div><h1>{workouts[activeWorkout].name}</h1><div className="movement-guide"><div className="guide-heading"><span>3 ADIMDA UYGULA</span><strong>{getMotionGuide(workouts[activeWorkout]).focus}</strong></div><ol><li>{getMotionGuide(workouts[activeWorkout]).start}</li><li>{workouts[activeWorkout].instructions}</li><li>{getMotionGuide(workouts[activeWorkout]).finish}</li></ol></div><div className="timer-card"><span>{isRunning ? "AKTİF SET" : timer === 0 ? "SET TAMAMLANDI" : "HAZIR"}</span><strong>00:{String(timer).padStart(2, "0")}</strong><small>Yaklaşık {sessionCalories} kcal</small></div><div className="player-meta"><strong>{workouts[activeWorkout].sets}</strong><span>{workouts[activeWorkout].level}</span></div><div className="player-actions"><button className="outline-btn" type="button" onClick={() => openWorkout(activeWorkout > 0 ? activeWorkout - 1 : workouts.length - 1)}>← Önceki</button><button className="start-btn" type="button" onClick={() => timer === 0 ? openWorkout((activeWorkout + 1) % workouts.length) : setIsRunning((running) => !running)}>{isRunning ? "Duraklat" : timer === 0 ? "Sonraki hareket" : "Seti başlat"} <span>→</span></button></div><button className="finish-btn" type="button" onClick={finishWorkout}>✓ Antrenmanı bitir</button></div> : <>
          <div className="dashboard-head"><div><div className="eyebrow">BUGÜNÜN PLANI · 01</div><h1>{name || "Ece"}, <em>hazır mısın?</em></h1><p>Verilerine göre ilk program taslağını hazırladık. İlerledikçe daha da kişiselleştireceğiz.</p></div><div className="streak-card"><span>✦</span><strong>4</strong><small>günlük seri</small></div></div>
          <div className="stats-row"><div><span>Vücut kitle indeksi</span><strong>{bmi}</strong><small>İlk ölçüm</small></div><div><span>Hedef</span><strong>{goalText ? "Kişisel" : "Güçlenme"}</strong><small>Profiline göre</small></div><div><span>Ortam</span><strong>{gym}</strong><small>{equipmentText || "Ekipmansız"}</small></div></div>
          <div className="wellness-row"><div className="wellness-card calorie-card"><div><span>BUGÜNÜN KALORİSİ</span><strong>{sessionCalories || 0} <small>kcal</small></strong><p>Aktif set süresi arttıkça tahmini değer güncellenir.</p></div><div className="calorie-ring"><i>{sessionCalories || 0}</i></div><div className="calorie-note"><span>TAKİP</span><strong>Antrenman içi</strong><small>Hareketi tamamladıkça kaydedilir</small></div></div></div>
          <div className="plan-explanation"><div><div className="eyebrow">PLANIN NEDEN BÖYLE?</div><h2>{planLevel} · {planGoal}</h2><p>{aiRationale || "Programın; seçtiğin ortam, ekipmanların, spor geçmişin ve yazdığın hedef birlikte değerlendirilerek oluşturuldu. İlerledikçe set, tekrar ve hareket varyasyonları güncellenecek."}</p>{aiSafetyNote && <div className="ai-safety"><strong>Güvenlik notu</strong><span>{aiSafetyNote}</span></div>}{aiError && <div className="ai-error">{aiError}</div>}</div><AiScanFigure compact status={aiStatus} /></div>
          <ReadyPrograms onApply={applyReadyProgram} />
          <div className="workout-layout"><div className="workout-main"><div className="section-title"><div><div className="eyebrow">BUGÜN</div><h2>Full body · {planLevel}</h2></div><button className="outline-btn" type="button">⋮</button></div><div className="workout-list">{workouts.map((workout, index) => { const guide = getMotionGuide(workout); return <article className="workout-card" key={workout.name}><ExerciseAnimation exercise={workout} compact /><div className="exercise-info"><div className="exercise-labels"><div className="pill">{workout.level}</div><span>{guide.action}</span></div><h3>{workout.name} <small>{workout.english}</small></h3><p>{workout.sets} · {workout.rest}</p><details className="how-to"><summary>3 adımda nasıl yapılır?</summary><ol className="mini-steps"><li>{guide.start}</li><li>{workout.instructions}</li><li>{guide.finish}</li></ol></details></div><button className="play-btn" type="button" aria-label={`${workout.name} hareket akışını ve sayacını aç`} onClick={() => openWorkout(index)}><span>▶</span><small>Aç</small></button></article>; })}</div><button className="start-btn" type="button" onClick={() => openWorkout(0)}>Antrenmana başla <span>→</span></button></div><aside className="coach-card"><div className="coach-top"><span className="spark">✦</span><span>FORM AI</span></div><h2>Bugün senden<br /><em>tek bir şey</em> istiyor:</h2><p>Hareketi mükemmel yapmak değil, devam etmek.</p><div className="coach-line" /><small>İyi antrenmanlar, {name || "Ece"}.</small></aside></div></>}
          </>}
        </section>
      )}
      <footer><span>form.ai · daha güçlü bir sen için</span><span>© 2024</span></footer>
    </main>
  );
}
