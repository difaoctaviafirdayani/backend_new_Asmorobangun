// =============================================================================
// MODEL › DOKUMEN PENGETAHUAN — tabel knowledge_docs.
// Isi tabel ini adalah satu-satunya "buku" yang boleh dipakai chatbot untuk menjawab
// (ditambah konten situs: FAQ, edukasi budaya, artikel, fasilitas, katalog topeng).
// =============================================================================
import { getPool } from "../database/mysql";
import { TABLE_OPTS } from "../database/table";

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string | null;
  content: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeInput {
  title: string;
  category?: string | null;
  content: string;
  active?: boolean;
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v ?? ""));

function rowToDoc(r: any): KnowledgeDoc {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    content: r.content,
    active: !!r.active,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export async function init(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id         VARCHAR(30)  NOT NULL PRIMARY KEY,
      title      VARCHAR(150) NOT NULL,
      category   VARCHAR(60)  NULL,
      content    MEDIUMTEXT   NOT NULL,
      active     TINYINT(1)   NOT NULL DEFAULT 1,
      created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY idx_knowledge_active (active)
    ) ${TABLE_OPTS}`);
}

export async function list(onlyActive = false): Promise<KnowledgeDoc[]> {
  const [rows] = await getPool().query(
    `SELECT * FROM knowledge_docs ${onlyActive ? "WHERE active = 1" : ""} ORDER BY created_at DESC`
  );
  return (rows as any[]).map(rowToDoc);
}

export async function findById(id: string): Promise<KnowledgeDoc | null> {
  const [rows] = await getPool().query("SELECT * FROM knowledge_docs WHERE id = ? LIMIT 1", [id]);
  return rows[0] ? rowToDoc(rows[0]) : null;
}

export async function create(id: string, d: KnowledgeInput): Promise<KnowledgeDoc> {
  await getPool().query(
    "INSERT INTO knowledge_docs (id, title, category, content, active) VALUES (?, ?, ?, ?, ?)",
    [id, d.title, d.category ?? null, d.content, d.active === false ? 0 : 1]
  );
  return (await findById(id)) as KnowledgeDoc;
}

export async function update(id: string, d: Partial<KnowledgeInput>): Promise<KnowledgeDoc | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (d.title !== undefined) (sets.push("title = ?"), values.push(d.title));
  if (d.category !== undefined) (sets.push("category = ?"), values.push(d.category));
  if (d.content !== undefined) (sets.push("content = ?"), values.push(d.content));
  if (d.active !== undefined) (sets.push("active = ?"), values.push(d.active ? 1 : 0));
  if (sets.length) await getPool().query(`UPDATE knowledge_docs SET ${sets.join(", ")} WHERE id = ?`, [...values, id]);
  return findById(id);
}

export async function remove(id: string): Promise<void> {
  await getPool().query("DELETE FROM knowledge_docs WHERE id = ?", [id]);
}