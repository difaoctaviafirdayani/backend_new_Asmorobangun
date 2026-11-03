// =============================================================================
// PUSH SERVICE — kirim push notification ke HP pengguna lewat Firebase (FCM).
// Aman dipanggil kapan saja: kalau Firebase belum diset / gagal, fungsi ini
// TIDAK melempar error, jadi proses utama (ubah status pesanan, dll) tidak terganggu.
// Butuh:  npm install firebase-admin
// =============================================================================
import { FIREBASE_SERVICE_ACCOUNT } from "../../config/env";
import * as pushRepo from "../../database/push.repo";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

let messaging: any = null;

function getMessaging(): any {
  if (messaging) return messaging;
  if (!FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const admin = require("firebase-admin");
    const json = FIREBASE_SERVICE_ACCOUNT.trim().startsWith("{")
      ? FIREBASE_SERVICE_ACCOUNT
      : Buffer.from(FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8");
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
    messaging = admin.messaging();
    return messaging;
  } catch (err: any) {
    console.warn("Push notification dimatikan:", err.message);
    return null;
  }
}

export async function notifyUser(userId: string, msg: PushMessage): Promise<void> {
  try {
    const fcm = getMessaging();
    if (!fcm || !userId) return;
    const tokens = await pushRepo.tokensByUser(userId);
    if (!tokens.length) return;

    const result = await fcm.sendEachForMulticast({
      tokens,
      notification: { title: msg.title, body: msg.body },
      data: msg.data || {}, // nilai data FCM harus string
    });

    // Buang token yang sudah tidak berlaku (aplikasi di-uninstall, dsb).
    const dead: string[] = [];
    result.responses.forEach((r: any, i: number) => {
      const code = r.error?.code;
      if (!r.success && (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token")) {
        dead.push(tokens[i]);
      }
    });
    await pushRepo.removeTokens(dead);
  } catch (err: any) {
    console.warn("Gagal mengirim push:", err.message);
  }
}