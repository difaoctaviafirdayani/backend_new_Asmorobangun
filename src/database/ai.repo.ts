// =============================================================================
// REPOSITORY HASIL AI — tabel ai_results (kategori "hasil AI" di kisi-kisi).
// Setiap keluaran AI disimpan sebagai JSON + status verifikasi admin.
// =============================================================================
import { getPool } from "./mysql";
import { TABLE_OPTS } from "./table";

export const AI_STATUSES = ["pending", "approved", "rejected", "blocked"] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

export interface AiResult {
  id: string;
  kind: string;
  sourceId: string;
  sourceTitle: string | null;
  model: string | null;
  output: unknown | null;
  status: AiStatus;
  blockedReason: string | null;
  adminNote: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface NewAiResult {
  id: string;
  kind: string;
  sourceId: string;
  sourceTitle: string | null;
  model: string | null;
  output: unknown | null;
  status: AiStatus;
  blockedReason?: string | null;
}

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

function parseOutput(text: unknown): unknown | null {
  if (typeof text !== "string" || !text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function rowToResult(r: any): AiResult {
  return {
    id: r.id,
    kind: r.kind,
    sourceId: r.source_id,
    sourceTitle: r.source_title,
    model: r.model,
    output: parseOutput(r.output_json),
    status: r.status,
    blockedReason: r.blocked_reason,
    adminNote: r.admin_note,
    verifiedBy: r.verified_by,
    verifiedAt: iso(r.verified_at),
    createdAt: iso(r.created_at) as string,
  };
}

export async function init(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS ai_results (
      id             VARCHAR(30)  NOT NULL PRIMARY KEY,
      kind           VARCHAR(30)  NOT NULL,
      source_id      VARCHAR(30)  NOT NULL,
      source_title   VARCHAR(255) NULL,
      model          VARCHAR(60)  NULL,
      output_json    LONGTEXT     NULL,
      status         ENUM('pending','approved','rejected','blocked') NOT NULL DEFAULT 'pending',
      blocked_reason VARCHAR(255) NULL,
      admin_note     VARCHAR(255) NULL,
      verified_by    VARCHAR(30)  NULL,
      verified_at    DATETIME(3)  NULL,
      created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_ai_status (status, created_at),
      KEY idx_ai_source (kind, source_id),
      CONSTRAINT fk_ai_verified_by FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL
    ) ${TABLE_OPTS}`);
}

export async function findById(id: string): Promise<AiResult | null> {
  const [rows] = await getPool().query("SELECT * FROM ai_results WHERE id = ? LIMIT 1", [id]);
  return rows[0] ? rowToResult(rows[0]) : null;
}

export async function create(r: NewAiResult): Promise<AiResult> {
  await getPool().query(
    `INSERT INTO ai_results (id, kind, source_id, source_title, model, output_json, status, blocked_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id,
      r.kind,
      r.sourceId,
      r.sourceTitle,
      r.model,
      r.output === null ? null : JSON.stringify(r.output),
      r.status,
      r.blockedReason ?? null,
    ]
  );
  return (await findById(r.id)) as AiResult;
}

export async function list(status?: string): Promise<AiResult[]> {
  const useFilter = !!status && (AI_STATUSES as readonly string[]).includes(status);
  const [rows] = await getPool().query(
    `SELECT * FROM ai_results ${useFilter ? "WHERE status = ?" : ""} ORDER BY created_at DESC LIMIT 200`,
    useFilter ? [status] : []
  );
  return rows.map(rowToResult);
}

export async function verify(
  id: string,
  data: { status: "approved" | "rejected"; adminId: string; note: string | null }
): Promise<AiResult | null> {
  await getPool().query(
    `UPDATE ai_results
        SET status = ?, verified_by = ?, verified_at = ?, admin_note = ?
      WHERE id = ? AND status = 'pending'`, // hanya yang masih pending yang bisa diverifikasi
    [data.status, data.adminId, new Date(), data.note, id]
  );
  return findById(id);
}