// REPOSITORY LAYANAN — fasilitas, ulasan, katalog topeng (MySQL).
const { getPool } = require("./mysql");
const { makeRepo, TABLE_OPTS } = require("./table");

const facilities = makeRepo({
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
  },
  dates: ["date"],
  nums: ["rating"],
  order: "`date` DESC",
});

const reviews = {
  ...reviewsBase,
  listByFacility(facilityId) {
    return reviewsBase.list({ where: "facility_id = ?", params: [facilityId] });
  },
  // { [facilityId]: { count, avg } } — avg sudah dibulatkan 1 desimal
  async summary() {
    const [rows] = await getPool().query(
      "SELECT facility_id, COUNT(*) AS cnt, AVG(rating) AS avg_rating FROM reviews GROUP BY facility_id"
    );
    const out = {};
    for (const r of rows) {
      out[r.facility_id] = { count: Number(r.cnt), avg: r.avg_rating ? Math.round(Number(r.avg_rating) * 10) / 10 : null };
    }
    return out;
  },
};

const topeng = makeRepo({
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

async function init() {
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

  await migrateFromJson();
}

async function migrateFromJson() {
  let json = {};
  try {
    json = require("./db").readDB();
  } catch (e) {
    return;
  }

  const jobs = [
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

module.exports = { init, facilities, reviews, topeng };