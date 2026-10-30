import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { likesService } from '../services/likesService';
import { useAuth } from '../store/AuthContext';
import { useDialog } from '../store/DialogContext';
import { useLanguage } from '../store/LanguageContext';

// Free members get three trials at who liked them (supabase/61_like_reveals.sql):
// the first three likers come through with name and photo, everyone after that
// stays locked until they upgrade. Explore+ sees everyone. This holds who is
// visible and how many trials are left, and runs every "who liked me?" tap:
// visible → open the profile; locked → offer Explore+.
//
// If the server side isn't deployed yet the state can't load, and everyone is
// treated as visible — the same as before trials existed — rather than locking
// people out of likes they used to be able to see.

export function useLikeReveals() {
  const { user } = useAuth();
  const router = useRouter();
  const { confirm } = useDialog();
  const { t } = useLanguage();
  const plus = Boolean(user?.isExplorePlus);
  const [left, setLeft] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  // Likers the server didn't send at all, as a count for the lock card.
  const [locked, setLocked] = useState(0);
  const [available, setAvailable] = useState(true);
  // False until the first load answers. Before that nobody is known to be
  // visible, and treating them as locked flashed the lock card on every open.
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const state = await likesService.fetchRevealState();
    if (!state) {
      setAvailable(false);
      setLoaded(true);
      return;
    }
    setAvailable(true);
    setLeft(state.left);
    setRevealed(new Set(state.ids));
    setLocked(state.locked);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) void refresh();
    }, [user?.id, refresh])
  );

  // Stable between renders, so screens that memo on it (Notifications'
  // photo and name lookups) only recompute when the answer can change.
  const canSee = useCallback(
    (likerId: string) => plus || !available || revealed.has(likerId),
    [plus, available, revealed]
  );

  /** Opens a liker's profile, or offers Explore+ if they're locked. */
  const openLiker = async (likerId: string, kind: 'dating' | 'rishta') => {
    if (canSee(likerId)) {
      router.push({ pathname: '/profile-detail', params: { kind, id: likerId } });
      return;
    }
    const upgrade = await confirm({
      title: t('reveals.noneLeftTitle'),
      message: t('reveals.noneLeftBody'),
      confirmLabel: t('explorePlus.upgrade'),
      cancelLabel: t('common.cancel'),
    });
    if (upgrade) router.push('/explore-plus');
  };

  /** Whether `canSee` can be trusted yet; screens hold their likes back until it can. */
  const ready = plus || loaded;

  return { plus, left, locked, ready, canSee, openLiker, refresh };
}
