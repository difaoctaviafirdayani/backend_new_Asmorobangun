const { nanoid } = require("nanoid");
const { gallery } = require("../../database/content.repo");
const { httpError } = require("../../middleware/error");

exports.list = async (req, res) => {
  res.json({ gallery: await gallery.list() });
};

exports.getOne = async (req, res) => {
  const item = await gallery.findById(req.params.id);
  if (!item) throw httpError(404, "Item galeri tidak ditemukan.");
  res.json({ item });
};

exports.create = async (req, res) => {
  const { title, caption, image } = req.body;
  if (!title || !image) throw httpError(400, "Judul dan gambar wajib diisi.");
  const item = await gallery.insert({
    id: `gal-${nanoid(8)}`,
    title,
    caption: caption || "",
    image,
    date: new Date().toISOString(),
  });
  res.status(201).json({ item });
};

exports.update = async (req, res) => {
  if (!(await gallery.findById(req.params.id))) throw httpError(404, "Item galeri tidak ditemukan.");
  await gallery.patch(req.params.id, req.body);
  res.json({ message: "Item galeri diperbarui." });
};

exports.remove = async (req, res) => {
  await gallery.remove(req.params.id);
  res.json({ message: "Item galeri dihapus." });
};