import { NextRequest } from "next/server";
import {
  authenticatedUserId,
  createWhatsAppClient,
  hasWhatsAppConfiguration,
} from "@/lib/whatsappServer";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function masked(phone: string | null) {
  if (!phone) return null;
  return phone.length > 5 ? phone.slice(0, 3) + "••••" + phone.slice(-2) : "••••";
}

export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request);
  if (!userId) return json({ error: "unauthorized" }, 401);
  try {
    const supabase = createWhatsAppClient();
    const { data, error } = await supabase
      .from("sds_whatsapp_links")
      .select("phone_e164,status,daily_frequency,consented_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return json({
      connected: Boolean(data?.phone_e164 && data?.consented_at),
      status: data?.status || "pending",
      frequency: Number(data?.daily_frequency ?? 2),
      phone: masked(data?.phone_e164 || null),
      ready: hasWhatsAppConfiguration(),
      senderPhone: process.env.WHATSAPP_DISPLAY_PHONE || null,
      templateName: process.env.WHATSAPP_TEMPLATE_NAME || "socrates_pildora_v1",
      slots: [
        { count: 1, times: ["13:00"] },
        { count: 2, times: ["13:00", "17:00"] },
        { count: 3, times: ["11:00", "13:00", "17:00"] },
      ],
    });
  } catch {
    return json({ error: "whatsapp_settings_unavailable" }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const userId = await authenticatedUserId(request);
  if (!userId) return json({ error: "unauthorized" }, 401);
  let body: { frequency?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const frequency = Number(body.frequency);
  if (!Number.isInteger(frequency) || frequency < 0 || frequency > 3) {
    return json({ error: "frequency_must_be_0_to_3" }, 422);
  }
  try {
    const supabase = createWhatsAppClient();
    const { error } = await supabase.from("sds_whatsapp_links")
      .upsert({ user_id: userId, daily_frequency: frequency }, { onConflict: "user_id" });
    if (error) throw error;
    return json({ saved: true, frequency });
  } catch {
    return json({ error: "whatsapp_settings_unavailable" }, 503);
  }
}
