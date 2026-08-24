import type { Gender, ProfileMode, RishtaReadiness } from './user';

// Fields that both the Dating (Discover) and Rishta browsing experiences render
// through the same shared profile-detail UI. Each side only requires the fields
// its own data actually always has (bio/vibeTags for Discover; religion/sect/
// education/familyBackground/readiness for Rishta) — everything else is optional
// and simply doesn't render its section when absent, on either side.
interface BrowseProfileFields {
  bio?: string;
  vibeTags?: string[];
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
  // True while a "Move to Rishta" request has been sent and we're waiting on
  // the simulated counterparty response (this app has no live backend/second
  // user — the response is simulated locally after a short delay).
  rishtaRequestPending?: boolean;
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
  id: string;
  // Links back to the Discover/Rishta listing this block originated from (if any),
  // so Discover/Rishta decks can exclude the profile even though `id` here is the
  // match's own id, not the listing's.
  sourceProfileId?: string;
  name: string;
  photo: string;
  blockedAt: string;
}
