import type { Gender, ProfileMode, RishtaReadiness } from './user';

export interface DiscoverProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  city: string;
  bio: string;
  vibeTags: string[];
  photos: string[];
}

export interface RishtaListingProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  city: string;
  religion: string;
  sect: string;
  education: string;
  familyBackground: string;
  readiness: RishtaReadiness;
  photos: string[];
}

export interface Match {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  mode: ProfileMode;
  movedToRishta: boolean;
  // Links back to the Discover/Rishta listing this match was created from, so
  // "Message" on a profile can find (or create) the same match instead of duplicating it.
  sourceProfileId?: string;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  fromMe: boolean;
  text: string;
  sentAt: string;
}

export type NotificationType = 'match' | 'like' | 'message' | 'rishta_request' | 'system';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationPrefs {
  newMatches: boolean;
  messages: boolean;
  likes: boolean;
  rishtaRequests: boolean;
  productUpdates: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newMatches: true,
  messages: true,
  likes: true,
  rishtaRequests: true,
  productUpdates: false,
};
