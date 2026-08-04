import type { NotificationItem } from '../types/content';

// Placeholder demo data only — a real backend/push service would populate this feed.
export const mockNotifications: NotificationItem[] = [
  {
    id: 'n1',
    type: 'match',
    title: 'New match!',
    body: 'You and Ayesha liked each other. Say hi 👋',
    createdAt: '2026-08-04T08:10:00.000Z',
    read: false,
  },
  {
    id: 'n2',
    type: 'rishta_request',
    title: 'Move to Rishta request',
    body: 'Mahnoor accepted your request to move to Rishta Mode.',
    createdAt: '2026-08-03T09:05:00.000Z',
    read: false,
  },
  {
    id: 'n3',
    type: 'message',
    title: 'New message from Hamza',
    body: '"What kind of biryani is even the best debate 😂"',
    createdAt: '2026-08-02T21:40:00.000Z',
    read: true,
  },
  {
    id: 'n4',
    type: 'like',
    title: 'Someone liked your profile',
    body: 'Unlock Explore+ to see who liked you.',
    createdAt: '2026-08-02T11:15:00.000Z',
    read: true,
  },
  {
    id: 'n5',
    type: 'system',
    title: 'Welcome to Rishta & Rang',
    body: 'Complete your profile to start getting better matches.',
    createdAt: '2026-08-01T10:00:00.000Z',
    read: true,
  },
];
