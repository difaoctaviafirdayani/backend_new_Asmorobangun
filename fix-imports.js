const fs = require("fs");
const path = require("path");

const ENV = new Set(["NODE_ENV","PORT","HOST","JWT_SECRET","JWT_IS_DEFAULT","JWT_EXPIRES_IN","DB","CORS_ORIGINS","PUBLIC_URL","ABSOLUTE_URLS","GEMINI_API_KEY","GEMINI_MODEL","CLOUDINARY","FIREBASE_SERVICE_ACCOUNT","AI_API_KEY","AI_BASE_URL","AI_MODEL"]);
const RULES = new Set(["TOPENG_STATUS","BOOKING_STATUS","ARTICLE_CATEGORIES","ANNOUNCEMENT_CATEGORIES","FORUM_CATEGORIES","PAYMENT_WINDOW_HOURS","PAYMENT_REMINDER_AFTER_HOURS","MAX_REVIEW_IMAGES","SERVICE_PRESETS","dayLabel","pickCategory","exactCategory","todayJakarta","weekdayOf","parseDays"]);

const root = path.join(process.cwd(), "src");
const re = /(import\s+(?:type\s+)?\{)([^}]*)(\}\s*from\s*["'])((?:\.\.?\/)+config\/)(env|rules)(["'])/g;
let changed = 0, problems = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== "node_modules") walk(p); }
    else if (f.name.endsWith(".ts")) fix(p);
  }
}

function fix(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = src.replace(re, (m, a, names, b, prefix, target, q) => {
    const list = names.split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean);
    const inEnv = list.every((n) => ENV.has(n));
    const inRules = list.every((n) => RULES.has(n));
    let want = target;
    if (inEnv && !inRules) want = "env";
    else if (inRules && !inEnv) want = "rules";
    else problems.push(`${path.relative(process.cwd(), file)}: nama campur atau tidak dikenal (${list.join(", ")})`);
    if (want !== target) { changed++; console.log(`betulkan ${path.relative(process.cwd(), file)}: config/${target} -> config/${want}`); }
    return a + names + b + prefix + want + q;
  });
  if (out !== src) fs.writeFileSync(file, out);
}

walk(root);
console.log(`\nSelesai. ${changed} import diperbaiki.`);
if (problems.length) { console.log("\nPerlu dicek manual:"); problems.forEach((p) => console.log(" - " + p)); }