import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

const isPlaceholderUrl =
  !supabaseUrl ||
  supabaseUrl.includes('your-project-ref') ||
  supabaseUrl === PLACEHOLDER_URL;

const isPlaceholderKey =
  !supabaseAnonKey ||
  supabaseAnonKey === 'your_supabase_anon_key' ||
  supabaseAnonKey === PLACEHOLDER_KEY;

export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey;

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart the dev server.';

if (!isSupabaseConfigured) {
  console.error(
    'Missing or placeholder Supabase env vars. Copy .env.example to .env and add your Supabase project URL + anon key from Supabase Dashboard → Project Settings → API.'
  );
}

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
);
