const { readDB } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { AI_API_KEY, AI_BASE_URL, AI_MODEL } = require("../../config/env");

// This assistant is intentionally scoped to ONE topic only: Topeng Malangan
// (the carved masks) — their history, characters/watak, materials, carving
// process, colors & symbolism, care/maintenance, collecting, and the
// sanggar's own catalog & custom-order process. It is deliberately NOT used
// for booking classes, forum questions, articles, etc. — those are handled
// elsewhere on the site. Within the topeng topic itself, it answers freely.
const SYSTEM_CONTEXT = `Kamu adalah "Asisten Topeng", asisten virtual yang HANYA membahas Topeng Malangan
(topeng kayu khas Malang) di toko topeng milik Sanggar Asmorobangun, Dusun Kedungmonggo, Pakisaji, Malang.

Kamu boleh menjawab APAPUN yang berkaitan dengan topeng secara bebas dan mendalam, tanpa dibatasi, termasuk:
- Sejarah & filosofi Wayang Topeng Malangan
- Tokoh/karakter topeng (Panji, Klana, Bapang, Dewi Sekartaji, dsb), watak, dan makna warna/ekspresi wajahnya
- Bahan baku (jenis kayu seperti kayu waru/mentaos/sengon), proses pengukiran, pewarnaan, dan finishing
- Cara merawat topeng koleksi (dari kelembapan, rayap, retak, dsb) serta cara membersihkannya
- Perbedaan gaya topeng antar daerah/sanggar
- Produk yang dijual sanggar ini: nama, harga, watak, dan stok (lihat data katalog di bawah)
- Proses pemesanan, termasuk request nama/desain custom pada topeng

Jika pengguna bertanya di luar topik topeng (misalnya soal jadwal kelas tari, karawitan, booking pentas,
forum, atau hal umum lain), jawab singkat bahwa asisten ini khusus membahas topeng saja, dan arahkan mereka
ke menu terkait di aplikasi (Fasilitas, Forum, dsb). Selalu jawab dalam Bahasa Indonesia, hangat, dan jelas.`;

function catalogSummary(db) {
  return db.topeng
    .map((t) => `- ${t.name} (${t.character}, warna ${t.color}): Rp ${Number(t.price).toLocaleString("id-ID")}, stok ${t.stock}`)
    .join("\n");
}

const OFF_TOPIC = /(kelas tari|karawitan|jadwal kelas|sewa kostum|panggilan tari|kunjungan edukasi|booking|daftar kelas|forum diskusi|login|register|artikel|berita sanggar)/i;

// Rule-based fallback so the assistant still works with zero configuration / no API key.
function ruleBasedAnswer(message) {
  const m = message.toLowerCase();
  const db = readDB();

  if (OFF_TOPIC.test(m)) {
    return "Asisten ini khusus membahas Topeng Malangan ya 🎭 — untuk kelas tari, karawitan, sewa kostum, atau booking pentas, silakan cek menu Fasilitas atau Forum Diskusi di aplikasi.";
  }
  if (/\b(halo|hai|hi|pagi|siang|sore|malam)\b/.test(m) && m.length < 20) {
    return "Halo! Aku Asisten Topeng 🎭 — siap bantu jawab apapun soal Topeng Malangan: sejarah, tokoh, bahan, cara merawat, sampai katalog topeng yang dijual di sini. Mau tanya apa?";
  }
  if (/(beli|pesan|pesen|order|harga|katalog)/.test(m)) {
    return `Katalog topeng yang tersedia saat ini:\n${catalogSummary(db)}\n\nKamu juga bisa request nama/desain custom saat memesan lewat tombol "Pesan" di halaman ini.`;
  }
  if (/(rawat|simpan|jamur|rayap|retak|bersih)/.test(m)) {
    return "Simpan topeng di tempat kering dan sejuk, hindari sinar matahari langsung supaya warnanya tidak pudar. Lap berkala dengan kain kering/lembut, dan beri kapur barus di lemari penyimpanan untuk mencegah rayap. Kalau ada retak kecil, sebaiknya dibawa ke pengrajin untuk direstorasi, jangan diberi lem sembarangan.";
  }
  if (/(bahan|kayu|ukir|proses|buat)/.test(m)) {
    return "Topeng Malangan umumnya diukir dari kayu waru, mentaos, atau sengon yang cukup lunak untuk diukir detail tapi cukup awet. Prosesnya: kayu dibentuk kasar → diukir detail wajah → dihaluskan → dilapisi dempul kayu tipis → dicat & di-finishing sesuai warna karakter tokohnya.";
  }
  if (/(panji)/.test(m)) {
    return "Topeng Panji melambangkan ksatria yang tenang, bijaksana, dan berbudi luhur — biasanya berwarna putih/dasar polos dengan ekspresi wajah halus dan mata sipit, mewakili kesempurnaan batin.";
  }
  if (/(klana)/.test(m)) {
    return "Topeng Klana biasanya menggambarkan tokoh antagonis yang berwatak keras, penuh amarah, dan berambisi — warnanya merah menyala dengan mata melotot dan kumis tebal.";
  }
  if (/(warna|makna warna)/.test(m)) {
    return "Warna pada topeng Malangan punya makna watak: putih/krem untuk tokoh halus & bijaksana, merah untuk watak keras/berani/pemarah, hitam untuk watak berwibawa/tegas, dan emas/kuning untuk tokoh bangsawan.";
  }
  if (/(custom|kustom|kustem|desain sendiri|request nama)/.test(m)) {
    return "Bisa banget! Saat memesan, centang opsi 'request nama/desain custom', lalu jelaskan warna, karakter, atau detail ukiran yang kamu inginkan. Admin sanggar akan lanjut diskusi detailnya lewat chat pesanan.";
  }
  return "Aku bisa bantu jawab apapun soal Topeng Malangan — sejarah, tokoh & wataknya, bahan & proses pembuatan, cara merawat, sampai katalog yang dijual di sini. Coba tanya lebih spesifik ya!";
}


// POST /api/ai/chat   body: { message, history? }
exports.chat = async (req, res) => {
  const message = String(req.body.message || "").trim();
  const { history } = req.body;
  if (!message) throw httpError(400, "Pesan tidak boleh kosong.");
  if (message.length > 1000) throw httpError(400, "Pesan terlalu panjang (maksimal 1000 karakter).");

  if (!AI_API_KEY) return res.json({ reply: ruleBasedAnswer(message), mode: "rule-based" });

  try {
    const safeHistory = (Array.isArray(history) ? history : [])
      .filter((h) => h && ["user", "assistant"].includes(h.role) && typeof h.content === "string")
      .slice(-10)
      .map((h) => ({ role: h.role, content: h.content.slice(0, 1000) }));
    const messages = [
      { role: "system", content: `${SYSTEM_CONTEXT}\n\nData katalog topeng saat ini:\n${catalogSummary(readDB())}` },
      ...safeHistory,
      { role: "user", content: message },
    ];
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: 500 }),
    });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(JSON.stringify(data));
    res.json({ reply: text, mode: "openai-compatible" });
  } catch (err) {
    console.error("AI error:", err.message);
    res.json({ reply: ruleBasedAnswer(message), mode: "rule-based-fallback" });
  }
};
