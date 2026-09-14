import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://tlyczyfsboqrtrdpwizp.supabase.co";
const fallbackPublishableKey = "sb_publishable_gMTGwNPjdwgNuzzRPpUPyA_ezrPfCrT";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey;

// The fallback key is a Supabase publishable key, not a service-role secret.
// Security is enforced by RLS on all SÓCRATES user-owned tables.
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
