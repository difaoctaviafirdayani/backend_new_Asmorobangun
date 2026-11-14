// ===========================================================================
// CLOUD STORAGE (Cloudinary) — foto & file upload disimpan di cloud.
// Database cukup menyimpan URL-nya (https://res.cloudinary.com/...), lalu frontend
// menampilkannya lewat <img src={url}>.
// Kalau CLOUDINARY_* belum diisi di .env, upload otomatis jatuh ke MySQL (cara lama).
// ===========================================================================
import { v2 as cloudinary } from "cloudinary";
import { CLOUDINARY } from "../config/appConfig";

export const cloudEnabled: boolean = Boolean(CLOUDINARY.CLOUD_NAME && CLOUDINARY.API_KEY && CLOUDINARY.API_SECRET);

if (cloudEnabled) {
  cloudinary.config({
    cloud_name: CLOUDINARY.CLOUD_NAME,
    api_key: CLOUDINARY.API_KEY,
    api_secret: CLOUDINARY.API_SECRET,
    secure: true, // selalu https
  });
}

console.log(cloudEnabled ? "Cloudinary aktif: upload dikirim ke cloud." : "Cloudinary belum diatur: upload disimpan di MySQL.");

/**
 * Kirim file ke Cloudinary lalu kembalikan URL https-nya.
 * @param folder   subfolder (mis. "site_images", "payment_proof") -> jadi folder di Cloudinary
 * @param filename nama unik hasil upload.ts, mis. "1731234567-abc12345.jpg"
 * @param kind     jenis file hasil deteksi isi file (jpg/png/webp/gif/pdf)
 */
export function uploadToCloud(folder: string, filename: string, kind: string, buffer: Buffer): Promise<string> {
  const isPdf = kind === "pdf";
  const base = filename.replace(/\.[^.]+$/, "");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `asmorobangun/${folder}`,
        // gambar: Cloudinary menambah ekstensi sendiri. PDF disimpan "raw" jadi ekstensi harus ikut di nama.
        public_id: isPdf ? `${base}.pdf` : base,
        resource_type: isPdf ? "raw" : "image",
        overwrite: false,
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error("Cloudinary tidak mengembalikan hasil."));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
