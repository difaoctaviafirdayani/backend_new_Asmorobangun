import { getPool } from "./mysql";
import { TABLE_OPTS } from "./table";
import { facilities } from "./layanan.repo";
import { SERVICE_PRESETS } from "../config/rules";

interface Migration {
  name: string;
  run: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: "2026-11-revisi-status-kategori-harga",
    async run() {
      const pool = getPool();

      await pool.query(
        "UPDATE topeng_orders SET status = 'menunggu_pembayaran' WHERE status = 'menunggu_konfirmasi_admin'",
      );
      await pool.query(
        "UPDATE topeng_orders SET status = 'diproses' WHERE status = 'dikonfirmasi'",
      );
      await pool.query(
        "UPDATE topeng_orders SET status = 'dibatalkan' WHERE status = 'ditolak'",
      );

      await pool.query(
        "UPDATE bookings SET status = 'menunggu_pembayaran' WHERE status = 'menunggu_konfirmasi_admin'",
      );
      await pool.query(
        "UPDATE bookings SET status = 'menunggu_kedatangan' WHERE status = 'dikonfirmasi'",
      );
      await pool.query(
        "UPDATE bookings SET status = 'dibatalkan' WHERE status = 'ditolak'",
      );

      await pool.query(
        "UPDATE topeng_orders SET created_at = ? WHERE status = 'menunggu_pembayaran' AND (proof_file IS NULL OR proof_file = '')",
        [new Date()],
      );
      await pool.query(
        "UPDATE bookings SET created_at = ? WHERE status = 'menunggu_pembayaran' AND (proof_file IS NULL OR proof_file = '')",
        [new Date()],
      );

      await pool.query(
        "UPDATE forum_threads SET category = 'Umum' WHERE category IN ('Diskusi Umum', 'Umum')",
      );
      await pool.query(
        "UPDATE forum_threads SET category = 'Layanan' WHERE category NOT IN ('Umum', 'Layanan')",
      );
      await pool.query(
        "ALTER TABLE forum_threads ALTER COLUMN category SET DEFAULT 'Umum'",
      );

      await pool.query(
        "UPDATE announcements SET type = 'Layanan' WHERE LOWER(type) LIKE '%layanan%' OR LOWER(type) LIKE '%pendaftaran%' OR LOWER(type) LIKE '%kelas%'",
      );
      await pool.query(
        "UPDATE announcements SET type = 'Umum' WHERE type <> 'Layanan'",
      );
      await pool.query(
        "ALTER TABLE announcements ALTER COLUMN type SET DEFAULT 'Umum'",
      );

      await pool.query(
        "UPDATE articles SET category = 'Budaya' WHERE category NOT IN ('Budaya', 'Sejarah', 'Pencapaian')",
      );
      await pool.query(
        "ALTER TABLE articles ALTER COLUMN category SET DEFAULT 'Budaya'",
      );

      for (const [id, preset] of Object.entries(SERVICE_PRESETS)) {
        if (!(await facilities.findById(id))) continue;
        const changes: Record<string, unknown> = {
          price: preset.price,
          priceInfo: preset.priceInfo,
        };
        if (preset.availableDays) changes.availableDays = preset.availableDays;
        await facilities.patch(id, changes);
      }
    },
  },
];

export async function runDataMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(120) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ${TABLE_OPTS}`);

  for (const m of MIGRATIONS) {
    const [rows] = await pool.query(
      "SELECT name FROM schema_migrations WHERE name = ?",
      [m.name],
    );
    if ((rows as unknown[]).length) continue;
    await m.run();
    await pool.query("INSERT INTO schema_migrations (name) VALUES (?)", [
      m.name,
    ]);
    console.log(`Migrasi data dijalankan: ${m.name}`);
  }
}
