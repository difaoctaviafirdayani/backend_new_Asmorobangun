// ===========================================================================
// TITIK MASUK VERCEL (serverless). Di Vercel tidak ada app.listen();
// setiap request masuk lewat fungsi ini. Koneksi MySQL dibuat sekali lalu dipakai ulang.
// ===========================================================================
import type { IncomingMessage, ServerResponse } from "http";
import { initDb } from "../src/database/db";
import { initMysql } from "../src/database/mysql";

let ready: Promise<void> | null = null;

function boot(): Promise<void> {
  if (!ready) {
    try {
      initDb();
    } catch (err: any) {
      console.warn("initDb dilewati:", err.message); // sistem file Vercel read-only
    }
    ready = initMysql().catch((err) => {
      ready = null; // coba lagi di request berikutnya
      throw err;
    });
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await boot();
    const app = require("../src/app");
    app(req, res);
  } catch (err: any) {
    console.error("Gagal start di Vercel:", err.message);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server gagal terhubung ke database." }));
  }
}