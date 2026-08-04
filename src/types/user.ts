// V1 (active in this build)
export type Intent = 'casual' | 'serious' | 'matrimonial';
export type RishtaReadiness = 'browsing' | 'few_months' | 'ready_now';
export type ProfileMode = 'dating' | 'rishta';
export type Gender = 'male' | 'female' | 'other';
export type AppLanguage = 'en' | 'ur';

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
  // V2 stubs — verification tiers beyond the V1 selfie check.
  cnicVerified?: boolean;
  bureauVerified?: boolean;
  // V1 monetization — the single paid unlock (Explore+ lite) from the roadmap.
  isExplorePlus?: boolean;
  createdAt: string;
}

export interface StoredCredential {
  email: string;
  passwordHash: string;
  userId: string;
}

// Step 1 of signup: account credentials, collected before any personal details.
export interface AccountDraft {
  email: string;
  password: string;
}

// Accumulated across the multi-step signup flow (Account -> Personal -> Intent -> Photos -> Selfie)
// before a single account is created at the end.
export interface OnboardingDraft {
  fullName: string;
  email: string;
  password: string;
  dob: string;
  gender: Gender;
  city: string;
  bio?: string;
  intent?: Intent;
  photos?: string[];
}
