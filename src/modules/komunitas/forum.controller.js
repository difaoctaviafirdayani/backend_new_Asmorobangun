const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { sortNewest, lower } = require("../../utils/helpers");

const DEFAULT_CATEGORIES = ["Diskusi Umum", "Kelas Tari", "Karawitan", "Topeng", "Acara & Booking"];

exports.list = (req, res) => {
  const { category, q } = req.query;
  let threads = sortNewest(readDB().forumThreads);
  if (category) threads = threads.filter((t) => t.category === category);
  if (q) {
    const needle = lower(q);
    threads = threads.filter((t) => lower(t.title).includes(needle) || lower(t.content).includes(needle));
  }
  res.json({
    threads: threads.map((t) => ({
      id: t.id,
      category: t.category,
      title: t.title,
      userName: t.userName,
      date: t.date,
      replyCount: (t.replies || []).length,
    })),
  });
};

exports.categories = (req, res) => {
  const cats = [...new Set(readDB().forumThreads.map((t) => t.category))];
  res.json({ categories: cats.length ? cats : DEFAULT_CATEGORIES });
};

exports.getOne = (req, res) => {
  const thread = readDB().forumThreads.find((t) => t.id === req.params.id);
  if (!thread) throw httpError(404, "Thread tidak ditemukan.");
  res.json({ thread });
};

exports.create = async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content || !String(title).trim() || !String(content).trim()) {
    throw httpError(400, "Judul dan isi diskusi wajib diisi.");
  }
  const thread = {
    id: `th-${nanoid(8)}`,
    category: category || "Diskusi Umum",
    title: String(title).trim(),
    userName: req.user.name,
    userId: req.user.id,
    content: String(content).trim(),
    date: new Date().toISOString(),
    replies: [],
  };
  await update((data) => data.forumThreads.push(thread));
  res.status(201).json({ thread });
};

exports.reply = async (req, res) => {
  const content = String(req.body.content || "").trim();
  if (!content) throw httpError(400, "Balasan tidak boleh kosong.");
  if (!readDB().forumThreads.find((t) => t.id === req.params.id)) throw httpError(404, "Thread tidak ditemukan.");
  const reply = { id: `r-${nanoid(8)}`, userName: req.user.name, userId: req.user.id, content, date: new Date().toISOString() };
  await update((data) => {
    const t = data.forumThreads.find((x) => x.id === req.params.id);
    t.replies = t.replies || [];
    t.replies.push(reply);
  });
  res.status(201).json({ reply });
};

exports.update = async (req, res) => {
  if (!readDB().forumThreads.find((t) => t.id === req.params.id)) throw httpError(404, "Thread tidak ditemukan.");
  const { title, content, category } = req.body;
  if ((title !== undefined && !String(title).trim()) || (content !== undefined && !String(content).trim())) {
    throw httpError(400, "Judul dan isi diskusi tidak boleh kosong.");
  }
  await update((data) => {
    const t = data.forumThreads.find((x) => x.id === req.params.id);
    if (title !== undefined) t.title = title;
    if (content !== undefined) t.content = content;
    if (category !== undefined) t.category = category;
  });
  res.json({ message: "Diskusi diperbarui." });
};

exports.remove = async (req, res) => {
  await update((data) => {
    data.forumThreads = data.forumThreads.filter((t) => t.id !== req.params.id);
  });
  res.json({ message: "Thread dihapus." });
};
