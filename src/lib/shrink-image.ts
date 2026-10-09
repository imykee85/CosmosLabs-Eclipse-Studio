// Phone photos are often 5 to 12 MB, but the host accepts about 4.5 MB per request. A larger picture is redrawn smaller
// as a JPEG in the browser (longest side 3000 px, quality lowered until it fits) before it is uploaded. Smaller pictures
// are sent untouched. Returns null when the browser cannot decode the file.
export const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;
export const PICK_LIMIT_BYTES = 25 * 1024 * 1024;

export async function shrinkToFit(file: File): Promise<File | null> {
  if (file.size <= UPLOAD_LIMIT_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); // a transparent PNG becomes white, not black
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.6, 0.9 - attempt * 0.07);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= UPLOAD_LIMIT_BYTES - 64 * 1024) { bitmap.close(); return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }); }
      scale *= 0.8;
    }
    bitmap.close();
    return null;
  } catch { return null; }
}
