// =============================================================================
// KNOWLEDGE SERVICE — "perpustakaan" chatbot.
//   1) buildCorpus() : kumpulkan dokumen (tabel knowledge_docs + konten situs)
//   2) searchKnowledge() : cari potongan teks yang paling cocok dengan pertanyaan
// Kalau tidak ada potongan yang cocok, chatbot TIDAK boleh menjawab dari pengetahuannya sendiri.
// =============================================================================
import * as knowledgeModel from "../../models/knowledge.model";
import { articles, faqs, culture } from "../../database/content.repo";
import { facilities, topeng } from "../../database/layanan.repo";

export interface Passage {
  source: string; // judul dokumen asal
  text: string; // isi potongan (sudah diberi judul di depannya)
}

export interface Hit extends Passage {
  score: number; // 0..1 = seberapa banyak kata kunci pertanyaan ditemukan
}

const MAX_CHUNK = 700;
const CACHE_MS = 60 * 1000;

let cache: { at: number; passages: Passage[] } | null = null;
export const clearKnowledgeCache = (): void => {
  cache = null;
};

const stripHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

// Pecah teks panjang jadi potongan <= MAX_CHUNK karakter (per paragraf/kalimat).
function chunk(title: string, body: string): Passage[] {
  const paras = body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: Passage[] = [];
  let buf = "";
  const flush = (): void => {
    if (buf.trim()) out.push({ source: title, text: `${title}: ${buf.trim()}` });
    buf = "";
  };
  for (const para of paras) {
    const pieces = para.length > MAX_CHUNK ? para.match(new RegExp(`.{1,${MAX_CHUNK}}(\\s|$)`, "g")) || [para] : [para];
    for (const piece of pieces) {
      if (buf && buf.length + piece.length > MAX_CHUNK) flush();
      buf += (buf ? " " : "") + piece.trim();
    }
  }
  flush();
  return out;
}

const rupiah = (n: unknown): string => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export async function buildCorpus(force = false): Promise<Passage[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.passages;

  const passages: Passage[] = [];
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e: any) {
      console.error("Knowledge: gagal membaca sumber:", e.message);
      return fallback;
    }
  };

  // 1) Dokumen yang diunggah admin
  for (const d of await safe(() => knowledgeModel.list(true), [])) {
    passages.push(...chunk(d.title, d.content));
  }
  // 2) FAQ
  for (const f of await safe(() => faqs.list(), [] as any[])) {
    passages.push(...chunk(`FAQ: ${f.question}`, stripHtml(f.answer)));
  }
  // 3) Edukasi budaya (paragraf + timeline sejarah)
  const c = await safe(() => culture.get(), null);
  if (c) {
    passages.push(...chunk("Sejarah & budaya Asmorobangun", stripHtml(c.paragraph)));
    for (const t of c.timeline) passages.push(...chunk(`Sejarah tahun ${t.year}`, stripHtml(t.text)));
  }
  // 4) Artikel
  for (const a of await safe(() => articles.list(), [] as any[])) {
    passages.push(...chunk(`Artikel: ${a.title}`, stripHtml(`${a.excerpt || ""}\n${a.content || ""}`)));
  }
  // 5) Fasilitas / layanan
  for (const f of await safe(() => facilities.list(), [] as any[])) {
    const price = f.priceInfo || (f.price ? rupiah(f.price) : "");
    passages.push(...chunk(`Fasilitas: ${f.name}`, stripHtml(`${f.shortDesc || ""}\n${f.longDesc || ""}\n${price ? `Harga: ${price}` : ""}`)));
  }
  // 6) Katalog topeng
  for (const t of await safe(() => topeng.list(), [] as any[])) {
    passages.push(
      ...chunk(`Topeng: ${t.name}`, `Karakter ${t.character || "-"}, warna ${t.color || "-"}, harga ${rupiah(t.price)}, dibuat sesuai pesanan. ${stripHtml(t.desc)}`)
    );
  }

  cache = { at: Date.now(), passages };
  return passages;
}

// ----------------------------------------------------------------------------
// Pencarian kata kunci sederhana (tanpa layanan tambahan): bobot IDF + cakupan kata.
// ----------------------------------------------------------------------------
const STOPWORDS = new Set(
  ("yang dan di ke dari untuk dengan pada ini itu atau adalah apa apakah siapa kapan dimana mana bagaimana berapa kenapa mengapa " +
    "ada tidak bisa dapat akan sudah saya aku kamu anda kami kita dong ya nih sih deh lah kah tolong mohon minta tanya info " +
    "sanggar asmorobangun mau ingin boleh gimana gak nggak juga lebih sangat banyak").split(" ")
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(nya|lah|kah)$/, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export const MIN_COVERAGE = 0.34; // minimal sepertiga kata kunci bermakna harus ketemu di dokumen

export function searchPassages(query: string, passages: Passage[], limit = 4): Hit[] {
  const qTokens = Array.from(new Set(tokenize(query)));
  if (!qTokens.length || !passages.length) return [];

  const docTokens = passages.map((p) => new Set(tokenize(p.text)));
  const N = passages.length;
  const idf = new Map<string, number>();
  for (const q of qTokens) {
    const df = docTokens.filter((set) => set.has(q)).length;
    idf.set(q, Math.log(1 + (N - df + 0.5) / (df + 0.5)));
  }
  const total = qTokens.reduce((sum, q) => sum + (idf.get(q) || 0), 0) || 1;

  const hits: Hit[] = [];
  passages.forEach((p, i) => {
    const titleTokens = new Set(tokenize(p.source));
    let got = 0;
    for (const q of qTokens) {
      if (docTokens[i].has(q)) got += (idf.get(q) || 0) * (titleTokens.has(q) ? 1.25 : 1);
    }
    const score = Math.min(1, got / total);
    if (score >= MIN_COVERAGE) hits.push({ ...p, score });
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function searchKnowledge(query: string, limit = 4): Promise<Hit[]> {
  return searchPassages(query, await buildCorpus(), limit);
}