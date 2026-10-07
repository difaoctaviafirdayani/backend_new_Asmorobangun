const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");
const { sortNewest, omit } = require("../../utils/helpers");

exports.list = (req, res) => {
  res.json({ announcements: sortNewest(readDB().announcements) });
};

exports.getOne = (req, res) => {
  const item = readDB().announcements.find((a) => a.id === req.params.id);
  if (!item) throw httpError(404, "Pengumuman tidak ditemukan.");
  res.json({ announcement: item });
};

exports.create = async (req, res) => {
  const { title, body, type, color, image } = req.body;
  if (!title || !body) throw httpError(400, "Judul dan isi pengumuman wajib diisi.");
  const item = {
    id: `an-${nanoid(8)}`,
    title,
    body,
    type: type || "Pengumuman",
    color: color || "brown",
    image: image || null,
    date: new Date().toISOString(),
  };
  await update((data) => data.announcements.push(item));
  res.status(201).json({ announcement: item });
};

exports.update = async (req, res) => {
  if (!readDB().announcements.find((a) => a.id === req.params.id)) throw httpError(404, "Pengumuman tidak ditemukan.");
  await update((data) => {
    Object.assign(data.announcements.find((a) => a.id === req.params.id), omit(req.body, ["id"]));
  });
  res.json({ message: "Pengumuman diperbarui." });
};

exports.remove = async (req, res) => {
  await update((data) => {
    data.announcements = data.announcements.filter((a) => a.id !== req.params.id);
  });
  res.json({ message: "Pengumuman dihapus." });
};
