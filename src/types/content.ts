import type { Gender, Intent, ProfileMode, RishtaReadiness } from './user';

// Fields that both the Dating (Discover) and Rishta browsing experiences render
// through the same shared profile-detail UI. Each side only requires the fields
// its own data actually always has (bio/vibeTags for Discover; religion/sect/
// education/familyBackground/readiness for Rishta) — everything else is optional
// and simply doesn't render its section when absent, on either side.
interface BrowseProfileFields {
  // What the member said they're here for at sign-up (casual / serious / matrimonial).
  intent?: Intent;
  bio?: string;
  vibeTags?: string[];
  // Muzz-style profile chips. `interests` falls back to `vibeTags` when a record
  // predates the split; `personality` has no fallback and simply hides its section.
  interests?: string[];
  personality?: string[];
  // Straight-line distance from the signed-in user, when the backend can work it
  // out. Absent for demo/legacy records — the card then shows city/country only.
  distanceKm?: number;
  lastActiveAt?: string;
  // When the member signed up, for the "Just joined" sort.
  joinedAt?: string;
  bureauVerified?: boolean;
  photosBlurred?: boolean;
  selfieVerified?: boolean;
  voiceIntroUri?: string;
  voiceIntroDurationSec?: number;
  videoIntroUri?: string;
  // About me
  heightCm?: number;
  maritalStatus?: 'single' | 'divorced' | 'widowed';
  hasChildren?: boolean;
  occupation?: string;
  // Marriage intentions
  readiness?: RishtaReadiness;
  // Faith
  religion?: string;
  sect?: string;
  practising?: boolean;
  prayerHabits?: string;
  halalOnly?: boolean;
  smoking?: boolean;
  drinking?: boolean;
  religiousDress?: string;
  // Future plans
  openToRelocate?: boolean;
  preferredCountry?: string;
  careerPlans?: string;
  // Education & career — `education` is Rishta's single free-text field;
  // `educationLevel`/`degree` are Dating's split fields. Sections check both.
  education?: string;
  educationLevel?: string;
  degree?: string;
  jobTitle?: string;
  industry?: string;
  // Languages & background
  languages?: string[];
  nationality?: string;
  grewUpIn?: string;
  country?: string;
  // Rishta-specific narrative field, rendered like a second bio when present.
  familyBackground?: string;
}

export interface DiscoverProfile extends BrowseProfileFields {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  city: string;
  bio: string;
  vibeTags: string[];
  photos: string[];
}

export interface RishtaListingProfile extends BrowseProfileFields {
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

// The minimal shape the shared profile-detail UI (hero card, detail sections,
// actions footer) actually reads — both DiscoverProfile and RishtaListingProfile
// structurally satisfy this.
export type BrowseProfile = BrowseProfileFields & {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  city: string;
  photos: string[];
};

export interface Match {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  mode: ProfileMode;
  movedToRishta: boolean;
  // A "Move to Rishta" request is pending on the shared row. Which side of it
  // this member is on decides what they see: the requester waits, the other
  // gets Accept / Decline (supabase/28_rishta_request.sql).
  rishtaRequestPending?: boolean;
  rishtaRequestIncoming?: boolean;
  // Links back to the Discover/Rishta listing this match was created from, so
  // "Message" on a profile can find (or create) the same match instead of duplicating it.
  sourceProfileId?: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  city: string;
  dateLabel: string;
  description: string;
  image: string;
}

export type ChatMessageKind = 'text' | 'voice' | 'image';

export interface ChatMessage {
  id: string;
  matchId: string;
  fromMe: boolean;
  text: string;
  sentAt: string;
  kind?: ChatMessageKind;
  audioUri?: string;
  durationSec?: number;
  imageUri?: string;
}

// A single emoji one person put on one message. Reactions are stored apart from
// the message so a reaction never rewrites the message row (and so Realtime can
// stream them on their own).
export interface MessageReaction {
  id: string;
  messageId: string;
  // Who reacted. Today that is always the signed-in member — this app mirrors
  // each side of a thread into its own rows and has no cross-user write path.
  userId: string;
  emoji: string;
  createdAt: string;
}

// The emoji offered by the long-press picker on a message bubble.
export const REACTION_EMOJIS = ['❤️', '😂', '😍', '👍', '😢', '🙏'] as const;

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

export interface PrivacyPrefs {
  profileVisible: boolean;
  onlineStatusVisible: boolean;
  blurPhotos: boolean;
}

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  profileVisible: true,
  onlineStatusVisible: true,
  blurPhotos: false,
};

export interface FavoriteProfile {
  id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
}

export interface ViewedProfile {
  id: string;
  kind: ProfileMode;
  name: string;
  age: number;
  city: string;
  photo: string;
  viewedAt: string;
}

export interface BlockedProfile {
  // The blocked person's account id — the same id their profile has in Discover
  // and Rishta. It used to be the match row's id, which meant nothing to the
  // other side and nothing across a second match row; see
  // supabase/22_block_hardening.sql for the migration.
  id: string;
  name: string;
  photo: string;
  blockedAt: string;
}
