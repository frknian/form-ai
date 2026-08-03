// Öğün fotoğrafını GÖNDERMEDEN önce küçültür.
//
// Telefon kamerası 12 MP çekiyor: dosya 3–8 MB, base64'e çevrilince daha da
// büyük. Bu hâliyle üç ayrı yerde patlıyordu:
//   • sunucu 7 MB üstü base64'ü reddediyor ("Fotoğraf okunamadı veya çok büyük")
//   • mobil bağlantıda yükleme onlarca saniye sürüyor, ekran donmuş görünüyor
//   • karenin kurtarma kopyası localStorage kotasına (~5 MB) sığmıyor
// 1280 px kenar ve JPEG 0.72, analiz için fazlasıyla yeterli; sonuç birkaç yüz
// kilobayta iner.

export const MAX_PHOTO_EDGE = 1280;
/** Veri URL'si bu uzunluğu aşarsa daha sert sıkıştırılır. */
export const MAX_PHOTO_CHARS = 1_400_000;

/** En uzun kenarı `maxEdge`'e indiren, en-boy oranını koruyan ölçü. */
export function targetPhotoDimensions(width: number, height: number, maxEdge: number = MAX_PHOTO_EDGE) {
  // Tek kenarı bilinmeyen kare de kullanılamaz: 0 genişlikte tuval çizilemez.
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
  if (!safeWidth || !safeHeight) return null;
  const longest = Math.max(safeWidth, safeHeight);
  if (longest <= maxEdge) return { width: Math.round(safeWidth), height: Math.round(safeHeight) };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(safeWidth * scale)), height: Math.max(1, Math.round(safeHeight * scale)) };
}

function loadImage(source: Blob | string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(null); };
    image.src = objectUrl ?? (source as string);
  });
}

function draw(image: HTMLImageElement, maxEdge: number, quality: number): string | null {
  const size = targetPhotoDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
  if (!size) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, size.width, size.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl.startsWith("data:image/jpeg") ? dataUrl : null;
}

/**
 * Dosyayı ya da veri URL'sini küçültülmüş bir JPEG veri URL'sine çevirir.
 * Başarısız olursa null döner — çağıran özgün kareyle devam edebilsin.
 */
export async function compressFoodPhoto(source: Blob | string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const image = await loadImage(source);
    if (!image) return null;
    // Kademeli: önce normal, hâlâ büyükse daha sert. Tek adımda çok kısmak
    // küçük fotoğrafları gereksiz bozardı.
    for (const [edge, quality] of [[MAX_PHOTO_EDGE, 0.72], [MAX_PHOTO_EDGE, 0.55], [900, 0.5]] as const) {
      const dataUrl = draw(image, edge, quality);
      if (!dataUrl) return null;
      if (dataUrl.length <= MAX_PHOTO_CHARS) return dataUrl;
    }
    return draw(image, 720, 0.45);
  } catch {
    return null;
  }
}
