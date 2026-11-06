import { useEffect, useState } from 'react';
import { mediaUpload } from '../services/mediaUpload';

// How long a link is reused for. The links themselves last an hour; stopping
// five minutes short means a photo never gets one that dies while it loads.
const REUSE_MS = 55 * 60 * 1000;
const links = new Map<string, { url: string; until: number }>();

function cachedLink(path: string): string | undefined {
  const hit = links.get(path);
  return hit && hit.until > Date.now() ? hit.url : undefined;
}

// What a message row holds is either a path in the private chat-media bucket,
// or, for anything sent before that bucket, a full public URL. An unsent
// message holds a file:// or content:// URI. Only a bare path needs a link.
function isStoragePath(stored: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(stored);
}

/**
 * The URI to play or show a chat photo or voice note from. `uri` is undefined
 * until the signed link arrives, and `failed` is true if there isn't one, such
 * as when the member is offline or is no longer in that match.
 */
export function useChatMediaUri(stored: string): { uri?: string; failed: boolean } {
  const [link, setLink] = useState<{ path: string; url?: string; failed: boolean } | null>(null);

  useEffect(() => {
    if (!isStoragePath(stored) || cachedLink(stored)) return;
    let cancelled = false;
    void mediaUpload.chatMediaUrl(stored).then((url) => {
      if (url) links.set(stored, { url, until: Date.now() + REUSE_MS });
      if (!cancelled) setLink({ path: stored, url, failed: !url });
    });
    return () => {
      cancelled = true;
    };
  }, [stored]);

  if (!isStoragePath(stored)) return { uri: stored, failed: false };
  const cached = cachedLink(stored);
  if (cached) return { uri: cached, failed: false };
  return link?.path === stored ? { uri: link.url, failed: link.failed } : { failed: false };
}
