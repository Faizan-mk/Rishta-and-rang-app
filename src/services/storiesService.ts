import { supabase } from './supabase';
import { mediaUpload } from './mediaUpload';
import type { Story, StoryGroup, StoryViewer } from '../types/content';

// ---------------------------------------------------------------------------
// Stories: a photo or short video a member shares for 24 hours, seen only by
// the people they are matched with. Who may see what, and the 24-hour expiry,
// are enforced by supabase/46_stories.sql; this file only reads and writes.
// ---------------------------------------------------------------------------

// The longest video a story may hold, in seconds. The database allows a
// little headroom over this (46_stories.sql) for rounding.
export const MAX_STORY_VIDEO_SEC = 30;

interface FeedRow {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration_sec: number | null;
  created_at: string;
  expires_at: string;
  owner_name: string;
  owner_photo: string;
  seen: boolean;
  view_count: number;
  liked: boolean;
  like_count: number;
}

/**
 * Every live story the member may see, grouped by person.
 *
 * Within a group stories play oldest first. The groups themselves are ordered
 * the way the strip shows them: anyone with something unseen first, then the
 * rest, newest story first within each half. The member's own group is
 * returned separately, since it always leads the strip.
 */
async function fetchFeed(myId: string): Promise<{ mine: StoryGroup | null; others: StoryGroup[] }> {
  const { data, error } = await supabase.rpc('story_feed');
  if (error) throw new Error(error.message);

  const groups = new Map<string, StoryGroup>();
  for (const row of (data ?? []) as FeedRow[]) {
    const story: Story = {
      id: row.id,
      userId: row.user_id,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      durationSec: row.duration_sec ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      seen: row.seen,
      viewCount: row.view_count,
      liked: row.liked,
      likeCount: row.like_count,
    };
    const group = groups.get(row.user_id);
    if (group) {
      group.stories.push(story);
      group.latestAt = row.created_at;
      group.allSeen = group.allSeen && row.seen;
    } else {
      groups.set(row.user_id, {
        userId: row.user_id,
        name: row.owner_name,
        photo: row.owner_photo,
        stories: [story],
        allSeen: row.seen,
        latestAt: row.created_at,
      });
    }
  }

  const mine = groups.get(myId) ?? null;
  groups.delete(myId);
  const others = [...groups.values()].sort((a, b) => {
    if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
    return b.latestAt.localeCompare(a.latestAt);
  });
  return { mine, others };
}

async function postStory(
  userId: string,
  localUri: string,
  mediaType: 'image' | 'video',
  mimeType?: string | null,
  durationSec?: number
): Promise<void> {
  const mediaUrl = await mediaUpload.uploadStoryMedia(userId, localUri, mimeType);
  const { error } = await supabase.from('stories').insert({
    user_id: userId,
    media_url: mediaUrl,
    media_type: mediaType,
    duration_sec: mediaType === 'video' && durationSec ? Math.round(durationSec * 10) / 10 : null,
  });
  if (error) {
    // The row never landed, so nobody can reach the file. Don't leave it behind.
    await mediaUpload.removeFiles([mediaUrl]);
    throw new Error(error.message);
  }
}

// A repeat view hits the primary key, which is fine: it was already counted.
async function markSeen(storyId: string, viewerId: string): Promise<void> {
  const { error } = await supabase
    .from('story_views')
    .upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

// Like or unlike someone else's story (supabase/49_story_likes.sql). Liking
// twice hits the primary key, which is fine: it already counts.
async function setLiked(storyId: string, userId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase
        .from('story_likes')
        .upsert({ story_id: storyId, user_id: userId }, { onConflict: 'story_id,user_id', ignoreDuplicates: true })
    : await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

async function fetchViewers(storyId: string): Promise<StoryViewer[]> {
  const { data, error } = await supabase.rpc('story_viewers', { p_story_id: storyId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { viewer_id: string; name: string; photo: string; viewed_at: string; liked: boolean }[]).map((r) => ({
    id: r.viewer_id,
    name: r.name,
    photo: r.photo,
    viewedAt: r.viewed_at,
    liked: r.liked,
  }));
}

async function deleteStory(story: Story): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', story.id);
  if (error) throw new Error(error.message);
  await mediaUpload.removeFiles([story.mediaUrl]);
}

// Expired stories are already hidden from everyone; this reclaims their rows
// and files. Best-effort, run quietly whenever the member's stories load.
async function purgeExpired(): Promise<void> {
  const { data, error } = await supabase.rpc('purge_my_expired_stories');
  if (error) return;
  await mediaUpload.removeFiles((data ?? []) as string[]);
}

// Who among the member's connections sees their stories
// (supabase/47_story_privacy.sql). 'all' when they have never chosen.
export type StoryAudience = 'all' | 'dating' | 'rishta';

async function fetchPrivacy(userId: string): Promise<{ audience: StoryAudience; hidden: string[] }> {
  const [settings, hidden] = await Promise.all([
    supabase.from('story_settings').select('audience').eq('user_id', userId).maybeSingle(),
    supabase.from('story_hidden').select('hidden_user_id').eq('owner_id', userId),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  if (hidden.error) throw new Error(hidden.error.message);
  return {
    audience: (settings.data?.audience as StoryAudience | undefined) ?? 'all',
    hidden: (hidden.data ?? []).map((r) => r.hidden_user_id as string),
  };
}

async function setAudience(userId: string, audience: StoryAudience): Promise<void> {
  const { error } = await supabase
    .from('story_settings')
    .upsert({ user_id: userId, audience, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

async function setHidden(userId: string, hiddenUserId: string, hidden: boolean): Promise<void> {
  const { error } = hidden
    ? await supabase
        .from('story_hidden')
        .upsert({ owner_id: userId, hidden_user_id: hiddenUserId }, { onConflict: 'owner_id,hidden_user_id', ignoreDuplicates: true })
    : await supabase.from('story_hidden').delete().eq('owner_id', userId).eq('hidden_user_id', hiddenUserId);
  if (error) throw new Error(error.message);
}

export const storiesService = {
  fetchFeed,
  postStory,
  markSeen,
  setLiked,
  fetchViewers,
  deleteStory,
  purgeExpired,
  fetchPrivacy,
  setAudience,
  setHidden,
};
