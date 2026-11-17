// Isi galeri dengan 500 foto contoh untuk uji beban. Hanya jalan di APP_ENV=development.
// Isi:    npm run seed:gallery
// Hapus:  npm run seed:gallery -- --clean
import fs from "fs";
import path from "path";
import { assertDevOnly } from "../src/config/appConfig";
import { initMysql, getPool } from "../src/database/mysql";
import * as media from "../src/database/media.repo";
import { gallery } from "../src/database/content.repo";

assertDevOnly("seed galeri 500 foto");

const TOTAL = 500;
const DIR = path.join(__dirname, "..", "uploads", "site_images");

async function main(): Promise<void> {
  await initMysql();

  if (process.argv.includes("--clean")) {
    await getPool().query("DELETE FROM gallery WHERE id LIKE 'gal-seed-%'");
    await getPool().query("DELETE FROM media_files WHERE folder = 'site_images' AND filename LIKE 'seed-%'");
    console.log("Data contoh dihapus.");
    process.exit(0);
  }

  // Pakai foto kecil saja (<= 500 KB) supaya database tidak membengkak.
  const sources = fs
    .readdirSync(DIR)
    .filter((f) => !f.startsWith(".") && !f.startsWith("seed-"))
    .map((f) => path.join(DIR, f))
    .filter((f) => fs.statSync(f).size <= 500 * 1024);
  if (!sources.length) {
    console.error("Tidak ada foto kecil di uploads/site_images untuk dijadikan contoh.");
    process.exit(1);
  }

  let baru = 0;
  for (let i = 0; i < TOTAL; i++) {
    const n = String(i + 1).padStart(4, "0");
    const id = `gal-seed-${n}`;
    if (await gallery.findById(id)) continue;
    const src = sources[i % sources.length];
    const filename = `seed-${n}${path.extname(src).toLowerCase()}`;
    await media.save("site_images", filename, fs.readFileSync(src));
    await gallery.insert({
      id,
      title: `Foto Contoh ${i + 1}`,
      caption: "Data uji beban, aman dihapus.",
      image: `/uploads/site_images/${filename}`,
      date: new Date(Date.now() - i * 60000).toISOString(),
    });
    baru++;
  }
  console.log(`Selesai: ${baru} foto contoh ditambahkan (total target ${TOTAL}).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});