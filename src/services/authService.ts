import { supabase } from './supabase';
import { mediaUpload } from './mediaUpload';
import type { AppLanguage, Intent, ProfileMode, UserProfile } from '../types/user';

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
  dob: string;
  gender: UserProfile['gender'];
  city: string;
  intent: Intent;
  language: AppLanguage;
  bio?: string;
  photos?: string[];
  selfieVerified?: boolean;
  selfieUri?: string;
  cnicNumber: string;
  cnicPhotoUri?: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  dob: string;
  gender: UserProfile['gender'];
  city: string;
  bio: string;
  intent: Intent;
  language: AppLanguage;
  active_mode: ProfileMode;
  dating_vibe_tags: string[] | null;
  dating_intention_label: NonNullable<UserProfile['dating']>['intentionLabel'] | null;
  rishta_religion: string;
  rishta_sect: string;
  rishta_family_background: string;
  rishta_education: string;
  rishta_readiness: UserProfile['rishta']['readiness'];
  rishta_prayer_habits: string | null;
  rishta_income_range: string | null;
  rishta_living_abroad: boolean | null;
  height_cm: number | null;
  marital_status: UserProfile['maritalStatus'] | null;
  has_children: boolean | null;
  occupation: string | null;
  practising: boolean | null;
  prayer_habits: string | null;
  halal_only: boolean | null;
  smoking: boolean | null;
  drinking: boolean | null;
  religious_dress: string | null;
  open_to_relocate: boolean | null;
  preferred_country: string | null;
  career_plans: string | null;
  education_level: string | null;
  degree: string | null;
  job_title: string | null;
  industry: string | null;
  languages: string[] | null;
  nationality: string | null;
  grew_up_in: string | null;
  country: string | null;
  selfie_verified: boolean;
  voice_intro_path: string | null;
  voice_intro_duration_sec: number | null;
  video_intro_path: string | null;
  wali_name: string | null;
  wali_contact: string | null;
  wali_invited_at: string | null;
  is_explore_plus: boolean;
  subscription_plan: UserProfile['subscriptionPlan'] | null;
  has_used_trial: boolean;
  subscription_renews_at: string | null;
  created_at: string;
}

interface VerificationRow {
  profile_id: string;
  cnic_number: string | null;
  cnic_photo_path: string | null;
  cnic_verified: boolean;
  bureau_verified: boolean;
  selfie_photo_path: string | null;
}

interface PhotoRow {
  storage_path: string;
  position: number;
}

async function mapToUserProfile(
  row: ProfileRow,
  verification: VerificationRow | null,
  photos: PhotoRow[]
): Promise<UserProfile> {
  const sortedPhotoPaths = [...photos].sort((a, b) => a.position - b.position).map((p) => p.storage_path);
  const cnicPhotoUri = verification?.cnic_photo_path
    ? await mediaUpload.signedVerificationUrl(verification.cnic_photo_path)
    : undefined;

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    dob: row.dob,
    gender: row.gender,
    city: row.city,
    bio: row.bio,
    photos: sortedPhotoPaths.map((path) => mediaUpload.publicUrl(path)),
    selfieVerified: row.selfie_verified,
    intent: row.intent,
    language: row.language,
    activeMode: row.active_mode,
    dating: {
      vibeTags: row.dating_vibe_tags ?? [],
      intentionLabel: row.dating_intention_label ?? undefined,
    },
    rishta: {
      religion: row.rishta_religion,
      sect: row.rishta_sect,
      familyBackground: row.rishta_family_background,
      education: row.rishta_education,
      readiness: row.rishta_readiness,
      prayerHabits: row.rishta_prayer_habits ?? undefined,
      incomeRange: row.rishta_income_range ?? undefined,
      livingAbroad: row.rishta_living_abroad ?? undefined,
    },
    heightCm: row.height_cm ?? undefined,
    maritalStatus: row.marital_status ?? undefined,
    hasChildren: row.has_children ?? undefined,
    occupation: row.occupation ?? undefined,
    practising: row.practising ?? undefined,
    prayerHabits: row.prayer_habits ?? undefined,
    halalOnly: row.halal_only ?? undefined,
    smoking: row.smoking ?? undefined,
    drinking: row.drinking ?? undefined,
    religiousDress: row.religious_dress ?? undefined,
    openToRelocate: row.open_to_relocate ?? undefined,
    preferredCountry: row.preferred_country ?? undefined,
    careerPlans: row.career_plans ?? undefined,
    educationLevel: row.education_level ?? undefined,
    degree: row.degree ?? undefined,
    jobTitle: row.job_title ?? undefined,
    industry: row.industry ?? undefined,
    languages: row.languages ?? undefined,
    nationality: row.nationality ?? undefined,
    grewUpIn: row.grew_up_in ?? undefined,
    country: row.country ?? undefined,
    voiceIntroUri: row.voice_intro_path ? mediaUpload.publicUrl(row.voice_intro_path) : undefined,
    voiceIntroDurationSec: row.voice_intro_duration_sec ?? undefined,
    videoIntroUri: row.video_intro_path ? mediaUpload.publicUrl(row.video_intro_path) : undefined,
    cnicVerified: verification?.cnic_verified ?? false,
    cnicNumber: verification?.cnic_number ?? undefined,
    cnicPhotoUri,
    bureauVerified: verification?.bureau_verified ?? false,
    waliName: row.wali_name ?? undefined,
    waliContact: row.wali_contact ?? undefined,
    waliInvitedAt: row.wali_invited_at ?? undefined,
    isExplorePlus: row.is_explore_plus,
    subscriptionPlan: row.subscription_plan ?? undefined,
    hasUsedTrial: row.has_used_trial,
    subscriptionRenewsAt: row.subscription_renews_at ?? undefined,
    createdAt: row.created_at,
  };
}

async function fetchFullProfile(userId: string): Promise<UserProfile | null> {
  const [profileRes, verificationRes, photosRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle<ProfileRow>(),
    supabase.from('profile_verification').select('*').eq('profile_id', userId).maybeSingle<VerificationRow>(),
    supabase.from('profile_photos').select('storage_path, position').eq('profile_id', userId).returns<PhotoRow[]>(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (!profileRes.data) return null;
  return mapToUserProfile(profileRes.data, verificationRes.data ?? null, photosRes.data ?? []);
}

async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_exists', { check_email: email.trim().toLowerCase() });
  if (error) throw error;
  return Boolean(data);
}

async function signup(input: SignupInput): Promise<UserProfile> {
  const email = input.email.trim().toLowerCase();
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: input.password });
  if (authError) throw new Error(authError.message);

  const userId = authData.user?.id;
  if (!userId || !authData.session) {
    throw new Error('Account created — check your inbox to confirm your email, then log in.');
  }

  const [photoPaths, cnicPhotoPath, selfiePhotoPath] = await Promise.all([
    Promise.all((input.photos ?? []).map((uri) => mediaUpload.uploadPhoto(userId, uri))),
    input.cnicPhotoUri ? mediaUpload.uploadCnicPhoto(userId, input.cnicPhotoUri) : Promise.resolve(null),
    input.selfieUri ? mediaUpload.uploadSelfiePhoto(userId, input.selfieUri) : Promise.resolve(null),
  ]);

  const activeMode: ProfileMode = input.intent === 'matrimonial' ? 'rishta' : 'dating';

  // upsert (not insert): if a prior signup attempt for this same auth user got
  // this far and then failed partway (network drop, app kill), retrying here
  // completes the row instead of dying on a duplicate-key error.
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: input.fullName.trim(),
      email,
      dob: input.dob,
      gender: input.gender,
      city: input.city.trim(),
      bio: input.bio?.trim() ?? '',
      intent: input.intent,
      language: input.language,
      active_mode: activeMode,
      selfie_verified: Boolean(input.selfieVerified),
    },
    { onConflict: 'id' }
  );
  if (profileError) throw profileError;

  await supabase.from('profile_photos').delete().eq('profile_id', userId);
  if (photoPaths.length) {
    const { error: photosError } = await supabase
      .from('profile_photos')
      .insert(photoPaths.map((storage_path, position) => ({ profile_id: userId, storage_path, position })));
    if (photosError) throw photosError;
  }

  const { error: verificationError } = await supabase.from('profile_verification').upsert(
    {
      profile_id: userId,
      cnic_number: input.cnicNumber,
      cnic_photo_path: cnicPhotoPath,
      cnic_verified: true,
      selfie_photo_path: selfiePhotoPath,
    },
    { onConflict: 'profile_id' }
  );
  if (verificationError) throw verificationError;

  const profile = await fetchFullProfile(userId);
  if (!profile) throw new Error('Could not load the account that was just created.');
  return profile;
}

async function login(email: string, password: string): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) throw new Error('Incorrect email or password.');

  const profile = await fetchFullProfile(data.user.id);
  if (!profile) throw new Error('Account data could not be found.');
  return profile;
}

async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

async function getCurrentUser(): Promise<UserProfile | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  return fetchFullProfile(userId);
}

async function updateUser(updated: UserProfile): Promise<UserProfile> {
  const userId = updated.id;

  const { data: existingPhotoRows } = await supabase
    .from('profile_photos')
    .select('storage_path')
    .eq('profile_id', userId)
    .returns<{ storage_path: string }[]>();
  const existingPaths = new Set((existingPhotoRows ?? []).map((r) => r.storage_path));

  const newPhotoPaths = await Promise.all(
    updated.photos.map((uri) =>
      mediaUpload.isLocalUri(uri) ? mediaUpload.uploadPhoto(userId, uri) : mediaUpload.pathFromPublicUrl(uri)
    )
  );

  const videoIntroPath = updated.videoIntroUri
    ? mediaUpload.isLocalUri(updated.videoIntroUri)
      ? await mediaUpload.uploadVideoIntro(userId, updated.videoIntroUri)
      : mediaUpload.pathFromPublicUrl(updated.videoIntroUri)
    : null;

  const voiceIntroPath = updated.voiceIntroUri
    ? mediaUpload.isLocalUri(updated.voiceIntroUri)
      ? await mediaUpload.uploadVoiceIntro(userId, updated.voiceIntroUri)
      : mediaUpload.pathFromPublicUrl(updated.voiceIntroUri)
    : null;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: updated.fullName,
      city: updated.city,
      bio: updated.bio,
      language: updated.language,
      active_mode: updated.activeMode,
      dating_vibe_tags: updated.dating.vibeTags,
      dating_intention_label: updated.dating.intentionLabel ?? null,
      rishta_religion: updated.rishta.religion,
      rishta_sect: updated.rishta.sect,
      rishta_family_background: updated.rishta.familyBackground,
      rishta_education: updated.rishta.education,
      rishta_readiness: updated.rishta.readiness,
      rishta_prayer_habits: updated.rishta.prayerHabits ?? null,
      rishta_income_range: updated.rishta.incomeRange ?? null,
      rishta_living_abroad: updated.rishta.livingAbroad ?? null,
      height_cm: updated.heightCm ?? null,
      marital_status: updated.maritalStatus ?? null,
      has_children: updated.hasChildren ?? null,
      occupation: updated.occupation ?? null,
      practising: updated.practising ?? null,
      prayer_habits: updated.prayerHabits ?? null,
      halal_only: updated.halalOnly ?? null,
      smoking: updated.smoking ?? null,
      drinking: updated.drinking ?? null,
      religious_dress: updated.religiousDress ?? null,
      open_to_relocate: updated.openToRelocate ?? null,
      preferred_country: updated.preferredCountry ?? null,
      career_plans: updated.careerPlans ?? null,
      education_level: updated.educationLevel ?? null,
      degree: updated.degree ?? null,
      job_title: updated.jobTitle ?? null,
      industry: updated.industry ?? null,
      languages: updated.languages ?? null,
      nationality: updated.nationality ?? null,
      grew_up_in: updated.grewUpIn ?? null,
      country: updated.country ?? null,
      selfie_verified: updated.selfieVerified,
      voice_intro_path: voiceIntroPath,
      voice_intro_duration_sec: updated.voiceIntroDurationSec ?? null,
      video_intro_path: videoIntroPath,
      wali_name: updated.waliName ?? null,
      wali_contact: updated.waliContact ?? null,
      wali_invited_at: updated.waliInvitedAt ?? null,
      is_explore_plus: updated.isExplorePlus ?? false,
      subscription_plan: updated.subscriptionPlan ?? null,
      has_used_trial: updated.hasUsedTrial ?? false,
      subscription_renews_at: updated.subscriptionRenewsAt ?? null,
    })
    .eq('id', userId);
  if (profileError) throw profileError;

  if (updated.cnicNumber) {
    // A local cnicPhotoUri means a fresh capture to upload; a remote one is
    // the signed URL we handed back last fetch — leave the stored path alone.
    const cnicPhotoPath =
      updated.cnicPhotoUri && mediaUpload.isLocalUri(updated.cnicPhotoUri)
        ? await mediaUpload.uploadCnicPhoto(userId, updated.cnicPhotoUri)
        : undefined;

    const verificationUpdate: Record<string, unknown> = {
      profile_id: userId,
      cnic_number: updated.cnicNumber,
      cnic_verified: updated.cnicVerified ?? true,
    };
    if (cnicPhotoPath) verificationUpdate.cnic_photo_path = cnicPhotoPath;

    const { error: verificationError } = await supabase
      .from('profile_verification')
      .upsert(verificationUpdate, { onConflict: 'profile_id' });
    if (verificationError) throw verificationError;
  }

  await supabase.from('profile_photos').delete().eq('profile_id', userId);
  if (newPhotoPaths.length) {
    const { error: photosError } = await supabase
      .from('profile_photos')
      .insert(newPhotoPaths.map((storage_path, position) => ({ profile_id: userId, storage_path, position })));
    if (photosError) throw photosError;
  }

  const removedPaths = [...existingPaths].filter((path) => !newPhotoPaths.includes(path));
  if (removedPaths.length) await mediaUpload.removePhotos(removedPaths);

  const profile = await fetchFullProfile(userId);
  if (!profile) throw new Error('Could not reload the updated profile.');
  return profile;
}

async function deleteAccount(userId: string): Promise<void> {
  const { data: photoRows } = await supabase
    .from('profile_photos')
    .select('storage_path')
    .eq('profile_id', userId)
    .returns<{ storage_path: string }[]>();
  const paths = (photoRows ?? []).map((r) => r.storage_path);
  if (paths.length) await mediaUpload.removePhotos(paths);

  // RLS lets the app remove its own profile/verification/photo rows (the
  // profile delete cascades to both), but deleting the auth.users record
  // itself needs the service-role key — that has to happen server-side
  // (an Edge Function or the admin API), not from this client.
  await supabase.from('profiles').delete().eq('id', userId);
  await supabase.auth.signOut();
}

export const authService = { signup, login, logout, getCurrentUser, updateUser, deleteAccount, emailExists };
