import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { authService } from '../services/authService';
import { useAuth } from '../store/AuthContext';

// At most one write per this long, and — while the app is open — at least one.
// The badge's finest step is ten minutes, so this keeps a member who is sitting
// in the app comfortably inside "Active now" without writing more often than the
// badge could show.
const MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Keeps `last_active_at` meaning what the badge says it means.
 *
 * It used to be stamped once, on sign-in. On a phone that keeps the app
 * resident that is days from the truth — so "Active today" was really "opened
 * the app at some point", and "Active now" could not have been offered at all.
 * Coming back to the app is the signal, because that is the moment a member is
 * actually looking at it.
 *
 * The write itself decides whether to happen: `touch_last_active` skips a member
 * who has turned "Show when I'm online" off (supabase/34_last_active.sql), so
 * there is nothing to check here.
 */
export function useActivityHeartbeat(): void {
  const { user } = useAuth();
  const lastTouch = useRef(0);

  useEffect(() => {
    if (!user) {
      lastTouch.current = 0;
      return;
    }

    const touch = () => {
      const now = Date.now();
      if (now - lastTouch.current < MIN_INTERVAL_MS) return;
      lastTouch.current = now;
      // Silent: a missed heartbeat costs a slightly stale badge and nothing else.
      authService.touchLastActive(user.id).catch(() => undefined);
    };

    touch();

    // Coming back to the app is one signal; staying in it is the other, and it
    // was the one missing. Without the timer a member reading their matches for
    // half an hour dropped out of "Active now" after ten minutes — while
    // actively using the app, which is the one case the badge exists for.
    const timer = setInterval(touch, MIN_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') touch();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [user?.id]);
}
