import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { pushService, type PushRouting } from '../services/pushService';
import { useAuth } from '../store/AuthContext';

// The launch tap is answered once per app launch. `getLastNotificationResponseAsync`
// keeps handing back the same response for the life of the process, so without
// this a sign-out and back in would re-open a thread from a notification the
// member dealt with an hour ago.
let launchTapHandled = false;

/**
 * Opens what a tapped notification is about.
 *
 * `send-push` already puts the match in every notification's `data`
 * (supabase/functions/send-push), and nothing was reading it: a push about a
 * message opened the app on whichever screen it was last left on, which is the
 * one thing a notification is supposed to save you from.
 *
 * Two paths, because a killed app is not listening when the tap happens: the
 * listener catches taps while the app is alive, and the launch response catches
 * the tap that started it.
 */
export function usePushNavigation(): void {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Every destination is behind the signed-in route group, so a tap that
    // arrives before there is a session has nowhere to go. The launch tap is
    // deliberately left unhandled in that case rather than dropped: it is still
    // waiting when this runs again after sign-in.
    if (!user) return;

    const open = (routing: PushRouting) => {
      // A thread is the destination for anything that happened inside one —
      // a message, and each step of the rishta handshake.
      if (routing.matchId) {
        router.push(`/chat/${routing.matchId}`);
        return;
      }
      // A new match has no thread id in the payload (the function resolves the
      // recipient from the like, not from a match row), so the list is the
      // honest destination. A like belongs to the notifications feed.
      if (routing.event === 'match') router.push('/(tabs)/messages');
      else if (routing.event === 'like') router.push('/notifications');
    };

    if (!launchTapHandled) {
      launchTapHandled = true;
      pushService
        .initialNotificationTap()
        .then((routing) => {
          if (routing) open(routing);
        })
        .catch(() => undefined);
    }

    return pushService.onNotificationTap(open);
  }, [user?.id]);
}
