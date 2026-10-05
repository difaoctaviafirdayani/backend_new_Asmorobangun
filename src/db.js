// Very small JSON-file "database". Good enough for a campus project / prototype.
// For production, swap this out for a real database (Postgres/MySQL/MongoDB).
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function readDB() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// naive in-process lock so concurrent writes in the same request cycle don't clobber each other
let queue = Promise.resolve();
function update(mutatorFn) {
  queue = queue.then(() => {
    const data = readDB();
    const result = mutatorFn(data);
    writeDB(data);
    return result;
  });
  return queue;
}

module.exports = { readDB, writeDB, update };
