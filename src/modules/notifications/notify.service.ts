import * as inbox from "../../database/notifications.repo";
import type { NewNotification } from "../../database/notifications.repo";
import { notifyUser } from "./push.service";

export async function notify(userId: string | null | undefined, n: NewNotification): Promise<void> {
  if (!userId) return;
  try {
    const created = await inbox.add(userId, n);
    if (!created) return;
    await notifyUser(userId, {
      title: n.title,
      body: n.body || "",
      data: { type: n.type, refId: n.refId || "", refType: n.refType || "" },
    });
  } catch (err: any) {
    console.warn("Gagal membuat notifikasi:", err.message);
  }
}

export async function notifyAllMembers(n: NewNotification): Promise<void> {
  try {
    await inbox.broadcast(n);
  } catch (err: any) {
    console.warn("Gagal membuat notifikasi massal:", err.message);
  }
}

export function topengStatusText(
  name: string,
  status: string,
  ship?: { courier?: string | null; trackingNumber?: string | null }
): { title: string; body: string } {
  switch (status) {
    case "menunggu_verifikasi":
      return { title: "Bukti bayar diterima", body: `Pesanan ${name} menunggu verifikasi admin.` };
    case "diproses":
      return { title: "Pesanan diproses", body: `Pembayaran ${name} valid. Topeng sedang dibuat.` };
    case "dikirim": {
      const resi = ship?.trackingNumber ? ` Resi ${ship.courier ? ship.courier + " " : ""}${ship.trackingNumber}.` : "";
      return { title: "Pesanan dikirim", body: `${name} sudah selesai dibuat dan sedang dikirim.${resi}` };
    }
    case "selesai":
      return { title: "Pesanan selesai", body: `Pesanan ${name} sudah diterima. Tulis ulasanmu di Pesanan Saya.` };
    case "dibatalkan":
      return { title: "Pesanan dibatalkan", body: `Pesanan ${name} dibatalkan.` };
    default:
      return { title: "Status pesanan diperbarui", body: `Pesanan ${name}: ${status.replace(/_/g, " ")}` };
  }
}

export function bookingStatusText(name: string, status: string): { title: string; body: string } {
  switch (status) {
    case "menunggu_verifikasi":
      return { title: "Bukti bayar diterima", body: `Pendaftaran ${name} menunggu verifikasi admin.` };
    case "menunggu_kedatangan":
      return { title: "Pendaftaran dikonfirmasi", body: `${name}: silakan datang sesuai jadwal. Pembayaran tunai dilakukan di sanggar.` };
    case "selesai":
      return { title: "Layanan selesai", body: `Terima kasih sudah mengikuti ${name}. Tulis ulasanmu di Pesanan Saya.` };
    case "dibatalkan":
      return { title: "Pendaftaran dibatalkan", body: `Pendaftaran ${name} dibatalkan.` };
    default:
      return { title: "Status pendaftaran diperbarui", body: `${name}: ${status.replace(/_/g, " ")}` };
  }
}
