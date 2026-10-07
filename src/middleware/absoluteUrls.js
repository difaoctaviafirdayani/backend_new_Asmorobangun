// ===========================================================================
// URL GAMBAR LENGKAP — untuk Flutter / HP.
// Secara default gambar dikirim relatif ("/uploads/site_images/a.png"). Itu cukup untuk
// Next.js (tinggal ditambah base URL), tapi Flutter butuh URL lengkap.
// Cara minta URL lengkap:  kirim header  X-Absolute-Urls: 1   (atau  ?absoluteUrls=1)
// atau set ABSOLUTE_URLS=true di .env.
// ===========================================================================
const { PUBLIC_URL, ABSOLUTE_URLS } = require("../config/env");

const PREFIXES = ["/uploads/", "/app/assets/"];

function absolutize(value, base) {
  if (typeof value === "string") {
    return PREFIXES.some((p) => value.startsWith(p)) ? base + value : value;
  }
  if (Array.isArray(value)) return value.map((v) => absolutize(v, base));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = absolutize(value[k], base);
    return out;
  }
  return value;
}

function absoluteUrls(req, res, next) {
  const wanted = ABSOLUTE_URLS || req.headers["x-absolute-urls"] === "1" || req.query.absoluteUrls === "1";
  if (!wanted) return next();
  const base = PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const original = res.json.bind(res);
  res.json = (body) => original(absolutize(body, base));
  next();
}

module.exports = { absoluteUrls };
