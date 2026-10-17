// REPOSITORY REGISTRASI — booking, pesanan topeng (+ chat), pengaturan pembayaran (MySQL).
const { getPool } = require("./mysql");
const { makeRepo, TABLE_OPTS, toIso, toDate } = require("./table");

// ---------------------------------------------------------------- booking
const bookings = makeRepo({
  table: "bookings",
  fields: {
    id: "id",
    facilityId: "facility_id",
    facilityName: "facility_name",
    bookingType: "booking_type",
    userId: "user_id",
    userName: "user_name",
    userEmail: "user_email",
    date: "date",
    notes: "notes",
    eventType: "event_type",
    location: "location",
    guestCount: "guest_count",
    paymentMethod: "payment_method",
    amount: "amount",
    proofFile: "proof_file",
    status: "status",
    createdAt: "created_at",
  },
  dates: ["createdAt"],
  nums: ["amount"],
  order: "created_at DESC",
});

// ---------------------------------------------------------------- pesanan topeng
const ordersBase = makeRepo({
  table: "topeng_orders",
  fields: {
    id: "id",
    topengId: "topeng_id",
    topengName: "topeng_name",
    topengImage: "topeng_image",
    userId: "user_id",
    userName: "user_name",
    buyerPhone: "buyer_phone",
    qty: "qty",
    unitPrice: "unit_price",
    total: "total",
    customName: "custom_name",
    customDesign: "custom_design",
    message: "message",
    paymentMethod: "payment_method",
    proofFile: "proof_file",
    status: "status",
    createdAt: "created_at",
  },
  dates: ["createdAt"],
  nums: ["qty", "unitPrice", "total"],
  order: "created_at DESC",
});

function chatOut(row) {
  return { from: row.sender, text: row.text, date: toIso(row.date) };
}

// tempelkan chatLog ke daftar pesanan (satu query untuk semua)
async function withChat(orders) {
  if (!orders.length) return orders;
  const [rows] = await getPool().query(
    "SELECT order_id, sender, `text`, `date` FROM topeng_order_chat WHERE order_id IN (?) ORDER BY id ASC",
    [orders.map((o) => o.id)]
  );
  const byOrder = {};
  for (const r of rows) (byOrder[r.order_id] = byOrder[r.order_id] || []).push(chatOut(r));
  return orders.map((o) => ({ ...o, chatLog: byOrder[o.id] || [] }));
}

const orders = {
  patch: ordersBase.patch,

  async findById(id) {
    const o = await ordersBase.findById(id);
    return o ? (await withChat([o]))[0] : null;
  },

  async list(opts) {
    return withChat(await ordersBase.list(opts));
  },

  listByUser(userId) {
    return this.list({ where: "user_id = ?", params: [userId] });
  },

  // pesanan + pesan chat awal disimpan sekaligus (transaksi)
  async create(order) {
    const { chatLog = [], ...fields } = order;
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await ordersBase.insert(fields, conn);
      for (const c of chatLog) {
        await conn.query("INSERT INTO topeng_order_chat (order_id, sender, `text`, `date`) VALUES (?, ?, ?, ?)", [
          order.id,
          c.from,
          c.text,
          toDate(c.date),
        ]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return this.findById(order.id);
  },

  async addChat(orderId, { from, text, date }) {
    await getPool().query("INSERT INTO topeng_order_chat (order_id, sender, `text`, `date`) VALUES (?, ?, ?, ?)", [
      orderId,
      from,
      text,
      toDate(date),
    ]);
  },
};

// ---------------------------------------------------------------- pengaturan pembayaran (1 baris)
const PAY_FIELDS = {
  bankName: "bank_name",
  accountNumber: "account_number",
  accountName: "account_name",
  qrisMerchantName: "qris_merchant_name",
  qrisImage: "qris_image",
  whatsapp: "whatsapp",
};

const paymentSettings = {
  async get() {
    const [[row]] = await getPool().query("SELECT * FROM payment_settings WHERE id = 1");
    const out = {};
    for (const [k, col] of Object.entries(PAY_FIELDS)) out[k] = row && row[col] != null ? row[col] : "";
    return out;
  },

  async update(changes) {
    const keys = Object.keys(PAY_FIELDS).filter((k) => changes[k] !== undefined);
    if (!keys.length) return;
    await getPool().query(
      `UPDATE payment_settings SET ${keys.map((k) => `\`${PAY_FIELDS[k]}\` = ?`).join(", ")} WHERE id = 1`,
      keys.map((k) => String(changes[k] ?? ""))
    );
  },
};

// ---------------------------------------------------------------- tabel & migrasi
async function init() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id            VARCHAR(30)  NOT NULL PRIMARY KEY,
      facility_id   VARCHAR(60)  NOT NULL,
      facility_name VARCHAR(255) NOT NULL,
      booking_type  VARCHAR(30)  NULL,
      user_id       VARCHAR(30)  NOT NULL,
      user_name     VARCHAR(100) NOT NULL,
      user_email    VARCHAR(190) NOT NULL,
      \`date\`        VARCHAR(100) NULL,
      notes         TEXT         NULL,
      event_type    VARCHAR(100) NULL,
      location      VARCHAR(255) NULL,
      guest_count   VARCHAR(50)  NULL,
      payment_method VARCHAR(20) NULL,
      amount        BIGINT       NULL,
      proof_file    VARCHAR(255) NULL,
      status        VARCHAR(40)  NOT NULL,
      created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_bookings_user (user_id),
      KEY idx_bookings_facility (facility_id),
      KEY idx_bookings_created (created_at)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS topeng_orders (
      id             VARCHAR(30)  NOT NULL PRIMARY KEY,
      topeng_id      VARCHAR(30)  NOT NULL,
      topeng_name    VARCHAR(255) NOT NULL,
      topeng_image   VARCHAR(255) NULL,
      user_id        VARCHAR(30)  NOT NULL,
      user_name      VARCHAR(100) NOT NULL,
      buyer_phone    VARCHAR(30)  NULL,
      qty            INT          NOT NULL DEFAULT 1,
      unit_price     BIGINT       NOT NULL,
      total          BIGINT       NOT NULL,
      custom_name    VARCHAR(255) NULL,
      custom_design  TEXT         NULL,
      message        TEXT         NULL,
      payment_method VARCHAR(20)  NULL,
      proof_file     VARCHAR(255) NULL,
      status         VARCHAR(40)  NOT NULL,
      created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_orders_user (user_id),
      KEY idx_orders_created (created_at)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS topeng_order_chat (
      id       INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(30)  NOT NULL,
      sender   VARCHAR(20)  NOT NULL,
      \`text\`   TEXT         NOT NULL,
      \`date\`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_chat_order (order_id),
      CONSTRAINT fk_chat_order FOREIGN KEY (order_id) REFERENCES topeng_orders (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id                 TINYINT      NOT NULL PRIMARY KEY,
      bank_name          VARCHAR(100) NULL,
      account_number     VARCHAR(60)  NULL,
      account_name       VARCHAR(150) NULL,
      qris_merchant_name VARCHAR(150) NULL,
      qris_image         MEDIUMTEXT   NULL,
      whatsapp           VARCHAR(30)  NULL
    ) ${TABLE_OPTS}`);

  await migrateFromJson();
}

async function migrateFromJson() {
  let json = {};
  try {
    json = require("./db").readDB();
  } catch (e) {
    return;
  }

  if (await bookings.isEmpty()) {
    let masuk = 0;
    for (const b of json.bookings || []) {
      if (!b.id) continue;
      await bookings.insert(b);
      masuk += 1;
    }
    if (masuk) console.log(`Migrasi bookings dari db.json -> MySQL: ${masuk} data dipindahkan.`);
  }

  if (await ordersBase.isEmpty()) {
    let masuk = 0;
    for (const o of json.topengOrders || []) {
      if (o.id) {
        await orders.create(o);
        masuk += 1;
      }
    }
    if (masuk) console.log(`Migrasi topengOrders dari db.json -> MySQL: ${masuk} data dipindahkan.`);
  }

  // baris pengaturan pembayaran: isi dari db.json hanya saat baris belum ada
  const s = json.paymentSettings || {};
  await pool_insertSettings(s);
}

async function pool_insertSettings(s) {
  await getPool().query(
    `INSERT IGNORE INTO payment_settings
       (id, bank_name, account_number, account_name, qris_merchant_name, qris_image, whatsapp)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
    [s.bankName || "", s.accountNumber || "", s.accountName || "", s.qrisMerchantName || "", s.qrisImage || "", s.whatsapp || ""]
  );
}

module.exports = { init, bookings, orders, paymentSettings };