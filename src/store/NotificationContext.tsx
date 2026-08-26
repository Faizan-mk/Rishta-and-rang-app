import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { notificationsService } from '../services/notificationsService';
import { DEFAULT_NOTIFICATION_PREFS, NotificationItem, NotificationPrefs } from '../types/content';
import { useAuth } from './AuthContext';

interface NotificationContextValue {
  prefs: NotificationPrefs;
  setPref: (key: keyof NotificationPrefs, value: boolean) => void;
  feed: NotificationItem[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  addNotification: (type: NotificationItem['type'], title: string, body: string) => void;
}

// Which preference toggle gates each notification type — a disabled toggle means
// events of that type are never added to the feed, not just hidden after the fact.
const PREF_KEY_BY_TYPE: Record<NotificationItem['type'], keyof NotificationPrefs> = {
  match: 'newMatches',
  like: 'likes',
  message: 'messages',
  rishta_request: 'rishtaRequests',
  system: 'productUpdates',
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [feed, setFeed] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) {
      setPrefs(DEFAULT_NOTIFICATION_PREFS);
      setFeed([]);
      return;
    }
    notificationsService.fetchPrefs(user.id).then(setPrefs);
    notificationsService.fetchFeed(user.id).then(setFeed);
  }, [user?.id]);

  const setPref = (key: keyof NotificationPrefs, value: boolean) => {
    if (!user) return;
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      notificationsService.setPref(user.id, next);
      return next;
    });
  };

  const markAllRead = () => {
    if (!user) return;
    setFeed((prev) => prev.map((n) => ({ ...n, read: true })));
    notificationsService.markAllRead(user.id);
  };

  const markRead = (id: string) => {
    if (!user) return;
    setFeed((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    notificationsService.markRead(user.id, id);
  };

  const addNotification = (type: NotificationItem['type'], title: string, body: string) => {
    if (!user || !prefs[PREF_KEY_BY_TYPE[type]]) return;
    notificationsService.addNotification(user.id, type, title, body).then((item) => {
      setFeed((prev) => [item, ...prev]);
    });
  };

  const unreadCount = useMemo(() => feed.filter((n) => !n.read).length, [feed]);

  const value = useMemo(
    () => ({ prefs, setPref, feed, unreadCount, markAllRead, markRead, addNotification }),
    [prefs, feed, unreadCount, user?.id]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
