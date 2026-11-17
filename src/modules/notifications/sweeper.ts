import { getPool } from "../../database/mysql";
import { orders } from "../../database/registrasi.repo";
import {
  PAYMENT_REMINDER_AFTER_HOURS,
  PAYMENT_WINDOW_HOURS,
} from "../../config/rules";
import { notify } from "./notify.service";

type Row = Record<string, any>;

let lastRun = 0;
const HOUR = 3600 * 1000;

const UNPAID =
  "status = 'menunggu_pembayaran' AND (proof_file IS NULL OR proof_file = '') AND (payment_method IS NULL OR payment_method <> 'cash')";

export async function sweepPayments(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRun < 60_000) return;
  lastRun = now;
  try {
    await cancelExpired(now);
    await sendReminders(now);
  } catch (err: any) {
    console.warn("Sweeper pembayaran gagal:", err.message);
  }
}

async function cancelExpired(now: number): Promise<void> {
  const pool = getPool();
  const cutoff = new Date(now - PAYMENT_WINDOW_HOURS * HOUR);

  const [orderRows] = await pool.query(
    `SELECT id, user_id, topeng_name FROM topeng_orders WHERE ${UNPAID} AND created_at < ?`,
    [cutoff],
  );
  for (const r of orderRows as Row[]) {
    const [res] = await pool.query(
      "UPDATE topeng_orders SET status = 'dibatalkan' WHERE id = ? AND status = 'menunggu_pembayaran'",
      [r.id],
    );
    if (!Number(res.affectedRows)) continue;
    await orders.addChat(r.id, {
      from: "system",
      text: `Pesanan dibatalkan otomatis karena belum dibayar dalam ${PAYMENT_WINDOW_HOURS} jam.`,
    });
    await notify(r.user_id, {
      type: "order",
      title: "Pesanan dibatalkan",
      body: `Pesanan ${r.topeng_name} dibatalkan karena belum dibayar dalam ${PAYMENT_WINDOW_HOURS} jam.`,
      refId: r.id,
      refType: "topeng",
      dedupeKey: `cancel:topeng:${r.id}`,
    });
  }

  const [bookingRows] = await pool.query(
    `SELECT id, user_id, facility_name FROM bookings WHERE ${UNPAID} AND created_at < ?`,
    [cutoff],
  );
  for (const r of bookingRows as Row[]) {
    const [res] = await pool.query(
      "UPDATE bookings SET status = 'dibatalkan' WHERE id = ? AND status = 'menunggu_pembayaran'",
      [r.id],
    );
    if (!Number(res.affectedRows)) continue;
    await notify(r.user_id, {
      type: "order",
      title: "Pendaftaran dibatalkan",
      body: `Pendaftaran ${r.facility_name} dibatalkan karena belum dibayar dalam ${PAYMENT_WINDOW_HOURS} jam.`,
      refId: r.id,
      refType: "booking",
      dedupeKey: `cancel:booking:${r.id}`,
    });
  }
}

async function sendReminders(now: number): Promise<void> {
  const pool = getPool();
  const cutoff = new Date(now - PAYMENT_WINDOW_HOURS * HOUR);
  const remindFrom = new Date(now - PAYMENT_REMINDER_AFTER_HOURS * HOUR);
  const left = (createdAt: Date): string => {
    const ms =
      new Date(createdAt).getTime() + PAYMENT_WINDOW_HOURS * HOUR - now;
    const h = Math.max(1, Math.round(ms / HOUR));
    return `sekitar ${h} jam lagi`;
  };

  const [orderRows] = await pool.query(
    `SELECT id, user_id, topeng_name, created_at FROM topeng_orders WHERE ${UNPAID} AND created_at < ? AND created_at >= ?`,
    [remindFrom, cutoff],
  );
  for (const r of orderRows as Row[]) {
    await notify(r.user_id, {
      type: "payment_reminder",
      title: "Segera selesaikan pembayaran",
      body: `Pesanan ${r.topeng_name} akan dibatalkan otomatis ${left(r.created_at)} bila belum dibayar.`,
      refId: r.id,
      refType: "topeng",
      dedupeKey: `reminder:topeng:${r.id}`,
    });
  }

  const [bookingRows] = await pool.query(
    `SELECT id, user_id, facility_name, created_at FROM bookings WHERE ${UNPAID} AND created_at < ? AND created_at >= ?`,
    [remindFrom, cutoff],
  );
  for (const r of bookingRows as Row[]) {
    await notify(r.user_id, {
      type: "payment_reminder",
      title: "Segera selesaikan pembayaran",
      body: `Pendaftaran ${r.facility_name} akan dibatalkan otomatis ${left(r.created_at)} bila belum dibayar.`,
      refId: r.id,
      refType: "booking",
      dedupeKey: `reminder:booking:${r.id}`,
    });
  }
}
