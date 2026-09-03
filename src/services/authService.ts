import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { mediaUpload } from './mediaUpload';
import { AppError } from '../utils/appError';
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

/**
 * The publicly discoverable half of a member (the `profiles` table). Any
 * signed-in user may read these rows (see supabase/2_profiles.sql RLS) — this is the
 * Postgres equivalent of the `discover_profiles` view, so nothing sensitive
 * belongs here. Email, CNIC and wali contact live in the owner-only
 * `profile_private` / `profile_verification` tables instead.
 */
export interface ProfileDoc {
  id: string;
  fullName: string;
  dob: string;
  gender: UserProfile['gender'];
  city: string;
  bio: string;
  intent: Intent;
  language: AppLanguage;
  activeMode: ProfileMode;
  datingVibeTags: string[] | null;
  datingIntentionLabel: NonNullable<UserProfile['dating']>['intentionLabel'] | null;
  rishtaReligion: string;
  rishtaSect: string;
  rishtaFamilyBackground: string;
  rishtaEducation: string;
  rishtaReadiness: UserProfile['rishta']['readiness'];
  rishtaPrayerHabits: string | null;
  rishtaIncomeRange: string | null;
  rishtaLivingAbroad: boolean | null;
  heightCm: number | null;
  maritalStatus: UserProfile['maritalStatus'] | null;
  hasChildren: boolean | null;
  occupation: string | null;
  practising: boolean | null;
  prayerHabits: string | null;
  halalOnly: boolean | null;
  smoking: boolean | null;
  drinking: boolean | null;
  religiousDress: string | null;
  openToRelocate: boolean | null;
  preferredCountry: string | null;
  careerPlans: string | null;
  educationLevel: string | null;
  degree: string | null;
  jobTitle: string | null;
  industry: string | null;
  languages: string[] | null;
  nationality: string | null;
  grewUpIn: string | null;
  country: string | null;
  selfieVerified: boolean;
  /**
   * Just the badge, not the CNIC record behind it: other members have to be able
   * to see that a profile is bureau-verified, and `profile_verification` is
   * owner-only. The number and photo stay in that private table.
   */
  bureauVerified: boolean;
  /** Last time this member opened the app — drives the activity badge and sorts. */
  lastActiveAt: string | null;
  /** Ordered public URLs — the replaced `profile_photos` rows. */
  photos: string[];
  voiceIntroUrl: string | null;
  voiceIntroDurationSec: number | null;
  videoIntroUrl: string | null;
  waliName: string | null;
  waliInvitedAt: string | null;
  isExplorePlus: boolean;
  subscriptionPlan: UserProfile['subscriptionPlan'] | null;
  hasUsedTrial: boolean;
  subscriptionRenewsAt: string | null;
  createdAt: string;
}

interface PrivateDoc {
  email: string;
  waliContact: string | null;
}

interface VerificationDoc {
  cnicNumber: string | null;
  cnicPhotoPath: string | null;
  cnicVerified: boolean;
  bureauVerified: boolean;
  selfiePhotoPath: string | null;
}

// Every column the app reads off `profiles`, aliased to the camelCase field
// names ProfileDoc / the mapping functions below expect. Kept on one line: the
// supabase-js type parser only understands a single-line select string.
export const PROFILE_SELECT: string =
  'id, fullName:full_name, dob, gender, city, bio, intent, language, activeMode:active_mode, datingVibeTags:dating_vibe_tags, datingIntentionLabel:dating_intention_label, rishtaReligion:rishta_religion, rishtaSect:rishta_sect, rishtaFamilyBackground:rishta_family_background, rishtaEducation:rishta_education, rishtaReadiness:rishta_readiness, rishtaPrayerHabits:rishta_prayer_habits, rishtaIncomeRange:rishta_income_range, rishtaLivingAbroad:rishta_living_abroad, heightCm:height_cm, maritalStatus:marital_status, hasChildren:has_children, occupation, practising, prayerHabits:prayer_habits, halalOnly:halal_only, smoking, drinking, religiousDress:religious_dress, openToRelocate:open_to_relocate, preferredCountry:preferred_country, careerPlans:career_plans, educationLevel:education_level, degree, jobTitle:job_title, industry, languages, nationality, grewUpIn:grew_up_in, country, selfieVerified:selfie_verified, bureauVerified:bureau_verified, lastActiveAt:last_active_at, photos, voiceIntroUrl:voice_intro_url, voiceIntroDurationSec:voice_intro_duration_sec, videoIntroUrl:video_intro_url, waliName:wali_name, waliInvitedAt:wali_invited_at, isExplorePlus:is_explore_plus, subscriptionPlan:subscription_plan, hasUsedTrial:has_used_trial, subscriptionRenewsAt:subscription_renews_at, createdAt:created_at';

export async function fetchProfileRow(userId: string): Promise<ProfileDoc | null> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileDoc | null) ?? null;
}

async function fetchPrivateRow(userId: string): Promise<PrivateDoc | null> {
  const { data, error } = await supabase
    .from('profile_private')
    .select('id, email, waliContact:wali_contact')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PrivateDoc | null) ?? null;
}

async function fetchVerificationRow(userId: string): Promise<VerificationDoc | null> {
  const { data, error } = await supabase
    .from('profile_verification')
    .select(
      'id, cnicNumber:cnic_number, cnicPhotoPath:cnic_photo_path, cnicVerified:cnic_verified, bureauVerified:bureau_verified, selfiePhotoPath:selfie_photo_path'
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as VerificationDoc | null) ?? null;
}

async function mapToUserProfile(
  id: string,
  data: ProfileDoc,
  privateData: PrivateDoc | null,
  verification: VerificationDoc | null
): Promise<UserProfile> {
  const cnicPhotoUri = verification?.cnicPhotoPath
    ? await mediaUpload.verificationUrl(verification.cnicPhotoPath)
    : undefined;

  return {
    id,
    fullName: data.fullName,
    email: privateData?.email ?? '',
    dob: data.dob,
    gender: data.gender,
    city: data.city,
    bio: data.bio,
    photos: data.photos ?? [],
    selfieVerified: data.selfieVerified,
    intent: data.intent,
    language: data.language,
    activeMode: data.activeMode,
    dating: {
      vibeTags: data.datingVibeTags ?? [],
      intentionLabel: data.datingIntentionLabel ?? undefined,
    },
    rishta: {
      religion: data.rishtaReligion,
      sect: data.rishtaSect,
      familyBackground: data.rishtaFamilyBackground,
      education: data.rishtaEducation,
      readiness: data.rishtaReadiness,
      prayerHabits: data.rishtaPrayerHabits ?? undefined,
      incomeRange: data.rishtaIncomeRange ?? undefined,
      livingAbroad: data.rishtaLivingAbroad ?? undefined,
    },
    heightCm: data.heightCm ?? undefined,
    maritalStatus: data.maritalStatus ?? undefined,
    hasChildren: data.hasChildren ?? undefined,
    occupation: data.occupation ?? undefined,
    practising: data.practising ?? undefined,
    prayerHabits: data.prayerHabits ?? undefined,
    halalOnly: data.halalOnly ?? undefined,
    smoking: data.smoking ?? undefined,
    drinking: data.drinking ?? undefined,
    religiousDress: data.religiousDress ?? undefined,
    openToRelocate: data.openToRelocate ?? undefined,
    preferredCountry: data.preferredCountry ?? undefined,
    careerPlans: data.careerPlans ?? undefined,
    educationLevel: data.educationLevel ?? undefined,
    degree: data.degree ?? undefined,
    jobTitle: data.jobTitle ?? undefined,
    industry: data.industry ?? undefined,
    languages: data.languages ?? undefined,
    nationality: data.nationality ?? undefined,
    grewUpIn: data.grewUpIn ?? undefined,
    country: data.country ?? undefined,
    voiceIntroUri: data.voiceIntroUrl ?? undefined,
    voiceIntroDurationSec: data.voiceIntroDurationSec ?? undefined,
    videoIntroUri: data.videoIntroUrl ?? undefined,
    cnicVerified: verification?.cnicVerified ?? false,
    cnicNumber: verification?.cnicNumber ?? undefined,
    cnicPhotoUri,
    bureauVerified: data.bureauVerified ?? verification?.bureauVerified ?? false,
    waliName: data.waliName ?? undefined,
    waliContact: privateData?.waliContact ?? undefined,
    waliInvitedAt: data.waliInvitedAt ?? undefined,
    isExplorePlus: data.isExplorePlus,
    subscriptionPlan: data.subscriptionPlan ?? undefined,
    hasUsedTrial: data.hasUsedTrial,
    subscriptionRenewsAt: data.subscriptionRenewsAt ?? undefined,
    createdAt: data.createdAt,
  };
}

async function fetchFullProfile(userId: string): Promise<UserProfile | null> {
  const [profile, privateData, verification] = await Promise.all([
    fetchProfileRow(userId),
    fetchPrivateRow(userId),
    fetchVerificationRow(userId),
  ]);
  if (!profile) return null;
  return mapToUserProfile(userId, profile, privateData, verification);
}

/**
 * Best-effort "is this address taken?" check for step 1 of signup. The RPC
 * reads auth.users directly, so (unlike a user-enumeration-resistant
 * lookup) this is reliable. `signup` still catches a concurrent registration
 * either way — this is purely a nicer early warning.
 */
async function emailExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('email_exists', { p_email: email.trim().toLowerCase() });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * What a taken email address actually means for the person typing it.
 *
 *   'free'     nobody has it — carry on.
 *   'resume'   their own half-finished signup: the auth user exists and the
 *              password opens it, but the profile rows never landed. The flow
 *              continues and `signup` fills in what the failed attempt missed.
 *   'taken'    a complete account, or one whose password they don't have.
 *
 * The old check stopped at "does this address exist", which walled off the one
 * case the wall hurt: a member whose signup died between creating the account
 * and writing the profile could never get back in to finish it.
 */
async function inspectEmail(email: string, password: string): Promise<'free' | 'resume' | 'taken'> {
  const normalized = email.trim().toLowerCase();
  if (!(await emailExists(normalized))) return 'free';

  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error || !data.user) return 'taken';

  // A placeholder row doesn't count as a finished account — it is the marker of
  // the very failure this path exists to undo, so it resumes like a missing one.
  const profile = await fetchProfileRow(data.user.id).catch(() => null);
  if (profile && !isPlaceholderProfile(profile, normalized)) {
    // A finished account. Drop the session we just opened so the member stays
    // on the signup screen and sees "already registered" rather than being
    // teleported into the app by a form they were still filling in.
    await supabase.auth.signOut({ scope: 'local' });
    return 'taken';
  }

  // Session left open on purpose — the rest of the flow uploads against it.
  return 'resume';
}

function blankProfileDoc(input: {
  fullName: string;
  dob: string;
  gender: UserProfile['gender'];
  city: string;
  bio?: string;
  intent: Intent;
  language: AppLanguage;
  selfieVerified?: boolean;
  photos: string[];
}): Record<string, unknown> {
  return {
    full_name: input.fullName.trim(),
    dob: input.dob,
    gender: input.gender,
    city: input.city.trim(),
    bio: input.bio?.trim() ?? '',
    intent: input.intent,
    language: input.language,
    active_mode: input.intent === 'matrimonial' ? 'rishta' : 'dating',
    dating_vibe_tags: [],
    dating_intention_label: null,
    rishta_religion: '',
    rishta_sect: '',
    rishta_family_background: '',
    rishta_education: '',
    rishta_readiness: 'browsing',
    rishta_prayer_habits: null,
    rishta_income_range: null,
    rishta_living_abroad: null,
    height_cm: null,
    marital_status: null,
    has_children: null,
    occupation: null,
    practising: null,
    prayer_habits: null,
    halal_only: null,
    smoking: null,
    drinking: null,
    religious_dress: null,
    open_to_relocate: null,
    preferred_country: null,
    career_plans: null,
    education_level: null,
    degree: null,
    job_title: null,
    industry: null,
    languages: null,
    nationality: null,
    grew_up_in: null,
    country: null,
    selfie_verified: Boolean(input.selfieVerified),
    bureau_verified: false,
    last_active_at: new Date().toISOString(),
    photos: input.photos,
    voice_intro_url: null,
    voice_intro_duration_sec: null,
    video_intro_url: null,
    wali_name: null,
    wali_invited_at: null,
    is_explore_plus: false,
    subscription_plan: null,
    has_used_trial: false,
    subscription_renews_at: null,
  };
}

/**
 * The stand-in row `login` seeds when it finds an auth user with no profile —
 * a signup that died between creating the account and writing its rows.
 *
 * Nothing in it came from the member: the name is their email's local part, the
 * date of birth is a sentinel and the gender is 'other'. It exists so they land
 * in the app rather than on a blank screen, and it is meant to be replaced the
 * moment they finish signing up. Kept in one place so `inspectEmail` can
 * recognise its own handiwork and let that signup be finished.
 */
const PLACEHOLDER_DOB = '2000-01-01';

function placeholderNameFor(email: string): string {
  return email.split('@')[0] || 'User';
}

function placeholderProfileDoc(email: string): Record<string, unknown> {
  return blankProfileDoc({
    fullName: placeholderNameFor(email),
    dob: PLACEHOLDER_DOB,
    gender: 'other',
    city: '',
    intent: 'casual',
    language: 'en',
    photos: [],
  });
}

/** True only for a row that `login`'s fallback could have written. */
function isPlaceholderProfile(profile: ProfileDoc, email: string): boolean {
  return (
    profile.dob === PLACEHOLDER_DOB &&
    profile.gender === 'other' &&
    profile.fullName === placeholderNameFor(email) &&
    (profile.photos?.length ?? 0) === 0
  );
}

/** Maps a Supabase signup failure to a dictionary key (see AppError). */
function signupErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as { message?: string })?.message ?? '';
  if (code === 'email_exists' || /already registered/i.test(message)) {
    return 'authErrors.emailTaken';
  }
  if (code === 'weak_password' || message.includes('must be at least')) {
    return 'authErrors.weakPassword';
  }
  if (code === 'invalid_email' || message.toLowerCase().includes('invalid email')) {
    return 'authErrors.invalidEmail';
  }
  return 'authErrors.signupFailed';
}

/**
 * Creates the auth user and leaves a live session behind, or reuses the one an
 * earlier attempt already created.
 *
 * The resume path matters: signup writes an auth user first and the Postgres
 * rows after, so an attempt that died in between leaves an account that can
 * sign in but has no profile. Retrying the form with the same credentials used
 * to bounce off "already registered" forever; now it signs in and the caller
 * finishes the rows it never got to write.
 */
async function createAccount(email: string, input: SignupInput): Promise<string> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { fullName: input.fullName.trim() } },
    });
    if (error) throw error;

    // With enumeration protection on, signing up an address that already exists
    // returns a decoy user with no identities rather than an error.
    const alreadyRegistered = data.user && (data.user.identities?.length ?? 0) === 0;
    if (alreadyRegistered) throw { code: 'email_exists' };

    const createdUserId = data.user?.id;
    if (!createdUserId) throw new AppError('authErrors.signupFailed');

    // With email confirmation turned ON in the dashboard, signUp returns no
    // session yet. The storage uploads below and the profile writes need a
    // live session, so best-effort sign in (works once the address works).
    if (!data.session) {
      const { error: sessionError } = await supabase.auth.signInWithPassword({ email, password: input.password });
      if (sessionError) {
        throw new AppError('authErrors.confirmEmailFirst');
      }
    }
    return createdUserId;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    const message = (err as { message?: string })?.message ?? '';
    if (code === 'email_exists' || /already registered|already been registered/i.test(message)) {
      // Same person retrying their own half-finished signup, or someone typing
      // an address that isn't theirs — the password tells the two apart.
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
      if (!error && data.user) return data.user.id;
    }
    throw new AppError(signupErrorMessage(err));
  }
}

interface SignupMedia {
  photos: string[];
  cnicPhotoPath: string | null;
  selfiePhotoPath: string | null;
}

/**
 * Uploads whatever the member picked, and reports what actually landed.
 *
 * Deliberately non-fatal. These uploads used to run before the profile rows and
 * throw on failure, which registered the auth user and then abandoned the flow
 * — the account existed, the profile didn't, and the member was left on the
 * signup screen with no way in but a fresh login. Photos are re-addable from
 * Edit Profile; being locked out of the app you just signed up for is not.
 */
async function uploadSignupMedia(userId: string, input: SignupInput): Promise<SignupMedia> {
  const settle = <T,>(work: Promise<T>): Promise<T | null> => work.catch(() => null);

  const [photos, cnicPhotoPath, selfiePhotoPath] = await Promise.all([
    Promise.all((input.photos ?? []).map((uri) => settle(mediaUpload.uploadPhoto(userId, uri)))),
    input.cnicPhotoUri ? settle(mediaUpload.uploadCnicPhoto(userId, input.cnicPhotoUri)) : Promise.resolve(null),
    input.selfieUri ? settle(mediaUpload.uploadSelfiePhoto(userId, input.selfieUri)) : Promise.resolve(null),
  ]);

  return { photos: photos.filter((url): url is string => Boolean(url)), cnicPhotoPath, selfiePhotoPath };
}

async function signup(input: SignupInput): Promise<UserProfile> {
  const email = input.email.trim().toLowerCase();
  const userId = await createAccount(email, input);

  // Rows before media. These three writes are what decide whether the member
  // gets into the app at all, so they go first and the (much slower, much more
  // failure-prone) uploads patch themselves in afterwards.
  //
  // Upsert (not insert): if an earlier attempt for this same auth user died
  // partway through (network drop, app kill), retrying completes the rows
  // instead of failing on an already-exists error.
  const [profileResult, privateResult, verificationResult] = await Promise.all([
    supabase
      .from('profiles')
      .upsert({ id: userId, ...blankProfileDoc({ ...input, photos: [] }) }, { onConflict: 'id' }),
    supabase
      .from('profile_private')
      .upsert({ id: userId, email, wali_contact: null } satisfies Record<string, unknown>, { onConflict: 'id' }),
    supabase
      .from('profile_verification')
      .upsert(
        {
          id: userId,
          cnic_number: input.cnicNumber,
          cnic_photo_path: null,
          cnic_verified: true,
          bureau_verified: false,
          selfie_photo_path: null,
        },
        { onConflict: 'id' }
      ),
  ]);

  const writeError = profileResult.error ?? privateResult.error ?? verificationResult.error;
  if (writeError) throw new Error(writeError.message);

  // Uploads run against the fresh session, so storage policies see the right uid.
  const media = await uploadSignupMedia(userId, input);

  if (media.photos.length) {
    await supabase.from('profiles').update({ photos: media.photos }).eq('id', userId);
  }
  if (media.cnicPhotoPath || media.selfiePhotoPath) {
    await supabase
      .from('profile_verification')
      .update({ cnic_photo_path: media.cnicPhotoPath, selfie_photo_path: media.selfiePhotoPath })
      .eq('id', userId);
  }

  const profile = await fetchFullProfile(userId);
  if (!profile) throw new AppError('authErrors.profileLoadFailed');
  return profile;
}

/**
 * The API rejects a token whose `iat`/`exp` don't line up with its own clock
 * ("JWT issued at future" when the Supabase project's clock runs ahead of the
 * gateway's). Sign-in itself has already succeeded by then, so without this the
 * member is left holding a session every query rejects, behind a raw server
 * string that reads like a password problem.
 */
function isJwtClockError(err: unknown): boolean {
  const message = (err as { message?: string })?.message ?? '';
  return /jwt (issued at future|expired)|token used before issued/i.test(message);
}

/** Maps a Supabase sign-in failure to a dictionary key (see AppError). */
function loginErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as { message?: string })?.message ?? '';
  if (code === 'email_not_confirmed' || message.includes('Email not confirmed')) {
    return 'authErrors.emailNotConfirmed';
  }
  if (/invalid login credentials|user not found/i.test(message)) {
    return 'authErrors.invalidCredentials';
  }
  if (code === 'user-disabled' || message.includes('has been disabled')) return 'authErrors.accountDisabled';
  return 'authErrors.invalidCredentials';
}

async function login(email: string, password: string): Promise<UserProfile> {
  const normalized = email.trim().toLowerCase();

  let userId: string;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) throw error;
    userId = data.user.id;
  } catch (err) {
    throw new AppError(loginErrorMessage(err));
  }

  let profile: UserProfile | null;
  try {
    profile = await fetchFullProfile(userId);
  } catch (err) {
    if (!isJwtClockError(err)) throw err;
    // Drop the unusable session so the next attempt starts clean.
    await supabase.auth.signOut({ scope: 'local' });
    throw new AppError('authErrors.clockSkew');
  }

  // Auth user exists but the profile rows don't — a signup that died between
  // account creation and the Postgres writes. Seed a minimal profile so the
  // member isn't stuck at a blank app.
  if (!profile) {
    await Promise.all([
      supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            ...placeholderProfileDoc(normalized),
          },
          { onConflict: 'id' }
        ),
      supabase
        .from('profile_private')
        .upsert({ id: userId, email: normalized, wali_contact: null }, { onConflict: 'id' }),
    ]);
    profile = await fetchFullProfile(userId);
    if (!profile) throw new AppError('authErrors.profileCreateFailed');
  }

  return profile;
}

/** Stamps "seen just now" on the public card. Fire-and-forget on app start. */
async function touchLastActive(userId: string): Promise<void> {
  await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId);
}

async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

async function getCurrentUser(): Promise<UserProfile | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return fetchFullProfile(data.user.id);
}

async function updateUser(updated: UserProfile): Promise<UserProfile> {
  const userId = updated.id;

  const existing = await fetchProfileRow(userId);
  const existingPhotos: string[] = existing?.photos ?? [];

  // Local URIs are fresh picks that need uploading; anything already remote is
  // a public URL we stored last save and can be kept as-is.
  const photoUrls = await Promise.all(
    updated.photos.map((uri) => (mediaUpload.isLocalUri(uri) ? mediaUpload.uploadPhoto(userId, uri) : uri))
  );

  const videoIntroUrl = updated.videoIntroUri
    ? mediaUpload.isLocalUri(updated.videoIntroUri)
      ? await mediaUpload.uploadVideoIntro(userId, updated.videoIntroUri)
      : updated.videoIntroUri
    : null;

  const voiceIntroUrl = updated.voiceIntroUri
    ? mediaUpload.isLocalUri(updated.voiceIntroUri)
      ? await mediaUpload.uploadVoiceIntro(userId, updated.voiceIntroUri)
      : updated.voiceIntroUri
    : null;

  const patch: Record<string, unknown> = {
    full_name: updated.fullName,
    intent: updated.intent,
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
    photos: photoUrls,
    voice_intro_url: voiceIntroUrl,
    voice_intro_duration_sec: updated.voiceIntroDurationSec ?? null,
    video_intro_url: videoIntroUrl,
    wali_name: updated.waliName ?? null,
    wali_invited_at: updated.waliInvitedAt ?? null,
    // The entitlement and badge columns are deliberately absent. `authenticated`
    // has no UPDATE privilege on them since supabase/30_revoke_entitlement_writes.sql,
    // so naming them here — even to write the value they already hold — would
    // fail the whole save. They are set at signup (an insert) and moved only by
    // a server function: grant_explore_plus for the paid tier, the reports
    // trigger for hidden_at.
  };

  const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (updateError) throw new Error(updateError.message);

  const { error: privateError } = await supabase
    .from('profile_private')
    .upsert({ id: userId, email: updated.email, wali_contact: updated.waliContact ?? null }, { onConflict: 'id' });
  if (privateError) throw new Error(privateError.message);

  if (updated.cnicNumber) {
    // A local cnicPhotoUri means a fresh capture to upload; a remote one is the
    // signed URL we handed back last fetch — leave the stored path alone.
    const cnicPhotoPath =
      updated.cnicPhotoUri && mediaUpload.isLocalUri(updated.cnicPhotoUri)
        ? await mediaUpload.uploadCnicPhoto(userId, updated.cnicPhotoUri)
        : undefined;

    const verificationPatch: Record<string, unknown> = {
      id: userId,
      cnic_number: updated.cnicNumber,
      cnic_verified: updated.cnicVerified ?? true,
      bureau_verified: updated.bureauVerified ?? false,
    };
    if (cnicPhotoPath) verificationPatch.cnic_photo_path = cnicPhotoPath;

    const { error: verificationError } = await supabase
      .from('profile_verification')
      .upsert(verificationPatch, { onConflict: 'id' });
    if (verificationError) throw new Error(verificationError.message);
  }

  const removed = existingPhotos.filter((url) => !photoUrls.includes(url));
  if (removed.length) await mediaUpload.removeFiles(removed);

  const profile = await fetchFullProfile(userId);
  if (!profile) throw new AppError('authErrors.profileReloadFailed');
  return profile;
}

/**
 * Supabase cascades: every per-user table has `on delete cascade` on its FK to
 * auth.users, and `delete_account()` removes the auth user itself (it runs as
 * the function owner, so RLS can't block it). One call clears the whole
 * account — the old per-subcollection cleanup is no longer needed.
 */
async function deleteAccount(userId: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const current = data.user;
  if (!current || current.id !== userId) throw new AppError('authErrors.notSignedIn');

  // Public media on the card is stored outside Postgres, so it has to go first
  // (while the session is still valid for the storage policies).
  const profile = await fetchProfileRow(userId);
  const photos: string[] = profile?.photos ?? [];
  if (photos.length) await mediaUpload.removeFiles(photos);

  const { error } = await supabase.rpc('delete_account');
  if (error) throw new Error(error.message);
}

/**
 * Single-field write for the dating/rishta toggle.
 *
 * Going through `updateUser` for this costs a read, a re-upload sweep and a
 * full reload — enough that the toggle visibly lagged behind the tap. One
 * `update` on `profiles` is all it needs.
 */
async function setActiveMode(userId: string, mode: ProfileMode): Promise<void> {
  await supabase.from('profiles').update({ active_mode: mode }).eq('id', userId);
}

/**
 * One-field writes for the taps that must feel instant. Going through updateUser
 * would re-upload photos and rewrite every field just to change one enum.
 */
async function setIntent(userId: string, intent: Intent, activeMode: ProfileMode): Promise<void> {
  await supabase.from('profiles').update({ intent, active_mode: activeMode }).eq('id', userId);
}

async function setReadiness(userId: string, readiness: UserProfile['rishta']['readiness']): Promise<void> {
  await supabase.from('profiles').update({ rishta_readiness: readiness }).eq('id', userId);
}

// Sends the Supabase "reset password" email. Deliberately quiet about whether
// the address is registered — telling an anonymous caller which emails have
// accounts is an account-enumeration leak.
async function requestPasswordReset(email: string): Promise<void> {
  // Expo Go builds this from the dev server's LAN address, so it changes with
  // the network — and Supabase silently falls back to the project's Site URL for
  // any redirect that is not on its allow-list, which is what sends the tap to a
  // dead localhost page instead of the app. Printing it here is the only way to
  // copy the exact string the allow-list needs.
  const redirectTo = Linking.createURL('/reset-password');
  if (__DEV__) console.log('[password reset] redirectTo =', redirectTo);
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error && error.status !== 400 && error.status !== 422) throw error;
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/**
 * Every parameter a reset link carries, read from the query string and the
 * fragment alike. Which of the two holds the credential depends on the flow the
 * client is configured for — the implicit flow puts access_token/refresh_token
 * after the '#', PKCE puts a code in the query — so reading both means the reset
 * keeps working if that setting ever changes.
 */
function linkParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const collect = (query: string) => {
    for (const pair of query.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = decodeParam(eq === -1 ? pair : pair.slice(0, eq));
      if (key) params[key] = eq === -1 ? '' : decodeParam(pair.slice(eq + 1));
    }
  };
  const hash = url.indexOf('#');
  if (hash !== -1) collect(url.slice(hash + 1));
  const path = hash === -1 ? url : url.slice(0, hash);
  const question = path.indexOf('?');
  if (question !== -1) collect(path.slice(question + 1));
  return params;
}

/**
 * Turns a tapped reset link into a live session — the authority updatePassword
 * needs to write a new password for an account nobody can currently log into.
 *
 * The session this leaves behind is an ordinary one, which is why the reset
 * screen sits outside the signed-out route group: the moment this resolves, the
 * rest of the app counts the visitor as signed in.
 */
async function openPasswordResetLink(url: string): Promise<void> {
  const params = linkParams(url);

  // An expired or already-spent link is reported by redirecting with the reason
  // attached, not by failing the request — so this is checked before the rest.
  if (params.error || params.error_code) {
    // Supabase attaches its own reason on the redirect; keep it when present.
    if (params.error_description) throw new Error(params.error_description);
    throw new AppError('authErrors.resetLinkExpired');
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(error.message);
    return;
  }

  if (params.token_hash) {
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: params.token_hash });
    if (error) throw new Error(error.message);
    return;
  }

  // On web, detectSessionInUrl consumes the fragment before this runs, so a link
  // with nothing left on it is still good if it left a session behind.
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new AppError('authErrors.resetLinkSpent');
  }
}

/**
 * Writes the new password against whatever session is live — the recovery one
 * the link established, or an ordinary one for a password change made while
 * signed in. This is the call that lands the change in the database.
 */
async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export const authService = {

  touchLastActive,
  setIntent,
  setReadiness,
  signup,
  login,
  logout,
  getCurrentUser,
  updateUser,
  setActiveMode,
  deleteAccount,
  emailExists,
  inspectEmail,
  requestPasswordReset,
  openPasswordResetLink,
  updatePassword,
};