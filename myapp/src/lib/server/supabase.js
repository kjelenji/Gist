/**
 * supabase.js — one shared database client for server code.
 *
 * Prefers env vars (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY).
 * Falls back to this project's public anon credentials so the scoreboard works
 * on Render and in production builds, where `.env` is not loaded.
 * The anon key is safe to ship; table access is controlled by RLS.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

const FALLBACK_URL = 'https://upyoyxodnrhqbvpxuane.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweW95eG9kbnJocWJ2cHh1YW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTU0MjgsImV4cCI6MjA5NzA3MTQyOH0.0eZ_1BGvFoaZfuRUKzAEnZRtXfSEUPdpWh7O4JG_ZpU';

function pick(value, fallback) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return fallback;
  if (trimmed.includes('YOUR_PROJECT_REF') || trimmed.includes('your-project-ref')) return fallback;
  if (trimmed.includes('your-supabase-publishable-key')) return fallback;
  return trimmed;
}

function supabaseUrl() {
  return pick(env.SUPABASE_URL, FALLBACK_URL);
}

function supabaseKey() {
  return pick(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY, FALLBACK_KEY);
}

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

export function isSupabaseConfigured() {
  const url = supabaseUrl();
  const key = supabaseKey();
  return Boolean(url && key && url.startsWith('https://') && url.includes('.supabase.co'));
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;

  if (!client) {
    client = createClient(supabaseUrl(), supabaseKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}
