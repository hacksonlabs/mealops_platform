// src/lib/supabaseUser.ts
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest } from 'next';

export function createUserScopedClient(req: NextApiRequest) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/ANON');

  const bearer =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    (req.cookies?.['sb-access-token'] ?? req.cookies?.['supabase-auth-token']); // adjust if needed

  return createClient(url, anon, {
    global: { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
