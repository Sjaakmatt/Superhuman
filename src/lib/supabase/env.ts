/**
 * Supabase env-vars, met een duidelijke fout als ze ontbreken.
 * Zowel de nieuwe publishable key als de legacy anon key wordt ondersteund.
 */
export function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase env-vars ontbreken. Kopieer .env.example naar .env.local en vul NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (of _ANON_KEY) in.",
    );
  }
  return { url, key };
}
