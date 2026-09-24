// auth-otp — the email one-time codes behind signup and "forgot password".
//
// The member never leaves the app: a 6-digit code goes out by email (Brevo or Resend), they
// type it in, and this function turns a correct code into a short-lived ticket.
// The ticket — not the code — is what authorises the step that follows:
//
//   request  { email, purpose, language }       → sends a code
//   verify   { email, purpose, code }           → { ticket }
//   signup   { email, password, fullName, ticket } → creates the confirmed account
//   reset    { email, password, ticket }        → writes the new password
//
// `purpose` is 'signup' or 'reset'; a code or ticket minted for one is useless
// for the other. Every limit (expiry, resend cooldown, hourly cap, wrong-attempt
// lockout, single use) is enforced by the row-locked SQL functions in
// supabase/45_email_otp.sql, so parallel requests can't race past them.
//
// Called by signed-out visitors, so there is no user JWT to check — deploy with
// JWT verification off (the project's publishable key isn't a JWT either):
//   supabase functions deploy auth-otp --no-verify-jwt
//
// Secrets (supabase secrets set …) — one email provider is enough:
//   BREVO_API_KEY    Brevo → SMTP & API → API Keys. Used when set; the sender
//                    only has to be a verified address, not a domain.
//   RESEND_API_KEY   Resend → API Keys. Used when Brevo's isn't set; needs a
//                    verified domain to reach anyone but the account owner.
//   OTP_FROM_EMAIL   "Rishta & Rang <address>" — for Brevo, the address
//                    verified under Senders; for Resend, one on its domain
//   OTP_SECRET       any long random string; keys the code/ticket hashes.
//                    Falls back to the service role key when unset.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Purpose = 'signup' | 'reset';

const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
// Signup's ticket has to outlive the photo and selfie steps that follow the
// code; a reset ticket only has to reach the next screen.
const TICKET_TTL_SECONDS: Record<Purpose, number> = { signup: 60 * 60, reset: 15 * 60 };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Mirrors src/utils/validation.ts isStrongPassword — the app checks first, this
// is the check that can't be skipped.
function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 72 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/** Uniform 000000–999999, without the modulo bias of `n % 1e6`. */
function generateCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

function generateTicket(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let hmacKey: Promise<CryptoKey> | null = null;

function keyFor(secret: string): Promise<CryptoKey> {
  hmacKey ??= crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return hmacKey;
}

async function hmac(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await keyFor(secret), new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// The email
// ---------------------------------------------------------------------------

const COPY: Record<string, Record<Purpose, { subject: string; intro: string }> & { expiry: string; ignore: string }> = {
  en: {
    signup: { subject: 'Your Rishta & Rang verification code', intro: 'Use this code to verify your email and finish creating your account.' },
    reset: { subject: 'Your Rishta & Rang password reset code', intro: 'Use this code to reset your password.' },
    expiry: 'The code expires in {minutes} minutes. Never share it with anyone — our team will never ask for it.',
    ignore: "If you didn't request this, you can safely ignore this email.",
  },
  roman: {
    signup: { subject: 'Rishta & Rang tasdeeqi code', intro: 'Apni email ki tasdeeq aur account mukammal karne ke liye yeh code istemal karein.' },
    reset: { subject: 'Rishta & Rang password reset code', intro: 'Apna password reset karne ke liye yeh code istemal karein.' },
    expiry: 'Yeh code {minutes} minute mein khatam ho jayega. Yeh code kisi ko na batayein — hamari team kabhi yeh nahi mangegi.',
    ignore: 'Agar aap ne yeh request nahi ki to is email ko nazar andaz kar dein.',
  },
  ur: {
    signup: { subject: 'رشتہ اینڈ رنگ تصدیقی کوڈ', intro: 'اپنی ای میل کی تصدیق اور اکاؤنٹ مکمل کرنے کے لیے یہ کوڈ استعمال کریں۔' },
    reset: { subject: 'رشتہ اینڈ رنگ پاس ورڈ ری سیٹ کوڈ', intro: 'اپنا پاس ورڈ ری سیٹ کرنے کے لیے یہ کوڈ استعمال کریں۔' },
    expiry: 'یہ کوڈ {minutes} منٹ میں ختم ہو جائے گا۔ یہ کوڈ کسی کو نہ بتائیں — ہماری ٹیم کبھی یہ نہیں مانگے گی۔',
    ignore: 'اگر آپ نے یہ درخواست نہیں کی تو اس ای میل کو نظر انداز کر دیں۔',
  },
};

function renderEmail(purpose: Purpose, code: string, language: string) {
  const copy = COPY[language] ?? COPY.en;
  const minutes = String(CODE_TTL_SECONDS / 60);
  const expiry = copy.expiry.replace('{minutes}', minutes);
  const dir = language === 'ur' ? 'rtl' : 'ltr';
  const { subject, intro } = copy[purpose];

  const html = `<!doctype html>
<html dir="${dir}"><body style="margin:0;padding:24px;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#1f2a2e">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px;color:#1f6f6b">Rishta &amp; Rang</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:22px">${intro}</p>
      <p dir="ltr" style="margin:0 0 24px;font-size:34px;font-weight:bold;letter-spacing:10px;text-align:center;color:#1f2a2e">${code}</p>
      <p style="margin:0 0 12px;font-size:13px;line-height:20px;color:#5b6b70">${expiry}</p>
      <p style="margin:0;font-size:13px;line-height:20px;color:#5b6b70">${copy.ignore}</p>
    </td></tr>
  </table>
</body></html>`;

  const text = `${intro}\n\n${code}\n\n${expiry}\n${copy.ignore}`;
  return { subject, html, text };
}

/** "Name <address>" → its two halves; a bare address gets the app's name. */
function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (match) return { name: match[1].replace(/^"|"$/g, '') || 'Rishta & Rang', email: match[2] };
  return { name: 'Rishta & Rang', email: from.trim() };
}

/** `detail` is the provider's own reason for a refusal — logged, and returned
 *  with `send_failed` so a misconfigured sender shows up where it's tested. */
type SendResult = { ok: true } | { ok: false; detail: string };

async function sendEmail(to: string, purpose: Purpose, code: string, language: string): Promise<SendResult> {
  const { subject, html, text } = renderEmail(purpose, code, language);
  const from = Deno.env.get('OTP_FROM_EMAIL') ?? '';

  // Brevo when its key is set — it sends from a single verified address (a
  // Gmail inbox works), no domain needed. Resend otherwise, which needs one.
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  if (brevoKey) {
    if (!from) {
      const detail = 'OTP_FROM_EMAIL must be the sender verified in Brevo';
      console.error('auth-otp:', detail);
      return { ok: false, detail };
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const detail = `Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`;
      console.error('auth-otp: send rejected —', detail);
      return { ok: false, detail };
    }
    return { ok: true };
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    const detail = 'neither BREVO_API_KEY nor RESEND_API_KEY is set';
    console.error('auth-otp:', detail);
    return { ok: false, detail };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from || 'Rishta & Rang <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const detail = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`;
    console.error('auth-otp: send rejected —', detail);
    return { ok: false, detail };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

interface Body {
  action?: string;
  email?: string;
  purpose?: string;
  language?: string;
  code?: string;
  ticket?: string;
  password?: string;
  fullName?: string;
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

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return json({ error: 'invalid_email' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const secret = Deno.env.get('OTP_SECRET') || serviceKey;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const userIdFor = async (address: string): Promise<string | null> => {
    const { data, error } = await admin.rpc('auth_user_id_by_email', { p_email: address });
    if (error) throw error;
    return (data as string | null) ?? null;
  };
  const ticketHash = (purpose: Purpose, ticket: string) => hmac(secret, `ticket:${purpose}:${email}:${ticket}`);

  try {
    switch (body.action) {
      case 'request': {
        const purpose = body.purpose as Purpose;
        if (purpose !== 'signup' && purpose !== 'reset') return json({ error: 'invalid_purpose' }, 400);

        const existing = await userIdFor(email);
        // Signup: the app already tells a visitor an address is taken (step 1's
        // email_exists check), so saying it here leaks nothing new.
        if (purpose === 'signup' && existing) return json({ error: 'email_taken' }, 409);

        const code = generateCode();
        const { data: issued, error: issueError } = await admin.rpc('otp_issue', {
          p_email: email,
          p_purpose: purpose,
          p_code_hash: await hmac(secret, `code:${purpose}:${email}:${code}`),
          p_ttl_seconds: CODE_TTL_SECONDS,
          p_cooldown_seconds: RESEND_COOLDOWN_SECONDS,
          p_max_sends: MAX_SENDS_PER_HOUR,
          p_max_attempts: MAX_ATTEMPTS,
        });
        if (issueError) throw issueError;
        if (issued?.status !== 'ok') {
          return json({ error: issued?.status ?? 'rate_limited', retryAfter: issued?.retry_after ?? RESEND_COOLDOWN_SECONDS }, 429);
        }

        // Reset for an address with no account: the row above is still written
        // (so cooldowns look identical either way) but nothing is sent, and the
        // answer is the same as for a real account — no enumeration.
        if (purpose === 'reset' && !existing) {
          return json({ ok: true, resendIn: RESEND_COOLDOWN_SECONDS, expiresIn: CODE_TTL_SECONDS });
        }

        const sent = await sendEmail(email, purpose, code, body.language ?? 'en');
        if (!sent.ok) {
          await admin.rpc('otp_release_cooldown', { p_email: email, p_purpose: purpose });
          return json({ error: 'send_failed', detail: sent.detail }, 502);
        }
        return json({ ok: true, resendIn: RESEND_COOLDOWN_SECONDS, expiresIn: CODE_TTL_SECONDS });
      }

      case 'verify': {
        const purpose = body.purpose as Purpose;
        if (purpose !== 'signup' && purpose !== 'reset') return json({ error: 'invalid_purpose' }, 400);
        const code = (body.code ?? '').trim();
        if (!/^\d{6}$/.test(code)) return json({ error: 'invalid_code' }, 400);

        const ticket = generateTicket();
        const { data: result, error } = await admin.rpc('otp_verify', {
          p_email: email,
          p_purpose: purpose,
          p_code_hash: await hmac(secret, `code:${purpose}:${email}:${code}`),
          p_ticket_hash: await ticketHash(purpose, ticket),
          p_ticket_ttl_seconds: TICKET_TTL_SECONDS[purpose],
        });
        if (error) throw error;

        switch (result?.status) {
          case 'ok':
            return json({ ok: true, ticket });
          case 'invalid':
            return json({ error: 'invalid_code', remaining: result.remaining }, 400);
          case 'locked':
            return json({ error: 'too_many_attempts' }, 429);
          default:
            // 'missing' and 'expired' read the same to the member: get a new code.
            return json({ error: 'code_expired' }, 410);
        }
      }

      case 'signup': {
        const password = body.password ?? '';
        const ticket = body.ticket ?? '';
        if (!ticket) return json({ error: 'ticket_invalid' }, 400);
        if (!isStrongPassword(password)) return json({ error: 'weak_password' }, 400);

        const hash = await ticketHash('signup', ticket);
        const { data: valid, error: validError } = await admin.rpc('otp_ticket_valid', {
          p_email: email,
          p_purpose: 'signup',
          p_ticket_hash: hash,
        });
        if (validError) throw validError;
        if (!valid) return json({ error: 'ticket_invalid' }, 400);

        // Confirmed from birth: the code already proved the inbox is theirs, so
        // Supabase sends no confirmation email (and no link) of its own.
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { fullName: (body.fullName ?? '').trim().slice(0, 120) },
        });
        if (createError) {
          if (/already|exists|registered/i.test(createError.message)) return json({ error: 'email_taken' }, 409);
          throw createError;
        }

        await admin.rpc('otp_consume_ticket', { p_email: email, p_purpose: 'signup', p_ticket_hash: hash });
        return json({ ok: true, userId: created.user?.id });
      }

      case 'reset': {
        const password = body.password ?? '';
        const ticket = body.ticket ?? '';
        if (!ticket) return json({ error: 'ticket_invalid' }, 400);
        if (!isStrongPassword(password)) return json({ error: 'weak_password' }, 400);

        // Spent before the write, not after: a reset ticket must never work twice.
        const { data: spent, error: spendError } = await admin.rpc('otp_consume_ticket', {
          p_email: email,
          p_purpose: 'reset',
          p_ticket_hash: await ticketHash('reset', ticket),
        });
        if (spendError) throw spendError;
        if (!spent) return json({ error: 'ticket_invalid' }, 400);

        const userId = await userIdFor(email);
        if (!userId) return json({ error: 'ticket_invalid' }, 400);

        // The code proved the inbox too, so an account still waiting on the old
        // confirmation link is confirmed along with the new password.
        const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        });
        if (updateError) {
          if (/password/i.test(updateError.message)) return json({ error: 'weak_password' }, 400);
          throw updateError;
        }

        // Whoever was signed in on the old password is signed out.
        const { error: revokeError } = await admin.rpc('revoke_user_sessions', { p_user_id: userId });
        if (revokeError) console.error('auth-otp: could not revoke sessions', revokeError.message);

        return json({ ok: true });
      }

      default:
        return json({ error: 'invalid_action' }, 400);
    }
  } catch (err) {
    console.error('auth-otp:', (err as Error)?.message ?? err);
    return json({ error: 'server_error' }, 500);
  }
});
