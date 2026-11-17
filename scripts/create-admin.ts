// Buat akun admin pertama di database yang ditunjuk .env. Jalankan: npm run create:admin
// Butuh env: ADMIN_EMAIL, ADMIN_PASSWORD (opsional: ADMIN_NAME, ADMIN_PHONE)
import bcrypt from "bcryptjs";
import { initMysql } from "../src/database/mysql";
import * as users from "../src/database/users.repo";
import { newId } from "../src/controllers/common";

async function main(): Promise<void> {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || password.length < 8) {
    console.error("Isi ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 8 karakter).");
    process.exit(1);
  }
  await initMysql();
  if (await users.findByEmail(email)) {
    console.log("Akun dengan email itu sudah ada. Tidak ada yang diubah.");
    process.exit(0);
  }
  await users.createUser({
    id: newId("u"),
    name: process.env.ADMIN_NAME || "Admin Sanggar",
    email,
    phone: process.env.ADMIN_PHONE || "080000000000",
    password: await bcrypt.hash(password, 10),
    role: "admin",
    avatar: null,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  } as any);
  console.log(`Admin dibuat: ${email}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});