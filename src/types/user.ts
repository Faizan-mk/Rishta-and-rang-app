// V1 (active in this build)
export type Intent = 'casual' | 'serious' | 'matrimonial';
export type RishtaReadiness = 'browsing' | 'few_months' | 'ready_now';
export type ProfileMode = 'dating' | 'rishta';
export type Gender = 'male' | 'female' | 'other';
export type AppLanguage = 'en' | 'ur' | 'roman';

export interface DatingProfile {
  vibeTags: string[];
  // V2 stub — "Intention Transparency" label, not editable yet in V1 UI.
  intentionLabel?: 'exploring' | 'dating' | 'open_to_marriage';
}

export interface RishtaProfile {
  religion: string;
  sect: string;
  familyBackground: string;
  education: string;
  readiness: RishtaReadiness;
  // V2 stubs — "Extended Matrimonial Profile", collected in UI but held for later use.
  prayerHabits?: string;
  incomeRange?: string;
  livingAbroad?: boolean;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  dob: string;
  gender: Gender;
  city: string;
  bio: string;
  photos: string[];
  selfieVerified: boolean;
  intent: Intent;
  language: AppLanguage;
  dating: DatingProfile;
  rishta: RishtaProfile;
  activeMode: ProfileMode;
  // Extended profile — same field shapes as the browsable Discover/Rishta profile
  // detail sections, so a user's own profile can be edited here and rendered with
  // the exact same section components used to view other people's profiles.
  // About me
  heightCm?: number;
  maritalStatus?: 'single' | 'divorced' | 'widowed';
  hasChildren?: boolean;
  occupation?: string;
  // Faith (beyond rishta.religion/sect, which stay editable from Rishta details)
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
  // Education & career
  educationLevel?: string;
  degree?: string;
  jobTitle?: string;
  industry?: string;
  // Languages & background
  languages?: string[];
  nationality?: string;
  grewUpIn?: string;
  country?: string;
  // Voice/video intro, playable from the profile view mid-photo section.
  voiceIntroUri?: string;
  voiceIntroDurationSec?: number;
  videoIntroUri?: string;
  // Verification tiers beyond the V1 selfie check. CNIC number + photo are collected
  // at signup (see OnboardingDraft) and validated on the spot — cnicVerified is set
  // true at account creation, not via a later profile-section flow.
  cnicVerified?: boolean;
  cnicNumber?: string;
  cnicPhotoUri?: string;
  bureauVerified?: boolean;
  // Wali (guardian) contact invited to oversee rishta-stage activity.
  waliName?: string;
  waliContact?: string;
  waliInvitedAt?: string;
  // V1 monetization — the single paid unlock (Explore+ lite) from the roadmap.
  isExplorePlus?: boolean;
  subscriptionPlan?: 'trial' | 'monthly' | 'yearly';
  hasUsedTrial?: boolean;
  subscriptionRenewsAt?: string;
  createdAt: string;
}

export interface StoredCredential {
  email: string;
  passwordHash: string;
  userId: string;
}

// Accumulated across the 3-step signup flow (Signup [account+personal] -> IntentPhotos -> Selfie)
// before a single account is created at the end.
export interface OnboardingDraft {
  fullName: string;
  email: string;
  password: string;
  dob: string;
  gender: Gender;
  city: string;
  bio?: string;
  cnicNumber: string;
  intent?: Intent;
  photos?: string[];
  cnicPhotoUri?: string;
}
