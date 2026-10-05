const express = require("express");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const { category, q } = req.query;
  const db = readDB();
  let threads = [...db.forumThreads].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (category) threads = threads.filter((t) => t.category === category);
  if (q) {
    const needle = String(q).toLowerCase();
    threads = threads.filter((t) => t.title.toLowerCase().includes(needle) || t.content.toLowerCase().includes(needle));
  }
  const summary = threads.map((t) => ({
    id: t.id,
    category: t.category,
    title: t.title,
    userName: t.userName,
    date: t.date,
    replyCount: t.replies.length,
  }));
  res.json({ threads: summary });
});

router.get("/categories", (req, res) => {
  const db = readDB();
  const cats = [...new Set(db.forumThreads.map((t) => t.category))];
  res.json({ categories: cats.length ? cats : ["Diskusi Umum", "Kelas Tari", "Karawitan", "Topeng", "Acara & Booking"] });
});

router.get("/:id", (req, res) => {
  const db = readDB();
  const thread = db.forumThreads.find((t) => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: "Thread tidak ditemukan." });
  res.json({ thread });
});

router.post("/", requireAuth, async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Judul dan isi diskusi wajib diisi." });
  const thread = {
    id: `th-${nanoid(8)}`,
    category: category || "Diskusi Umum",
    title,
    userName: req.user.name,
    userId: req.user.id,
    content,
    date: new Date().toISOString(),
    replies: [],
  };
  await update((data) => data.forumThreads.push(thread));
  res.status(201).json({ thread });
});

router.post("/:id/replies", requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Balasan tidak boleh kosong." });
  const db = readDB();
  const thread = db.forumThreads.find((t) => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: "Thread tidak ditemukan." });
  const reply = { id: `r-${nanoid(8)}`, userName: req.user.name, userId: req.user.id, content, date: new Date().toISOString() };
  await update((data) => {
    data.forumThreads.find((t) => t.id === req.params.id).replies.push(reply);
  });
  res.status(201).json({ reply });
});

// PATCH /api/forum/:id (admin) - moderasi judul / kategori / isi diskusi
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const db = readDB();
  if (!db.forumThreads.find((t) => t.id === req.params.id)) return res.status(404).json({ error: "Thread tidak ditemukan." });
  const { title, content, category } = req.body;
  if ((title !== undefined && !String(title).trim()) || (content !== undefined && !String(content).trim())) {
    return res.status(400).json({ error: "Judul dan isi diskusi tidak boleh kosong." });
  }
  await update((data) => {
    const t = data.forumThreads.find((x) => x.id === req.params.id);
    if (title !== undefined) t.title = title;
    if (content !== undefined) t.content = content;
    if (category !== undefined) t.category = category;
  });
  res.json({ message: "Diskusi diperbarui." });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await update((data) => {
    data.forumThreads = data.forumThreads.filter((t) => t.id !== req.params.id);
  });
  res.json({ message: "Thread dihapus." });
});

module.exports = router;
