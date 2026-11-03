import type { Request, Response } from "express";
import { topeng } from "../../database/layanan.repo";
import { httpError } from "../../middleware/error";
import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from "../../config/env";
import { createLimiter, tooManyMessage } from "../../middleware/rateLimit";
import { prepareForPrompt } from "../../security/promptGuard";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Chatbot boleh dipakai tanpa login, jadi dibatasi per IP: maksimal 20 pesan / 10 menit.
const chatLimiter = createLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

// Asisten ini sengaja dibatasi pada SATU topik saja: Topeng Malangan
// (sejarah, tokoh/watak, bahan, proses ukir, warna & makna, perawatan, katalog & pemesanan custom).
// Hal lain (booking kelas, forum, artikel, dsb) ditangani menu lain di aplikasi.
const SYSTEM_CONTEXT = `Kamu adalah "Asisten Topeng", asisten virtual yang HANYA membahas Topeng Malangan
(topeng kayu khas Malang) di toko topeng milik Sanggar Asmorobangun, Dusun Kedungmonggo, Pakisaji, Malang.

Kamu boleh menjawab APAPUN yang berkaitan dengan topeng secara bebas dan mendalam, tanpa dibatasi, termasuk:
- Sejarah & filosofi Wayang Topeng Malangan
- Tokoh/karakter topeng (Panji, Klana, Bapang, Dewi Sekartaji, dsb), watak, dan makna warna/ekspresi wajahnya
- Bahan baku (jenis kayu seperti kayu waru/mentaos/sengon), proses pengukiran, pewarnaan, dan finishing
- Cara merawat topeng koleksi (dari kelembapan, rayap, retak, dsb) serta cara membersihkannya
- Perbedaan gaya topeng antar daerah/sanggar
- Produk yang dijual sanggar ini: nama, harga, dan watak (lihat data katalog di bawah). Semua topeng dibuat sesuai pesanan, jadi tidak ada stok.
- Proses pemesanan, termasuk request nama/desain custom pada topeng

Jika pengguna bertanya di luar topik topeng (misalnya soal jadwal kelas tari, karawitan, booking pentas,
forum, atau hal umum lain), jawab singkat bahwa asisten ini khusus membahas topeng saja, dan arahkan mereka
ke menu terkait di aplikasi (Fasilitas, Forum, dsb). Selalu jawab dalam Bahasa Indonesia, hangat, dan jelas.`;

async function catalogSummary(): Promise<string> {
  return (await topeng.list())
    .map((t) => `- ${t.name} (${t.character}, warna ${t.color}): Rp ${Number(t.price).toLocaleString("id-ID")}, dibuat sesuai pesanan`)
    .join("\n");
}

const OFF_TOPIC = /(kelas tari|karawitan|jadwal kelas|sewa kostum|panggilan tari|kunjungan edukasi|booking|daftar kelas|forum diskusi|login|register|artikel|berita sanggar)/i;

// Jawaban berbasis aturan supaya asisten tetap jalan tanpa konfigurasi / tanpa API key.
async function ruleBasedAnswer(message: string): Promise<string> {
  const m = message.toLowerCase();

  if (OFF_TOPIC.test(m)) {
    return "Asisten ini khusus membahas Topeng Malangan ya 🎭 — untuk kelas tari, karawitan, sewa kostum, atau booking pentas, silakan cek menu Fasilitas atau Forum Diskusi di aplikasi.";
  }
  if (/\b(halo|hai|hi|pagi|siang|sore|malam)\b/.test(m) && m.length < 20) {
    return "Halo! Aku Asisten Topeng 🎭 — siap bantu jawab apapun soal Topeng Malangan: sejarah, tokoh, bahan, cara merawat, sampai katalog topeng yang dijual di sini. Mau tanya apa?";
  }
  if (/(beli|pesan|pesen|order|harga|katalog)/.test(m)) {
    return `Katalog topeng yang tersedia saat ini:\n${await catalogSummary()}\n\nKamu juga bisa request nama/desain custom saat memesan lewat tombol "Pesan" di halaman ini.`;
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
export async function chat(req: Request, res: Response): Promise<void> {
  const message = String(req.body.message || "").trim();
  const { history } = req.body;
  if (!message) throw httpError(400, "Pesan tidak boleh kosong.");
  if (message.length > 1000) throw httpError(400, "Pesan terlalu panjang (maksimal 1000 karakter).");

  const ip = req.ip || "unknown";
  const wait = chatLimiter.blockedFor(ip);
  if (wait) throw httpError(429, tooManyMessage(wait));
  chatLimiter.fail(ip); // dipakai sebagai penghitung pemakaian

  // Pagar keamanan: deteksi prompt injection + samarkan data pribadi (HP, email, dll).
  const guarded = prepareForPrompt(message, { maxLen: 1000 });
  if (guarded.injection.flagged) {
    res.json({
      reply: "Maaf, pesan itu tidak bisa aku proses. Aku hanya bisa membantu seputar Topeng Malangan ya 🎭",
      mode: "blocked",
    });
    return;
  }

  if (!AI_API_KEY) {
    res.json({ reply: await ruleBasedAnswer(guarded.text), mode: "rule-based" });
    return;
  }

  try {
    const safeHistory: ChatMessage[] = (Array.isArray(history) ? history : [])
      .filter((h: any) => h && ["user", "assistant"].includes(h.role) && typeof h.content === "string")
      .slice(-10)
      .map((h: any) => ({ role: h.role as "user" | "assistant", prepared: prepareForPrompt(h.content, { maxLen: 1000 }) }))
      .filter((h) => !h.prepared.injection.flagged) // riwayat yang mengandung injection dibuang
      .map((h) => ({ role: h.role, content: h.prepared.text }));

    const messages: ChatMessage[] = [
      { role: "system", content: `${SYSTEM_CONTEXT}\n\nData katalog topeng saat ini:\n${await catalogSummary()}` },
      ...safeHistory,
      { role: "user", content: guarded.text },
    ];

    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: 500 }),
    });
    const data: any = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Respons AI kosong");
    res.json({ reply: text, mode: "openai-compatible" });
  } catch (err: any) {
    console.error("AI error:", err.message);
    res.json({ reply: await ruleBasedAnswer(guarded.text), mode: "rule-based-fallback" });
  }
}