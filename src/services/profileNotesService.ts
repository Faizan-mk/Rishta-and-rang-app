import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// The "Send salaam" box a full profile ends with
// (src/components/discover/ProfileActionsFooter.tsx) — a short note sent
// before a match exists.
//
// It cannot land in `chat_messages` yet: `messages_insert` requires an
// existing `matches` row, which is exactly the point — a stranger should not
// be able to put a message in front of someone who has not matched with
// them. `send_profile_note` (supabase/41_profile_notes.sql) holds it instead.
// If a match later forms, `like_profile` delivers it into that thread as the
// conversation's opening message; if it never does, it is never seen. The
// screen's own copy says exactly this: "{name} will see your message if you
// match."
// ---------------------------------------------------------------------------

async function sendNote(targetId: string, text: string): Promise<void> {
  const { error } = await supabase.rpc('send_profile_note', { p_target: targetId, p_text: text });
  if (error) throw new Error(error.message);
}

export const profileNotesService = { sendNote };
