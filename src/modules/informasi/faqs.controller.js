const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");

exports.list = (req, res) => {
  res.json({ faqs: readDB().faqs });
};

exports.create = async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) throw httpError(400, "Pertanyaan dan jawaban wajib diisi.");
  const faq = { id: `faq-${nanoid(6)}`, question, answer };
  await update((data) => data.faqs.push(faq));
  res.status(201).json({ faq });
};

exports.update = async (req, res) => {
  const { question, answer } = req.body;
  if (!readDB().faqs.find((f) => f.id === req.params.id)) throw httpError(404, "FAQ tidak ditemukan.");
  await update((data) => {
    const f = data.faqs.find((x) => x.id === req.params.id);
    if (question !== undefined) f.question = question;
    if (answer !== undefined) f.answer = answer;
  });
  res.json({ message: "FAQ diperbarui." });
};

exports.remove = async (req, res) => {
  await update((data) => {
    data.faqs = data.faqs.filter((f) => f.id !== req.params.id);
  });
  res.json({ message: "FAQ dihapus." });
};
