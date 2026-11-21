import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { httpError } from "./error";

// Validasi body / query / params dengan skema Zod SEBELUM masuk controller.
// Field di luar skema otomatis dibuang (mencegah mass assignment).
export const validate =
  (schema: ZodTypeAny, source: "body" | "query" | "params" = "body"): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse((req as any)[source]);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => {
          const field = i.path.map(String).join(".") || "data";
          return i.code === "invalid_type" ? `${field} wajib diisi dengan format yang benar.` : i.message;
        })
        .join(" ");
      return next(httpError(400, message));
    }
    (req as any)[source] = result.data;
    next();
  };