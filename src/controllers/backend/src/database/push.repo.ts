// =============================================================================
// REPOSITORY TOKEN PERANGKAT — tabel device_tokens (untuk push notification).
// Satu user bisa punya banyak perangkat. Token disimpan bersama hash SHA-256-nya
// supaya bisa dijadikan primary key yang pendek.
// =============================================================================
import { createHash } from "crypto";
import { getPool } from "./mysql";
import { TABLE_OPTS } from "./table";

const hash = (token: string): string => createHash("sha256").update(token).digest("hex");

export async function init(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS device_tokens (
      token_hash CHAR(64)     NOT NULL PRIMARY KEY,
      token      VARCHAR(512) NOT NULL,
      user_id    VARCHAR(30)  NOT NULL,
      platform   VARCHAR(20)  NOT NULL DEFAULT 'android',
      updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_device_tokens_user (user_id),
      CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}`);
}

// Simpan token. Kalau token sama dipakai akun lain (ganti akun di HP yang sama), pemiliknya diperbarui.
export async function saveToken(userId: string, token: string, platform: string): Promise<void> {
  await getPool().query(
    `INSERT INTO device_tokens (token_hash, token, user_id, platform, updated_at) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform), updated_at = VALUES(updated_at)`,
    [hash(token), token, userId, platform, new Date()]
  );
}

export async function removeToken(userId: string, token: string): Promise<void> {
  await getPool().query("DELETE FROM device_tokens WHERE token_hash = ? AND user_id = ?", [hash(token), userId]);
}

export async function tokensByUser(userId: string): Promise<string[]> {
  const [rows] = await getPool().query("SELECT token FROM device_tokens WHERE user_id = ?", [userId]);
  return rows.map((r: any) => r.token as string);
}

export async function removeTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  await getPool().query("DELETE FROM device_tokens WHERE token_hash IN (?)", [tokens.map(hash)]);
}