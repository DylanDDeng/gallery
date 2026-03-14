// Client for public read-only operations (e.g., fetching images).
// For authenticated operations (favorites, auth), use supabase-browser.ts or supabase-server.ts.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
