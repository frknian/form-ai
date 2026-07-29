// form.ai Android ikon/splash üreticisi.
// Saf Node (zlib) ile PNG kodlar; harici bağımlılık veya tarayıcı gerektirmez,
// böylece varlıklar her makinede birebir aynı şekilde yeniden üretilebilir.
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const LIME = [0xd9, 0xf7, 0x6b];
const INK = [0x1d, 0x1d, 0x1b];
const PAPER = [0xf7, 0xf7, 0xf2];

function surface(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}
function blend(s, x, y, rgb, a) {
  if (a <= 0 || x < 0 || y < 0 || x >= s.w || y >= s.h) return;
  const i = (y * s.w + x) * 4;
  const dst = s.px[i + 3] / 255;
  const out = a + dst * (1 - a);
  for (let c = 0; c < 3; c += 1) s.px[i + c] = Math.round((rgb[c] * a + s.px[i + c] * dst * (1 - a)) / (out || 1));
  s.px[i + 3] = Math.round(out * 255);
}
const fill = (s, rgb) => { for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) blend(s, x, y, rgb, 1); };

// Kenar yumuşatma için 3x3 örnekleme; ok ve daire kenarları tırtıklı kalmasın.
function shade(s, test, rgb) {
  for (let y = 0; y < s.h; y += 1) {
    for (let x = 0; x < s.w; x += 1) {
      let hit = 0;
      for (let sy = 0; sy < 3; sy += 1) for (let sx = 0; sx < 3; sx += 1) if (test(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) hit += 1;
      if (hit) blend(s, x, y, rgb, hit / 9);
    }
  }
}
const inCircle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inRoundRect = (x0, y0, w, h, r) => (x, y) => {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
  const dx = Math.max(x0 + r - x, 0, x - (x0 + w - r));
  const dy = Math.max(y0 + r - y, 0, y - (y0 + h - r));
  return dx * dx + dy * dy <= r * r;
};
// Yuvarlak uçlu kalın çizgi = uç noktalara daire + gövdeye kapsül
const onSegment = (ax, ay, bx, by, half) => (x, y) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((x - ax) * dx + (y - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return (x - (ax + t * dx)) ** 2 + (y - (ay + t * dy)) ** 2 <= half * half;
};

// 108dp tuvaldeki marka oku; her boyuta ölçeklenir.
function drawArrow(s, size, offsetX = 0, offsetY = 0, rgb = INK) {
  const p = (v) => (v / 108) * size;
  const half = p(9) / 2;
  const seg = (ax, ay, bx, by) => shade(s, (x, y) => onSegment(p(ax) + offsetX, p(ay) + offsetY, p(bx) + offsetX, p(by) + offsetY, half)(x, y), rgb);
  seg(38, 70, 70, 38);
  seg(49, 37, 71, 37);
  seg(71, 37, 71, 59);
}

function encodePng(s) {
  const raw = Buffer.alloc((s.w * 4 + 1) * s.h);
  for (let y = 0; y < s.h; y += 1) {
    raw[y * (s.w * 4 + 1)] = 0;
    Buffer.from(s.px.buffer, y * s.w * 4, s.w * 4).copy(raw, y * (s.w * 4 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s.w, 0); ihdr.writeUInt32BE(s.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}
let table = null;
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function launcher(size, round) {
  const s = surface(size, size);
  shade(s, round ? inCircle(size / 2, size / 2, size / 2) : inRoundRect(0, 0, size, size, size * 0.22), LIME);
  drawArrow(s, size);
  return s;
}
function foreground(size) { const s = surface(size, size); drawArrow(s, size); return s; }
// Mağaza ikonu maskelenmez; adaptive ikonun 72dp güvenli alan kısıtı burada
// geçerli değil, bu yüzden ok tuvali daha çok doldursun diye büyütülüyor.
function storeIcon(size) {
  const s = surface(size, size);
  fill(s, LIME);
  const scale = 1.5;
  const box = size * scale;
  drawArrow(s, box, (size - box) / 2, (size - box) / 2);
  return s;
}
function splash(w, h) {
  const s = surface(w, h);
  fill(s, PAPER);
  const d = Math.min(w, h) * 0.22;
  const cx = (w - d) / 2, cy = (h - d) / 2;
  shade(s, inCircle(cx + d / 2, cy + d / 2, d / 2), LIME);
  drawArrow(s, d, cx, cy);
  return s;
}
// Play "feature graphic" için yalnızca marka işareti üretiyoruz. Saf Node'da
// yazı tipi rasterleme yok; başlık metni tasarım aracında eklenmeli.
function featureGraphic(w, h) {
  const s = surface(w, h);
  fill(s, INK);
  const d = h * 0.52;
  const cx = (w - d) / 2, cy = (h - d) / 2;
  shade(s, inCircle(cx + d / 2, cy + d / 2, d / 2), LIME);
  drawArrow(s, d, cx, cy);
  return s;
}

const jobs = [];
const densities = [["mdpi", 48, 108], ["hdpi", 72, 162], ["xhdpi", 96, 216], ["xxhdpi", 144, 324], ["xxxhdpi", 192, 432]];
for (const [d, icon, fg] of densities) {
  jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, launcher(icon, false)]);
  jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, launcher(icon, true)]);
  jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, foreground(fg)]);
}
for (const [d, w, h] of [["port-mdpi", 320, 480], ["port-hdpi", 480, 800], ["port-xhdpi", 720, 1280], ["port-xxhdpi", 960, 1600], ["port-xxxhdpi", 1280, 1920],
                         ["land-mdpi", 480, 320], ["land-hdpi", 800, 480], ["land-xhdpi", 1280, 720], ["land-xxhdpi", 1600, 960], ["land-xxxhdpi", 1920, 1280]]) {
  jobs.push([`android/app/src/main/res/drawable-${d}/splash.png`, splash(w, h)]);
}
jobs.push(["android/app/src/main/res/drawable/splash.png", splash(960, 1600)]);
jobs.push(["store-assets/play-icon-512.png", storeIcon(512)]);
jobs.push(["store-assets/feature-graphic-1024x500.png", featureGraphic(1024, 500)]);

for (const [path, s] of jobs) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, encodePng(s));
}
console.log(`${jobs.length} varlık üretildi.`);
