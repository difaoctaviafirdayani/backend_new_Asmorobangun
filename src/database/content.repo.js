// REPOSITORY KONTEN — artikel, pengumuman, galeri, FAQ, edukasi budaya (MySQL).
const { nanoid } = require("nanoid");
const { getPool } = require("./mysql");

function toIso(v) {
  return v instanceof Date ? v.toISOString() : v;
}

function toDate(v) {
  const d = new Date(v || Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

const SPECS = {
  articles: {
    cols: ["id", "slug", "title", "excerpt", "content", "image", "category", "author", "date", "featured"],
    dates: ["date"],
    bools: ["featured"],
    order: "`date` DESC",
  },
  announcements: {
    cols: ["id", "title", "body", "type", "color", "image", "date"],
    dates: ["date"],
    bools: [],
    order: "`date` DESC",
  },
  gallery: {
    cols: ["id", "title", "caption", "image", "date"],
    dates: ["date"],
    bools: [],
    order: "`date` DESC",
  },
  faqs: {
    cols: ["id", "question", "answer"],
    dates: [],
    bools: [],
    order: "seq ASC",
  },
};

function rowToObj(spec, row) {
  if (!row) return null;
  const out = {};
  for (const c of spec.cols) {
    let v = row[c];
    if (spec.dates.includes(c)) v = toIso(v);
    if (spec.bools.includes(c)) v = !!v;
    out[c] = v;
  }
  return out;
}

function toDbValue(spec, col, v) {
  if (spec.dates.includes(col)) return toDate(v);
  if (spec.bools.includes(col)) return v ? 1 : 0;
  return v === undefined ? null : v;
}

function makeRepo(table) {
  const spec = SPECS[table];
  const colList = spec.cols.map((c) => `\`${c}\``).join(", ");

  return {
    async list() {
      const [rows] = await getPool().query(`SELECT ${colList} FROM \`${table}\` ORDER BY ${spec.order}`);
      return rows.map((r) => rowToObj(spec, r));
    },

    async findById(id) {
      const [rows] = await getPool().query(`SELECT ${colList} FROM \`${table}\` WHERE id = ? LIMIT 1`, [id]);
      return rowToObj(spec, rows[0]);
    },

    async insert(obj) {
      const cols = spec.cols.filter((c) => obj[c] !== undefined);
      await getPool().query(
        `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(", ")})
         VALUES (${cols.map(() => "?").join(", ")})`,
        cols.map((c) => toDbValue(spec, c, obj[c]))
      );
      return this.findById(obj.id);
    },

    async patch(id, fields) {
      const cols = spec.cols.filter((c) => c !== "id" && fields[c] !== undefined);
      if (!cols.length) return;
      await getPool().query(
        `UPDATE \`${table}\` SET ${cols.map((c) => `\`${c}\` = ?`).join(", ")} WHERE id = ?`,
        [...cols.map((c) => toDbValue(spec, c, fields[c])), id]
      );
    },

    async remove(id) {
      await getPool().query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    },
  };
}

const articles = makeRepo("articles");
const announcements = makeRepo("announcements");
const gallery = makeRepo("gallery");
const faqs = makeRepo("faqs");

const culture = {
  async get() {
    const pool = getPool();
    const [[info]] = await pool.query("SELECT paragraph, updated_at FROM culture_info WHERE id = 1");
    const [tl] = await pool.query("SELECT id, `year`, `text` FROM culture_timeline ORDER BY seq ASC");
    return {
      timeline: tl.map((t) => ({ id: t.id, year: t.year, text: t.text })),
      paragraph: info ? info.paragraph : "",
      updatedAt: info ? toIso(info.updated_at) : null,
    };
  },

  async update({ timeline, paragraph }) {
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      if (typeof paragraph === "string") {
        await conn.query("UPDATE culture_info SET paragraph = ? WHERE id = 1", [paragraph]);
      }
      if (Array.isArray(timeline)) {
        await conn.query("DELETE FROM culture_timeline");
        for (const t of timeline) {
          await conn.query("INSERT INTO culture_timeline (id, `year`, `text`) VALUES (?, ?, ?)", [
            t.id || `tl-${nanoid(6)}`,
            String(t.year ?? ""),
            String(t.text ?? ""),
          ]);
        }
      }
      await conn.query("UPDATE culture_info SET updated_at = ? WHERE id = 1", [new Date()]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  async addTimeline({ year, text }) {
    const point = { id: `tl-${nanoid(6)}`, year, text };
    await getPool().query("INSERT INTO culture_timeline (id, `year`, `text`) VALUES (?, ?, ?)", [
      point.id,
      String(year),
      String(text),
    ]);
    return point;
  },

  async removeTimeline(id) {
    await getPool().query("DELETE FROM culture_timeline WHERE id = ?", [id]);
  },
};

const TABLE_OPTS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

async function init() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id       VARCHAR(30)  NOT NULL PRIMARY KEY,
      slug     VARCHAR(190) NOT NULL,
      title    VARCHAR(255) NOT NULL,
      excerpt  TEXT         NULL,
      content  MEDIUMTEXT   NOT NULL,
      image    VARCHAR(255) NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'Berita',
      author   VARCHAR(100) NULL,
      \`date\`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      featured TINYINT(1)   NOT NULL DEFAULT 0,
      UNIQUE KEY uq_articles_slug (slug),
      KEY idx_articles_date (\`date\`)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id     VARCHAR(30)  NOT NULL PRIMARY KEY,
      title  VARCHAR(255) NOT NULL,
      body   TEXT         NOT NULL,
      type   VARCHAR(100) NOT NULL DEFAULT 'Pengumuman',
      color  VARCHAR(30)  NOT NULL DEFAULT 'brown',
      image  VARCHAR(255) NULL,
      \`date\` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_announcements_date (\`date\`)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery (
      id      VARCHAR(30)  NOT NULL PRIMARY KEY,
      title   VARCHAR(255) NOT NULL,
      caption TEXT         NULL,
      image   VARCHAR(255) NOT NULL,
      \`date\`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_gallery_date (\`date\`)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS faqs (
      id       VARCHAR(30)  NOT NULL PRIMARY KEY,
      seq      INT          NOT NULL AUTO_INCREMENT,
      question VARCHAR(500) NOT NULL,
      answer   TEXT         NOT NULL,
      UNIQUE KEY uq_faqs_seq (seq)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS culture_info (
      id         TINYINT      NOT NULL PRIMARY KEY,
      paragraph  TEXT         NULL,
      updated_at DATETIME(3)  NULL
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS culture_timeline (
      id    VARCHAR(30)  NOT NULL PRIMARY KEY,
      seq   INT          NOT NULL AUTO_INCREMENT,
      \`year\` VARCHAR(100) NOT NULL,
      \`text\` TEXT         NOT NULL,
      UNIQUE KEY uq_timeline_seq (seq)
    ) ${TABLE_OPTS}`);

  await migrateFromJson();
}

async function isEmpty(table) {
  const [[{ total }]] = await getPool().query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return total === 0;
}

async function migrateFromJson() {
  let json = {};
  try {
    json = require("./db").readDB();
  } catch (e) {
    json = {};
  }

  const repos = { articles, announcements, gallery, faqs };
  for (const [table, repo] of Object.entries(repos)) {
    if (!(await isEmpty(table))) continue;
    let masuk = 0;
    for (const item of json[table] || []) {
      if (!item.id) continue;
      await repo.insert(item);
      masuk += 1;
    }
    if (masuk) console.log(`Migrasi ${table} dari db.json -> MySQL: ${masuk} data dipindahkan.`);
  }

  const info = json.cultureInfo || {};
  await getPool().query(
    "INSERT IGNORE INTO culture_info (id, paragraph, updated_at) VALUES (1, ?, ?)",
    [info.paragraph || "", info.updatedAt ? toDate(info.updatedAt) : null]
  );
  if ((await isEmpty("culture_timeline")) && Array.isArray(info.timeline) && info.timeline.length) {
    for (const t of info.timeline) {
      await getPool().query("INSERT INTO culture_timeline (id, `year`, `text`) VALUES (?, ?, ?)", [
        t.id || `tl-${nanoid(6)}`,
        String(t.year ?? ""),
        String(t.text ?? ""),
      ]);
    }
    console.log(`Migrasi culture_timeline dari db.json -> MySQL: ${info.timeline.length} data dipindahkan.`);
  }
}

module.exports = { init, articles, announcements, gallery, faqs, culture };