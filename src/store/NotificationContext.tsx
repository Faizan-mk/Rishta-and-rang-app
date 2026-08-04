import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { mockNotifications } from '../data/mockNotifications';
import { DEFAULT_NOTIFICATION_PREFS, NotificationItem, NotificationPrefs } from '../types/content';

interface NotificationContextValue {
  prefs: NotificationPrefs;
  setPref: (key: keyof NotificationPrefs, value: boolean) => void;
  feed: NotificationItem[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [feed, setFeed] = useState<NotificationItem[]>(mockNotifications);

  useEffect(() => {
    storage.getJSON(storage.KEYS.notificationPrefs, DEFAULT_NOTIFICATION_PREFS).then(setPrefs);
    storage.getJSON(storage.KEYS.notificationFeed, mockNotifications).then(setFeed);
  }, []);

  const setPref = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      storage.setJSON(storage.KEYS.notificationPrefs, next);
      return next;
    });
  };

  const markAllRead = () => {
    setFeed((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      storage.setJSON(storage.KEYS.notificationFeed, next);
      return next;
    });
  };

  const markRead = (id: string) => {
    setFeed((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      storage.setJSON(storage.KEYS.notificationFeed, next);
      return next;
    });
  };

  const unreadCount = useMemo(() => feed.filter((n) => !n.read).length, [feed]);

  const value = useMemo(
    () => ({ prefs, setPref, feed, unreadCount, markAllRead, markRead }),
    [prefs, feed, unreadCount]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
