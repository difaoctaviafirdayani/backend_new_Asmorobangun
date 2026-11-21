import { z } from "zod";

const boolish = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);

export const articleCreateSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(255, "Judul maksimal 255 karakter."),
  excerpt: z.string().trim().max(500, "Ringkasan maksimal 500 karakter.").nullish(),
  content: z.string().trim().min(1, "Isi artikel wajib diisi.").max(100000, "Isi artikel terlalu panjang."),
  image: z.string().trim().max(255, "Alamat gambar terlalu panjang.").nullish(),
  category: z.string().trim().max(50, "Kategori terlalu panjang.").nullish(),
});

export const articleUpdateSchema = articleCreateSchema.extend({ featured: boolish }).partial();

export const faqCreateSchema = z.object({
  question: z.string().trim().min(1, "Pertanyaan wajib diisi.").max(500, "Pertanyaan maksimal 500 karakter."),
  answer: z.string().trim().min(1, "Jawaban wajib diisi.").max(20000, "Jawaban terlalu panjang."),
});

export const faqUpdateSchema = faqCreateSchema.partial();