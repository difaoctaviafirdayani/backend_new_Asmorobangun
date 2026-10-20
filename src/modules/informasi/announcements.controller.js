const { nanoid } = require("nanoid");
const { announcements } = require("../../database/content.repo");
const { httpError } = require("../../middleware/error");

exports.list = async (req, res) => {
  res.json({ announcements: await announcements.list() });
};

exports.getOne = async (req, res) => {
  const item = await announcements.findById(req.params.id);
  if (!item) throw httpError(404, "Pengumuman tidak ditemukan.");
  res.json({ announcement: item });
};

exports.create = async (req, res) => {
  const { title, body, type, color, image } = req.body;
  if (!title || !body) throw httpError(400, "Judul dan isi pengumuman wajib diisi.");
  const item = await announcements.insert({
    id: `an-${nanoid(8)}`,
    title,
    body,
    type: type || "Pengumuman",
    color: color || "brown",
    image: image || null,
    date: new Date().toISOString(),
  });
  res.status(201).json({ announcement: item });
};

exports.update = async (req, res) => {
  if (!(await announcements.findById(req.params.id))) throw httpError(404, "Pengumuman tidak ditemukan.");
  await announcements.patch(req.params.id, req.body);
  res.json({ message: "Pengumuman diperbarui." });
};

exports.remove = async (req, res) => {
  await announcements.remove(req.params.id);
  res.json({ message: "Pengumuman dihapus." });
};