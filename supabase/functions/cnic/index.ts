// cnic — keeps one account per CNIC (supabase/56_cnic_unique.sql).
//
//   check     { cnic }  → { ok: true } or 409 cnic_taken. Signed-out; signup's
//                         first step asks before sending an email code.
//   claim     { cnic }  → { ok: true } or 409 cnic_taken. Signed-in; makes the
//                         CNIC the caller's own (signup, and changing it later
//                         from the profile). The only way cnic_number moves.
//   backfill  {}        → service role only. Hashes the CNICs stored before
//                         this existed into cnic_registry, once, and lists the
//                         accounts whose CNIC another account already holds.
//
// The account behind `claim` comes from the caller's session token, never the
// body. `check` is capped per IP, `claim` per member (public.rate_limit_config).
//
// Secret (supabase secrets set …):
//   CNIC_SECRET   any long random string. Set it once and never change it —
//                 every stored hash is made with it.
//
// Deploy with JWT verification off: `check` is called signed-out, and `claim`
// verifies the session itself.
//   supabase functions deploy cnic --no-verify-jwt
//
// Backfill, once, after the migration and deploy:
//   curl -X POST https://<project>.supabase.co/functions/v1/cnic \
//     -H "Authorization: Bearer <service role key>" \
//     -H "Content-Type: application/json" -d '{"action":"backfill"}'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cnicDigits, cnicDisplay, cnicHash } from '../_shared/cnic.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface Body {
  action?: string;
  cnic?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

  /** Seconds to wait, or 0. A failed check lets the request through. */
  const rateLimited = async (name: string, subject: string | null): Promise<number> => {
    if (!subject) return 0;
    const { data, error } = await admin.rpc('rate_limit_check', { p_name: name, p_subject: subject });
    if (error) console.error('cnic: rate limit check failed', error.message);
    return typeof data === 'number' ? data : 0;
  };

  try {
    switch (body.action) {
      case 'check': {
        const clientIp =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || null;
        const wait = await rateLimited('cnic_check_ip', clientIp);
        if (wait > 0) return json({ error: 'rate_limited', retryAfter: wait }, 429);

        const digits = cnicDigits(body.cnic);
        if (!digits) return json({ error: 'invalid_cnic' }, 400);

        const { data, error } = await admin
          .from('cnic_registry')
          .select('user_id')
          .eq('cnic_hash', await cnicHash(digits))
          .maybeSingle();
        if (error) throw error;
        return data ? json({ error: 'cnic_taken' }, 409) : json({ ok: true });
      }

      case 'claim': {
        const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: auth } = await asCaller.auth.getUser(bearer);
        const userId = auth?.user?.id;
        if (!userId) return json({ error: 'not_authenticated' }, 401);

        const wait = await rateLimited('cnic_claim', userId);
        if (wait > 0) return json({ error: 'rate_limited', retryAfter: wait }, 429);

        const digits = cnicDigits(body.cnic);
        if (!digits) return json({ error: 'invalid_cnic' }, 400);

        const { data: status, error } = await admin.rpc('cnic_claim', {
          p_user_id: userId,
          p_cnic_hash: await cnicHash(digits),
          p_cnic_number: cnicDisplay(digits),
        });
        if (error) throw error;
        return status === 'ok' ? json({ ok: true }) : json({ error: 'cnic_taken' }, 409);
      }

      case 'backfill': {
        if (!serviceKey || bearer !== serviceKey) return json({ error: 'not_allowed' }, 403);

        // Unregistered rows only, oldest account first: where two accounts
        // share a CNIC, the first to sign up keeps it and the later one is the
        // one listed. Safe to run again — what's registered is skipped.
        const { data: rows, error } = await admin.rpc('cnic_backfill_rows');
        if (error) throw error;

        let claimed = 0;
        const invalid: string[] = [];
        const duplicates: { userId: string; heldBy: string | null }[] = [];

        for (const row of (rows ?? []) as { id: string; cnic_number: string }[]) {
          const digits = cnicDigits(row.cnic_number);
          if (!digits) {
            invalid.push(row.id);
            continue;
          }
          const hash = await cnicHash(digits);
          const { data: status, error: claimError } = await admin.rpc('cnic_claim', {
            p_user_id: row.id,
            p_cnic_hash: hash,
            p_cnic_number: cnicDisplay(digits),
          });
          if (claimError) throw claimError;
          if (status === 'ok') {
            claimed += 1;
          } else {
            const { data: holder } = await admin.from('cnic_registry').select('user_id').eq('cnic_hash', hash).maybeSingle();
            duplicates.push({ userId: row.id, heldBy: (holder?.user_id as string | undefined) ?? null });
          }
        }

        return json({ ok: true, claimed, duplicates, invalid });
      }

      default:
        return json({ error: 'invalid_action' }, 400);
    }
  } catch (err) {
    console.error('cnic:', (err as Error)?.message ?? err);
    return json({ error: 'server_error' }, 500);
  }
});
