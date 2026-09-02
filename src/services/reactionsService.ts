import { supabase } from './supabase';
import type { MessageReaction } from '../types/content';

interface ReactionDoc {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

const REACTION_SELECT: string = 'id, messageId:message_id, userId:user_id, emoji, createdAt:created_at';

/** A `message_reactions` row (snake_case, from PostgreSQL/Realtime) → MessageReaction. */
export function rowToReaction(row: Record<string, unknown>): MessageReaction {
  return {
    id: String(row.id),
    messageId: String(row.message_id),
    userId: String(row.user_id),
    emoji: String(row.emoji),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

function mapDoc(data: ReactionDoc): MessageReaction {
  return {
    id: data.id,
    messageId: data.messageId,
    userId: data.userId,
    emoji: data.emoji,
    createdAt: data.createdAt,
  };
}

/**
 * Every reaction the signed-in member can see, keyed by message.
 *
 * No `profile_id` filter: `message_reactions` has no owner column of its own —
 * RLS narrows the read to reactions on messages this account owns, so the
 * unfiltered select is already the right set.
 */
async function fetchReactions(): Promise<Record<string, MessageReaction[]>> {
  const { data, error } = await supabase
    .from('message_reactions')
    .select(REACTION_SELECT)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const byMessage: Record<string, MessageReaction[]> = {};
  for (const row of data ?? []) {
    const reaction = mapDoc(row as unknown as ReactionDoc);
    (byMessage[reaction.messageId] ??= []).push(reaction);
  }
  return byMessage;
}

async function addReaction(userId: string, messageId: string, emoji: string): Promise<MessageReaction> {
  const { data, error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji })
    .select(REACTION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  // The saved row, not the payload: only it carries the database-generated id
  // the Realtime channel de-dupes on.
  return mapDoc(data as unknown as ReactionDoc);
}

async function removeReaction(userId: string, messageId: string, emoji: string): Promise<void> {
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji);
  if (error) throw new Error(error.message);
}

export const reactionsService = {
  fetchReactions,
  addReaction,
  removeReaction,
};
