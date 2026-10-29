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
  const [available, setAvailable] = useState(true);

  const refresh = useCallback(async () => {
    const state = await likesService.fetchRevealState();
    if (!state) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    setLeft(state.left);
    setRevealed(new Set(state.ids));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) void refresh();
    }, [user?.id, refresh])
  );

  const canSee = (likerId: string) => plus || !available || revealed.has(likerId);

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

  return { plus, left, canSee, openLiker, refresh };
}
