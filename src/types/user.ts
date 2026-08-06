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
  subscriptionPlan?: 'monthly' | 'yearly';
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
