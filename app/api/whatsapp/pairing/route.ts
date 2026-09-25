import { NextRequest } from "next/server";
import {
  authenticatedUserId,
  createWhatsAppClient,
  hashPairingCode,
  newPairingCode,
} from "@/lib/whatsappServer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const supabase = createWhatsAppClient();
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabase.from("sds_whatsapp_links")
      .upsert(
        {
          user_id: userId,
          pairing_code_hash: hashPairingCode(code),
          pairing_code_expires_at: expiresAt,
        },
        { onConflict: "user_id" }
      );
    if (error) throw error;
    return Response.json(
      {
        code,
        command: "VINCULAR " + code,
        expiresAt,
        senderPhone: process.env.WHATSAPP_DISPLAY_PHONE || null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json({ error: "pairing_code_unavailable" }, { status: 503 });
  }
}
