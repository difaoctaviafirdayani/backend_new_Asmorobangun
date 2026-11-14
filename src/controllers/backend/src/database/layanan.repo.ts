// REPOSITORY LAYANAN — fasilitas, ulasan, katalog topeng (MySQL).
import { getPool } from "./mysql";
import { makeRepo, TABLE_OPTS } from "./table";
import { readDB } from "./db";

export const facilities = makeRepo({
  table: "facilities",
  fields: {
    id: "id",
    name: "name",
    category: "category",
    shortDesc: "short_desc",
    longDesc: "long_desc",
    image: "image",
    priceInfo: "price_info",
    bookingType: "booking_type",
    requiresLogin: "requires_login",
    price: "price",
  },
  bools: ["requiresLogin"],
  nums: ["price"],
  order: "seq ASC",
  extra: "extra", // field tambahan (mis. paymentMethods) disimpan sebagai JSON
});

const reviewsBase = makeRepo({
  table: "reviews",
  fields: {
    id: "id",
    facilityId: "facility_id",
    userId: "user_id",
    userName: "user_name",
    rating: "rating",
    comment: "comment",
    date: "date",
    bookingId: "booking_id",
    image: "image",
  },
  dates: ["date"],
  nums: ["rating"],
  order: "`date` DESC",
});

export const reviews = {
  ...reviewsBase,
  listByFacility(facilityId: string) {
    return reviewsBase.list({ where: "facility_id = ?", params: [facilityId] });
  },
  async findByBooking(bookingId: string) {
    const rows = await reviewsBase.list({ where: "booking_id = ?", params: [bookingId] });
    return rows[0] || null;
  },
  listByBookings(bookingIds: string[]) {
    if (!bookingIds.length) return Promise.resolve([]);
    return reviewsBase.list({ where: "booking_id IN (?)", params: [bookingIds] });
  },
  // { [facilityId]: { count, avg } } — avg sudah dibulatkan 1 desimal
  async summary(): Promise<Record<string, { count: number; avg: number | null }>> {
    const [rows] = await getPool().query(
      "SELECT facility_id, COUNT(*) AS cnt, AVG(rating) AS avg_rating FROM reviews GROUP BY facility_id"
    );
    const out: Record<string, { count: number; avg: number | null }> = {};
    for (const r of rows as any[]) {
      out[r.facility_id] = { count: Number(r.cnt), avg: r.avg_rating ? Math.round(Number(r.avg_rating) * 10) / 10 : null };
    }
    return out;
  },
};

// Ulasan katalog topeng. Satu ulasan per pesanan (order_id unik), hanya untuk pesanan yang selesai.
const topengReviewsBase = makeRepo({
  table: "topeng_reviews",
  fields: {
    id: "id",
    topengId: "topeng_id",
    orderId: "order_id",
    userId: "user_id",
    userName: "user_name",
    rating: "rating",
    comment: "comment",
    image: "image",
    date: "date",
  },
  dates: ["date"],
  nums: ["rating"],
  order: "`date` DESC",
});

export const topengReviews = {
  ...topengReviewsBase,
  listByTopeng(topengId: string) {
    return topengReviewsBase.list({ where: "topeng_id = ?", params: [topengId] });
  },
  async findByOrder(orderId: string) {
    const rows = await topengReviewsBase.list({ where: "order_id = ?", params: [orderId] });
    return rows[0] || null;
  },
  listByOrders(orderIds: string[]) {
    if (!orderIds.length) return Promise.resolve([]);
    return topengReviewsBase.list({ where: "order_id IN (?)", params: [orderIds] });
  },
  async summaryOf(topengId: string): Promise<{ count: number; avg: number | null }> {
    const [[row]] = await getPool().query(
      "SELECT COUNT(*) AS cnt, AVG(rating) AS avg_rating FROM topeng_reviews WHERE topeng_id = ?",
      [topengId]
    );
    return { count: Number(row.cnt), avg: row.avg_rating ? Math.round(Number(row.avg_rating) * 10) / 10 : null };
  },
};

export const topeng = makeRepo({
  table: "topeng",
  fields: {
    id: "id",
    name: "name",
    character: "character",
    color: "color",
    price: "price",
    stock: "stock",
    image: "image",
    desc: "desc",
  },
  nums: ["price", "stock"],
  order: "seq ASC",
});

export async function init(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS facilities (
      id             VARCHAR(60)  NOT NULL PRIMARY KEY,
      seq            INT          NOT NULL AUTO_INCREMENT,
      name           VARCHAR(255) NOT NULL,
      category       VARCHAR(100) NULL,
      short_desc     TEXT         NULL,
      long_desc      MEDIUMTEXT   NULL,
      image          VARCHAR(255) NULL,
      price_info     TEXT         NULL,
      booking_type   VARCHAR(30)  NULL,
      requires_login TINYINT(1)   NOT NULL DEFAULT 0,
      price          INT          NULL,
      extra          LONGTEXT     NULL,
      UNIQUE KEY uq_facilities_seq (seq)
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id          VARCHAR(30)  NOT NULL PRIMARY KEY,
      facility_id VARCHAR(60)  NOT NULL,
      user_id     VARCHAR(30)  NULL,
      user_name   VARCHAR(100) NOT NULL,
      rating      TINYINT      NOT NULL,
      comment     TEXT         NOT NULL,
      \`date\`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_reviews_facility (facility_id),
      CONSTRAINT fk_reviews_facility FOREIGN KEY (facility_id) REFERENCES facilities (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS topeng (
      id          VARCHAR(30)  NOT NULL PRIMARY KEY,
      seq         INT          NOT NULL AUTO_INCREMENT,
      name        VARCHAR(255) NOT NULL,
      \`character\` VARCHAR(255) NULL,
      color       VARCHAR(100) NULL,
      price       INT          NOT NULL,
      stock       INT          NOT NULL DEFAULT 0,
      image       VARCHAR(255) NULL,
      \`desc\`      TEXT         NULL,
      UNIQUE KEY uq_topeng_seq (seq)
    ) ${TABLE_OPTS}`);

  // Kolom baru di tabel reviews (tautan ke booking + foto opsional). Aman dijalankan berulang.
  await addColumnIfMissing("reviews", "booking_id", "VARCHAR(30) NULL");
  await addColumnIfMissing("reviews", "image", "VARCHAR(255) NULL");
  try {
    await pool.query("ALTER TABLE reviews ADD UNIQUE KEY uq_reviews_booking (booking_id)");
  } catch (e: any) {
    if (e.code !== "ER_DUP_KEYNAME") throw e;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS topeng_reviews (
      id        VARCHAR(30)  NOT NULL PRIMARY KEY,
      topeng_id VARCHAR(30)  NOT NULL,
      order_id  VARCHAR(30)  NOT NULL,
      user_id   VARCHAR(30)  NULL,
      user_name VARCHAR(100) NOT NULL,
      rating    TINYINT      NOT NULL,
      comment   TEXT         NOT NULL,
      image     VARCHAR(255) NULL,
      \`date\`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_topeng_reviews_order (order_id),
      KEY idx_topeng_reviews_topeng (topeng_id)
    ) ${TABLE_OPTS}`);

  await migrateFromJson();
}

async function addColumnIfMissing(table: string, column: string, definition: string): Promise<void> {
  const [[row]] = await getPool().query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  if (Number(row.n) === 0) await getPool().query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function migrateFromJson(): Promise<void> {
  let json: Record<string, any[]> = {};
  try {
    json = readDB();
  } catch {
    return;
  }

  const jobs: Array<[string, ReturnType<typeof makeRepo>]> = [
    ["facilities", facilities],
    ["topeng", topeng],
    ["reviews", reviewsBase], // sesudah facilities (foreign key)
  ];
  for (const [key, repo] of jobs) {
    if (!(await repo.isEmpty())) continue;
    let masuk = 0;
    for (const item of json[key] || []) {
      if (!item.id) continue;
      if (key === "reviews" && !(await facilities.findById(item.facilityId))) continue; // ulasan yatim dilewati
      await repo.insert(item);
      masuk += 1;
    }
    if (masuk) console.log(`Migrasi ${key} dari db.json -> MySQL: ${masuk} data dipindahkan.`);
  }
}