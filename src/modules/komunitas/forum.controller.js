// ===========================================================================
// KOMUNITAS › FORUM — sekarang membaca/menulis ke MySQL (lewat forum.repo.js),
// bukan lagi ke data/db.json.
// ===========================================================================
const { nanoid } = require("nanoid");
const { threads } = require("../../database/forum.repo");
const { httpError } = require("../../middleware/error");

const DEFAULT_CATEGORIES = ["Diskusi Umum", "Kelas Tari", "Karawitan", "Topeng", "Acara & Booking"];

// GET /api/forum?category=&q=
exports.list = async (req, res) => {
  const { category, q } = req.query;
  res.json({ threads: await threads.listSummary({ category, q }) });
};

// GET /api/forum/categories
exports.categories = async (req, res) => {
  const cats = await threads.categories();
  res.json({ categories: cats.length ? cats : DEFAULT_CATEGORIES });
};

// GET /api/forum/:id
exports.getOne = async (req, res) => {
  const thread = await threads.getWithReplies(req.params.id);
  if (!thread) throw httpError(404, "Thread tidak ditemukan.");
  res.json({ thread });
};

// POST /api/forum
exports.create = async (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content || !String(title).trim() || !String(content).trim()) {
    throw httpError(400, "Judul dan isi diskusi wajib diisi.");
  }
  const thread = await threads.create({
    id: `th-${nanoid(8)}`,
    category: category || "Diskusi Umum",
    title: String(title).trim(),
    userName: req.user.name,
    userId: req.user.id,
    content: String(content).trim(),
    date: new Date().toISOString(),
  });
  res.status(201).json({ thread });
};

// POST /api/forum/:id/replies
exports.reply = async (req, res) => {
  const content = String(req.body.content || "").trim();
  if (!content) throw httpError(400, "Balasan tidak boleh kosong.");
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Thread tidak ditemukan.");
  const reply = await threads.addReply(req.params.id, {
    id: `r-${nanoid(8)}`,
    userName: req.user.name,
    userId: req.user.id,
    content,
    date: new Date().toISOString(),
  });
  res.status(201).json({ reply });
};

// PATCH /api/forum/:id   (admin)
exports.update = async (req, res) => {
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Thread tidak ditemukan.");
  const { title, content, category } = req.body;
  if ((title !== undefined && !String(title).trim()) || (content !== undefined && !String(content).trim())) {
    throw httpError(400, "Judul dan isi diskusi tidak boleh kosong.");
  }
  await threads.patch(req.params.id, { title, content, category });
  res.json({ message: "Diskusi diperbarui." });
};

// DELETE /api/forum/:id   (admin)
exports.remove = async (req, res) => {
  if (!(await threads.findById(req.params.id))) throw httpError(404, "Thread tidak ditemukan.");
  await threads.remove(req.params.id);
  res.json({ message: "Thread dihapus." });
};