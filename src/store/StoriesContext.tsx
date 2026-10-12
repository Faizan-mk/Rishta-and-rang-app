import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { storiesService } from '../services/storiesService';
import type { Story, StoryGroup } from '../types/content';
import { useAuth } from './AuthContext';

interface StoriesContextValue {
  // The member's own stories, if they have any up.
  mine: StoryGroup | null;
  // Everyone else's, in strip order: unseen first, newest first.
  others: StoryGroup[];
  posting: boolean;
  refresh: () => Promise<void>;
  post: (localUri: string, mediaType: 'image' | 'video', mimeType?: string | null, durationSec?: number) => Promise<void>;
  markSeen: (story: Story) => void;
  remove: (story: Story) => Promise<void>;
}

const StoriesContext = createContext<StoriesContextValue | undefined>(undefined);

export function StoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<StoryGroup | null>(null);
  const [others, setOthers] = useState<StoryGroup[]>([]);
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const feed = await storiesService.fetchFeed(user.id);
      setMine(feed.mine);
      setOthers(feed.others);
    } catch {
      // Offline: keep whatever is on screen.
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setMine(null);
      setOthers([]);
      return;
    }
    storiesService.purgeExpired();
    refresh();
    // Stories come and go by the hour, so coming back to the app is the moment
    // to pick up new ones and drop expired ones.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [user?.id, refresh]);

  const post = useCallback<StoriesContextValue['post']>(
    async (localUri, mediaType, mimeType, durationSec) => {
      if (!user) return;
      setPosting(true);
      try {
        await storiesService.postStory(user.id, localUri, mediaType, mimeType, durationSec);
        await refresh();
      } finally {
        setPosting(false);
      }
    },
    [user?.id, refresh]
  );

  // Optimistic: the ring greys out as soon as the story is watched, and the
  // write follows in the background.
  const markSeen = useCallback(
    (story: Story) => {
      if (!user || story.seen || story.userId === user.id) return;
      setOthers((prev) =>
        prev.map((group) => {
          if (group.userId !== story.userId) return group;
          const stories = group.stories.map((s) => (s.id === story.id ? { ...s, seen: true } : s));
          return { ...group, stories, allSeen: stories.every((s) => s.seen) };
        })
      );
      storiesService.markSeen(story.id, user.id).catch(() => undefined);
    },
    [user?.id]
  );

  const remove = useCallback(
    async (story: Story) => {
      await storiesService.deleteStory(story);
      setMine((prev) => {
        if (!prev) return prev;
        const stories = prev.stories.filter((s) => s.id !== story.id);
        return stories.length ? { ...prev, stories } : null;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ mine, others, posting, refresh, post, markSeen, remove }),
    [mine, others, posting, refresh, post, markSeen, remove]
  );

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>;
}

export function useStories(): StoriesContextValue {
  const ctx = useContext(StoriesContext);
  if (!ctx) throw new Error('useStories must be used within a StoriesProvider');
  return ctx;
}
