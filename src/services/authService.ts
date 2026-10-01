import { supabase } from './supabase';
import { mediaUpload } from './mediaUpload';
import { AppError } from '../utils/appError';
import type { AppLanguage, Intent, ProfileMode, UserProfile } from '../types/user';

/**
 * Set for the duration of `inspectEmail`'s trial sign-in.
 *
 * `AuthContext`'s onAuthStateChange listener reacts to every SIGNED_IN event by
 * loading the profile and putting the app in the logged-in state — necessary
 * for a real login, wrong here: this probe signs in only to test a password,
 * on step 1 of signup, before the caller has decided anything. Without this
 * flag the listener fired the instant the probe's `signInWithPassword`
 * resolved and logged the member into whatever account it just opened —
 * including a stranger's fully-registered one — before `inspectEmail` had even
 * finished checking whether the profile was a placeholder, let alone shown
 * "already registered". `createAccount`'s own trial sign-in doesn't need this:
 * it runs inside `signup()`, which `AuthContext.runAuthAction` already guards.
 */
export const authProbeInFlight = { current: false };

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
  /** From `verifyOtp(email, 'signup', code)` — proof the inbox is theirs. Absent
   *  only when resuming an account that already exists (see `inspectEmail`). */
  emailTicket?: string;
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

  // Guarded until this settles — see the comment on `authProbeInFlight`. This
  // is a trial sign-in to test a password, not a real login; the app must not
  // react to it as one.
  authProbeInFlight.current = true;
  try {
    return await inspectEmailAfterProbe(normalized, password);
  } finally {
    authProbeInFlight.current = false;
  }
}

async function inspectEmailAfterProbe(normalized: string, password: string): Promise<'free' | 'resume' | 'taken'> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error || !data.user) return 'taken';

  // A placeholder row doesn't count as a finished account — it is the marker of
  // the very failure this path exists to undo, so it resumes like a missing one.
  // A failed read (RLS/grant misconfiguration, network blip) must NOT be read
  // the same as "no row yet" — that would let anyone who guesses a real
  // member's password in past an unreadable profile as if it were their own
  // dead signup. Fail closed: treat an unreadable profile as taken.
  let profile;
  try {
    profile = await fetchProfileRow(data.user.id);
  } catch {
    await supabase.auth.signOut({ scope: 'local' });
    return 'taken';
  }
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
    last_active_at: new Date().toISOString(),
    photos: input.photos,
    voice_intro_url: null,
    voice_intro_duration_sec: null,
    video_intro_url: null,
    wali_name: null,
    wali_invited_at: null,
    // The entitlement columns are absent on purpose. Every one of them would be
    // written with the value the table already defaults to, and this is an
    // upsert — which Postgres reads as INSERT ... ON CONFLICT DO UPDATE, and so
    // demands UPDATE rights on every column named, even on a first insert that
    // never conflicts. `authenticated` has no UPDATE on them since
    // supabase/30_revoke_entitlement_writes.sql, so naming them here failed the
    // whole signup with "permission denied for table profiles".
    //
    // `selfie_verified` above is the exception: its value comes from the member,
    // so it has to be written. It keeps its UPDATE grant for that reason and is
    // held instead by the pin in 29 — which is what stops it being edited on
    // later, once the row exists.
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

/**
 * Creates the auth user and leaves a live session behind, or reuses the one an
 * earlier attempt already created.
 *
 * The account is created by the auth-otp function, not `supabase.auth.signUp`:
 * the function only does it for a ticket from a correct email code, and marks
 * the address confirmed as it goes — so Supabase sends no confirmation link of
 * its own and the member never has to leave the app.
 *
 * The resume path matters: signup writes an auth user first and the Postgres
 * rows after, so an attempt that died in between leaves an account that can
 * sign in but has no profile. Retrying the form with the same credentials used
 * to bounce off "already registered" forever; now it signs in and the caller
 * finishes the rows it never got to write.
 */
async function createAccount(email: string, input: SignupInput): Promise<string> {
  let created = false;
  if (input.emailTicket) {
    try {
      await callAuthOtp({
        action: 'signup',
        email,
        password: input.password,
        fullName: input.fullName.trim(),
        ticket: input.emailTicket,
      });
      created = true;
    } catch (err) {
      // Already registered falls through to the resume check below; anything
      // else (expired ticket, weak password, server down) is the answer.
      if (!(err instanceof AppError && err.key === 'authErrors.emailTaken')) throw err;
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error || !data.user) {
    if (created) throw new AppError('authErrors.signupFailed');
    // No ticket and no account to resume: the code step was skipped.
    throw new AppError(input.emailTicket ? 'authErrors.emailTaken' : 'authErrors.emailNotVerified');
  }
  if (created) return data.user.id;

  // Same person retrying their own half-finished signup, or someone typing an
  // address that isn't theirs — a matching password alone can't tell the two
  // apart, since it also matches a stranger's account with the same
  // (coincidentally identical) password. Only a placeholder profile — the
  // marker `login` leaves behind for a signup that died before writing its
  // rows — proves it's the former.
  //
  // A failed read must NOT be treated as "no row yet" — fail closed, the same
  // as `inspectEmail`, or an unreadable profile (RLS/grant issue, network blip)
  // would look identical to a genuinely missing one and let the caller in as if
  // this were their own dead signup.
  let profile;
  try {
    profile = await fetchProfileRow(data.user.id);
  } catch {
    await supabase.auth.signOut({ scope: 'local' });
    throw new AppError('authErrors.emailTaken');
  }
  if (!profile || isPlaceholderProfile(profile, email)) {
    return data.user.id;
  }
  await supabase.auth.signOut({ scope: 'local' });
  throw new AppError('authErrors.emailTaken');
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
/**
 * Marks the signed-in member as around, now.
 *
 * Through an RPC rather than a direct update for two reasons: the time is the
 * database's rather than the phone's, and the write is skipped entirely for a
 * member who has turned "Show when I'm online" off
 * (supabase/34_last_active.sql). The `userId` argument is kept for the callers'
 * sake — the function stamps `auth.uid()` and takes no parameters, so it cannot
 * be pointed at anyone else.
 */
async function touchLastActive(userId: string): Promise<void> {
  const { error } = await supabase.rpc('touch_last_active');
  if (!error) return;
  // PGRST202: the function is not in the schema cache, which on a project that
  // has not run supabase/34_last_active.sql yet is simply "not deployed". The
  // direct update is what the app did before, so falling back to it keeps the
  // badge working during a rollout instead of silently never being written.
  // Every other error is left alone — a heartbeat is not worth retrying.
  if (error.code !== 'PGRST202') return;
  await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId);
}

/**
 * Clears "around right now" the instant the app leaves the foreground.
 *
 * `last_active_at` is left untouched — the "today"/"yesterday" tiers still
 * need it — this only clears `is_online` (supabase/43_online_presence.sql),
 * which is the half a chat header's "Online" badge actually reads.
 */
async function touchOffline(userId: string): Promise<void> {
  const { error } = await supabase.rpc('touch_offline');
  if (!error) return;
  if (error.code !== 'PGRST202') return;
  await supabase.from('profiles').update({ is_online: false }).eq('id', userId);
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

// ---------------------------------------------------------------------------
// Email one-time codes (supabase/functions/auth-otp)
//
// Signup and "forgot password" both prove the inbox with a 6-digit code typed
// into the app — no link, no browser, no redirect allow-list. A correct code
// buys a short-lived ticket, and the ticket is what the server accepts for the
// step after: creating the account, or writing the new password.
// ---------------------------------------------------------------------------

export type OtpPurpose = 'signup' | 'reset';

interface OtpErrorPayload {
  error?: string;
  retryAfter?: number;
  remaining?: number;
}

/** Maps the function's error codes to dictionary keys (see AppError). */
function otpError(payload: OtpErrorPayload): AppError {
  switch (payload.error) {
    case 'email_taken':
      return new AppError('authErrors.emailTaken');
    case 'invalid_email':
      return new AppError('authErrors.invalidEmail');
    case 'weak_password':
      return new AppError('signup.passwordRequirementsError');
    case 'cooldown':
      return new AppError('authErrors.otpCooldown', { seconds: payload.retryAfter ?? 60 });
    case 'rate_limited':
      return new AppError('authErrors.otpRateLimited', {
        minutes: Math.max(1, Math.ceil((payload.retryAfter ?? 3600) / 60)),
      });
    case 'send_failed':
      return new AppError('authErrors.otpSendFailed');
    case 'invalid_code':
      return typeof payload.remaining === 'number'
        ? new AppError('authErrors.otpInvalid', { remaining: payload.remaining })
        : new AppError('authErrors.otpInvalidNoCount');
    case 'too_many_attempts':
      return new AppError('authErrors.otpTooManyAttempts');
    case 'code_expired':
      return new AppError('authErrors.otpExpired');
    case 'ticket_invalid':
      return new AppError('authErrors.otpTicketInvalid');
    default:
      return new AppError('common.somethingWentWrong');
  }
}

async function callAuthOtp<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('auth-otp', { body });
  if (!error) return data as T;

  // A non-2xx answer arrives as FunctionsHttpError with the Response on
  // `context`; the function's own error code is in its JSON body.
  let payload: OtpErrorPayload = {};
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (typeof context?.json === 'function') {
    try {
      payload = ((await context.json()) as OtpErrorPayload) ?? {};
    } catch {
      // Not JSON — falls through to the generic message.
    }
  }
  throw otpError(payload);
}

/**
 * Emails a fresh code. Resolves with how many seconds until another may be
 * requested. For 'reset' this succeeds whether or not the address has an
 * account — the function sends nothing for an unknown one, but says so to
 * nobody.
 */
async function requestOtp(email: string, purpose: OtpPurpose, language: AppLanguage): Promise<{ resendIn: number }> {
  const result = await callAuthOtp<{ resendIn?: number }>({
    action: 'request',
    email: email.trim().toLowerCase(),
    purpose,
    language,
  });
  return { resendIn: result?.resendIn ?? 60 };
}

/** Trades a correct code for the ticket the next step needs. */
async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<string> {
  const result = await callAuthOtp<{ ticket?: string }>({
    action: 'verify',
    email: email.trim().toLowerCase(),
    purpose,
    code: code.trim(),
  });
  if (!result?.ticket) throw new AppError('common.somethingWentWrong');
  return result.ticket;
}

/**
 * Writes the new password with a 'reset' ticket. Every existing session on the
 * account is ended server-side; the member signs in afresh with the new one.
 */
async function resetPasswordWithOtp(email: string, ticket: string, newPassword: string): Promise<void> {
  await callAuthOtp({ action: 'reset', email: email.trim().toLowerCase(), ticket, password: newPassword });
}

export const authService = {
  touchLastActive,
  touchOffline,
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
  requestOtp,
  verifyOtp,
  resetPasswordWithOtp,
};