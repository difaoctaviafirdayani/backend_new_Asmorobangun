import { nanoid } from "nanoid";
import { getPool } from "./mysql";
import { TABLE_OPTS, toIso } from "./table";

export type NotificationType = "announcement" | "article" | "order" | "payment_reminder" | "forum_reply";

export interface NewNotification {
  type: NotificationType;
  title: string;
  body?: string;
  refId?: string | null;
  refType?: string | null;
  dedupeKey?: string | null;
}

export async function init(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         VARCHAR(30)  NOT NULL PRIMARY KEY,
      user_id    VARCHAR(30)  NOT NULL,
      type       VARCHAR(30)  NOT NULL,
      title      VARCHAR(255) NOT NULL,
      body       TEXT         NULL,
      ref_id     VARCHAR(190) NULL,
      ref_type   VARCHAR(20)  NULL,
      dedupe_key VARCHAR(120) NULL,
      is_read    TINYINT(1)   NOT NULL DEFAULT 0,
      created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_notifications_dedupe (user_id, dedupe_key),
      KEY idx_notifications_user (user_id, created_at),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}`);
}

const clip = (s: string | undefined | null, n: number): string | null => (s == null ? null : String(s).slice(0, n));
export async function add(userId: string, n: NewNotification): Promise<boolean> {
  const [res] = await getPool().query(
    `INSERT IGNORE INTO notifications (id, user_id, type, title, body, ref_id, ref_type, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`nt-${nanoid(12)}`, userId, n.type, clip(n.title, 255), n.body ?? null, clip(n.refId, 190), clip(n.refType, 20), clip(n.dedupeKey, 120), new Date()]
  );
  return Number(res.affectedRows) > 0;
}

export async function broadcast(n: NewNotification): Promise<number> {
  const [res] = await getPool().query(
    `INSERT IGNORE INTO notifications (id, user_id, type, title, body, ref_id, ref_type, dedupe_key, created_at)
     SELECT CONCAT('nt-', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 26)), u.id, ?, ?, ?, ?, ?, ?, ?
       FROM users u WHERE u.role = 'member'`,
    [n.type, clip(n.title, 255), n.body ?? null, clip(n.refId, 190), clip(n.refType, 20), clip(n.dedupeKey, 120), new Date()]
  );
  return Number(res.affectedRows);
}

export async function listByUser(userId: string, limit = 50): Promise<Record<string, any>[]> {
  const [rows] = await getPool().query(
    `SELECT id, type, title, body, ref_id, ref_type, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    [userId, limit]
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body || "",
    date: toIso(r.created_at),
    read: !!r.is_read,
    refId: r.ref_id,
    refType: r.ref_type,
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  const [[row]] = await getPool().query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0", [userId]);
  return Number(row.n);
}

export async function markRead(userId: string, id: string): Promise<void> {
  await getPool().query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function markAllRead(userId: string): Promise<void> {
  await getPool().query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId]);
}
