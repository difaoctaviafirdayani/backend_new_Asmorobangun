// REPOSITORY FORUM — thread diskusi + balasan (MySQL).
import { getPool } from "./mysql";
import { makeRepo, TABLE_OPTS, toIso } from "./table";
import { readDB } from "./db";

type Row = Record<string, any>;

const threadsBase = makeRepo({
  table: "forum_threads",
  fields: {
    id: "id",
    category: "category",
    title: "title",
    userId: "user_id",
    userName: "user_name",
    content: "content",
    date: "date",
  },
  dates: ["date"],
  order: "`date` DESC",
});

const repliesBase = makeRepo({
  table: "forum_replies",
  fields: {
    id: "id",
    threadId: "thread_id",
    userId: "user_id",
    userName: "user_name",
    content: "content",
    date: "date",
  },
  dates: ["date"],
  order: "seq ASC",
});

const escapeLike = (s: unknown): string => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

// Bentuk balasan seperti di db.json (tanpa threadId)
function replyOut(r: Row): Row {
  const { threadId, ...rest } = r;
  return rest;
}

export const threads = {
  findById: threadsBase.findById,
  patch: threadsBase.patch,
  remove: threadsBase.remove, // balasan ikut terhapus (ON DELETE CASCADE)
  list: threadsBase.list,

  // Daftar ringkas untuk halaman forum (dengan jumlah balasan)
  async listSummary({ category, q }: { category?: string; q?: string } = {}): Promise<Row[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (category) {
      where.push("t.category = ?");
      params.push(category);
    }
    if (q) {
      where.push("(t.title LIKE ? OR t.content LIKE ?)");
      params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
    }
    const [rows] = await getPool().query(
      `SELECT t.id, t.category, t.title, t.user_name, t.\`date\`,
              (SELECT COUNT(*) FROM forum_replies r WHERE r.thread_id = t.id) AS reply_count
         FROM forum_threads t
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY t.\`date\` DESC`,
      params
    );
    return (rows as any[]).map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      userName: r.user_name,
      date: toIso(r.date),
      replyCount: Number(r.reply_count),
    }));
  },

  async categories(): Promise<string[]> {
    const [rows] = await getPool().query("SELECT DISTINCT category FROM forum_threads ORDER BY category");
    return (rows as any[]).map((r) => r.category);
  },

  // Thread lengkap beserta balasannya
  async getWithReplies(id: string): Promise<Row | null> {
    const thread = await threadsBase.findById(id);
    if (!thread) return null;
    const replies = await repliesBase.list({ where: "thread_id = ?", params: [id] });
    return { ...thread, replies: replies.map(replyOut) };
  },

  async create(thread: Row): Promise<Row | null> {
    await threadsBase.insert(thread);
    return this.getWithReplies(thread.id);
  },

  async addReply(threadId: string, reply: Row): Promise<Row> {
    await repliesBase.insert({ ...reply, threadId });
    return replyOut((await repliesBase.findById(reply.id)) as Row);
  },
};

export async function init(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id        VARCHAR(30)  NOT NULL PRIMARY KEY,
      category  VARCHAR(100) NOT NULL DEFAULT 'Diskusi Umum',
      title     VARCHAR(255) NOT NULL,
      user_id   VARCHAR(30)  NULL,
      user_name VARCHAR(100) NOT NULL,
      content   TEXT         NOT NULL,
      \`date\`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_forum_threads_date (\`date\`)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id        VARCHAR(30)  NOT NULL PRIMARY KEY,
      seq       INT          NOT NULL AUTO_INCREMENT,
      thread_id VARCHAR(30)  NOT NULL,
      user_id   VARCHAR(30)  NULL,
      user_name VARCHAR(100) NOT NULL,
      content   TEXT         NOT NULL,
      \`date\`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_forum_replies_seq (seq),
      KEY idx_forum_replies_thread (thread_id),
      CONSTRAINT fk_forum_replies_thread FOREIGN KEY (thread_id) REFERENCES forum_threads (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}`);

  await migrateFromJson();
}

async function migrateFromJson(): Promise<void> {
  if (!(await threadsBase.isEmpty())) return;
  let json: Record<string, any[]> = {};
  try {
    json = readDB();
  } catch {
    return;
  }
  let masuk = 0;
  for (const t of json.forumThreads || []) {
    if (!t.id) continue;
    await threadsBase.insert(t);
    for (const r of t.replies || []) {
      if (r.id) await repliesBase.insert({ ...r, threadId: t.id });
    }
    masuk += 1;
  }
  if (masuk) console.log(`Migrasi forum dari db.json -> MySQL: ${masuk} thread dipindahkan.`);
}