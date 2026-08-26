import { addDoc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { notificationDoc, notificationPrefsDoc, notificationsCollection } from './firestorePaths';
import { DEFAULT_NOTIFICATION_PREFS, NotificationItem, NotificationPrefs } from '../types/content';

interface NotificationDoc {
  type: NotificationItem['type'];
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

function mapNotification(id: string, data: NotificationDoc): NotificationItem {
  return { id, type: data.type, title: data.title, body: data.body, createdAt: data.createdAt, read: data.read };
}

async function fetchFeed(profileId: string): Promise<NotificationItem[]> {
  const snap = await getDocs(query(notificationsCollection(profileId), orderBy('createdAt', 'desc')));
  return snap.docs.map((entry) => mapNotification(entry.id, entry.data() as NotificationDoc));
}

async function fetchPrefs(profileId: string): Promise<NotificationPrefs> {
  const snap = await getDoc(notificationPrefsDoc(profileId));
  if (!snap.exists()) return DEFAULT_NOTIFICATION_PREFS;
  const data = snap.data() as Partial<NotificationPrefs>;
  return { ...DEFAULT_NOTIFICATION_PREFS, ...data };
}

async function setPref(profileId: string, next: NotificationPrefs): Promise<void> {
  await setDoc(notificationPrefsDoc(profileId), next);
}

async function addNotification(
  profileId: string,
  type: NotificationItem['type'],
  title: string,
  body: string
): Promise<NotificationItem> {
  const data: NotificationDoc = { type, title, body, createdAt: new Date().toISOString(), read: false };
  const ref = await addDoc(notificationsCollection(profileId), data);
  return mapNotification(ref.id, data);
}

async function markAllRead(profileId: string): Promise<void> {
  const snap = await getDocs(notificationsCollection(profileId));
  const unread = snap.docs.filter((entry) => !(entry.data() as NotificationDoc).read);
  if (!unread.length) return;

  // Firestore has no "update where"; batch the individual writes instead.
  // 500 is the hard per-batch limit.
  for (let i = 0; i < unread.length; i += 500) {
    const batch = writeBatch(db);
    for (const entry of unread.slice(i, i + 500)) batch.update(entry.ref, { read: true });
    await batch.commit();
  }
}

async function markRead(profileId: string, id: string): Promise<void> {
  await updateDoc(notificationDoc(profileId, id), { read: true });
}

export const notificationsService = { fetchFeed, fetchPrefs, setPref, addNotification, markAllRead, markRead };
