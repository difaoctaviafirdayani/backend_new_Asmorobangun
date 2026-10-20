// ===========================================================================
// TABLE HELPER — pembuat repository CRUD sederhana untuk satu tabel MySQL.
// Dipakai oleh layanan.repo.js, registrasi.repo.js, dan forum.repo.js.
// Objek yang keluar/masuk tetap berbentuk camelCase seperti dulu di db.json,
// jadi controller & frontend tidak perlu tahu nama kolom di database.
// ===========================================================================
const { getPool } = require("./mysql");

const TABLE_OPTS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

function toIso(v) {
  return v instanceof Date ? v.toISOString() : v;
}

function toDate(v) {
  const d = new Date(v || Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

const q = (name) => `\`${name}\``;

/**
 * spec:
 *  table   nama tabel
 *  fields  { namaCamel: "nama_kolom" }  (wajib ada id)
 *  dates   daftar field bertipe tanggal (dikirim sebagai ISO string)
 *  bools   daftar field boolean (TINYINT)
 *  nums    daftar field angka (dipaksa Number saat disimpan)
 *  order   ORDER BY default, mis. "`date` DESC" atau "seq ASC"
 *  extra   (opsional) nama kolom LONGTEXT berisi JSON untuk field di luar `fields`
 */
function makeRepo(spec) {
  const { table, fields, dates = [], bools = [], nums = [], order = "", extra = null } = spec;
  const keys = Object.keys(fields);
  const selectList = [...keys.map((k) => `${q(fields[k])} AS ${q(k)}`), ...(extra ? [q(extra)] : [])].join(", ");

  function rowToObj(row) {
    if (!row) return null;
    const out = {};
    for (const k of keys) {
      let v = row[k];
      if (dates.includes(k)) v = toIso(v);
      if (bools.includes(k)) v = !!v;
      out[k] = v;
    }
    if (extra && row[extra]) {
      try {
        const more = typeof row[extra] === "string" ? JSON.parse(row[extra]) : row[extra];
        Object.assign(out, more);
      } catch (e) {
        /* abaikan JSON rusak */
      }
    }
    return out;
  }

  function toDbValue(k, v) {
    if (v === undefined) return null;
    if (dates.includes(k)) return toDate(v);
    if (bools.includes(k)) return v ? 1 : 0;
    if (nums.includes(k)) return v === null || v === "" ? null : Number(v);
    return v;
  }

  // pisahkan field dikenal (kolom) dan tidak dikenal (masuk kolom extra)
  function split(obj) {
    const known = {};
    const rest = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (v === undefined) continue;
      if (keys.includes(k)) known[k] = v;
      else if (extra) rest[k] = v;
    }
    return { known, rest };
  }

  const repo = {
    spec,
    rowToObj,

    async list({ where = "", params = [], orderBy = order } = {}) {
      const sql = `SELECT ${selectList} FROM ${q(table)} ${where ? `WHERE ${where}` : ""} ${orderBy ? `ORDER BY ${orderBy}` : ""}`;
      const [rows] = await getPool().query(sql, params);
      return rows.map(rowToObj);
    },

    async findById(id) {
      const [rows] = await getPool().query(`SELECT ${selectList} FROM ${q(table)} WHERE ${q(fields.id)} = ? LIMIT 1`, [id]);
      return rowToObj(rows[0]);
    },

    async insert(obj, conn = getPool()) {
      const { known, rest } = split(obj);
      const cols = Object.keys(known);
      const names = cols.map((k) => q(fields[k]));
      const values = cols.map((k) => toDbValue(k, known[k]));
      if (extra && Object.keys(rest).length) {
        names.push(q(extra));
        values.push(JSON.stringify(rest));
      }
      await conn.query(
        `INSERT INTO ${q(table)} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
        values
      );
    },

    async patch(id, changes) {
      const { known, rest } = split(changes);
      delete known.id;
      const sets = Object.keys(known).map((k) => `${q(fields[k])} = ?`);
      const values = Object.keys(known).map((k) => toDbValue(k, known[k]));

      if (extra && Object.keys(rest).length) {
        const current = await repo.findById(id);
        if (!current) return;
        const merged = {};
        for (const k of Object.keys(current)) if (!keys.includes(k)) merged[k] = current[k];
        Object.assign(merged, rest);
        sets.push(`${q(extra)} = ?`);
        values.push(JSON.stringify(merged));
      }
      if (!sets.length) return;
      await getPool().query(`UPDATE ${q(table)} SET ${sets.join(", ")} WHERE ${q(fields.id)} = ?`, [...values, id]);
    },

    async remove(id) {
      await getPool().query(`DELETE FROM ${q(table)} WHERE ${q(fields.id)} = ?`, [id]);
    },

    async count() {
      const [[{ total }]] = await getPool().query(`SELECT COUNT(*) AS total FROM ${q(table)}`);
      return total;
    },

    async isEmpty() {
      return (await repo.count()) === 0;
    },
  };
  return repo;
}

module.exports = { makeRepo, toIso, toDate, TABLE_OPTS };