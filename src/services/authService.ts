import {
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { deleteDoc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from './firebase';
import { mediaUpload } from './mediaUpload';
import {
  privateDoc,
  profileDoc,
  USER_SUBCOLLECTIONS,
  userCollection,
  userDoc,
  verificationDoc,
} from './firestorePaths';
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
 * The publicly discoverable half of a member. Any signed-in user can read these
 * docs (see firestore.rules) — this is the Firestore equivalent of the
 * `discover_profiles` view, so nothing sensitive belongs here. Email, CNIC and
 * wali contact live under `users/{uid}/private/*` instead.
 */
export interface ProfileDoc {
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
  /** Ordered download URLs — replaces the old `profile_photos` table. */
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
    email: privateData?.email ?? auth.currentUser?.email ?? '',
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
    bureauVerified: verification?.bureauVerified ?? false,
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
  const [profileSnap, privateSnap, verificationSnap] = await Promise.all([
    getDoc(profileDoc(userId)),
    getDoc(privateDoc(userId)),
    getDoc(verificationDoc(userId)),
  ]);
  if (!profileSnap.exists()) return null;
  return mapToUserProfile(
    userId,
    profileSnap.data() as ProfileDoc,
    (privateSnap.data() as PrivateDoc | undefined) ?? null,
    (verificationSnap.data() as VerificationDoc | undefined) ?? null
  );
}

/**
 * Best-effort "is this address taken?" check for step 1 of signup.
 *
 * Firebase projects created with email-enumeration protection enabled (the
 * default) always return an empty list here, so this can report `false` for an
 * address that is in fact taken. `signup` catches `auth/email-already-in-use`
 * and reports it properly either way — this is purely a nicer early warning.
 */
async function emailExists(email: string): Promise<boolean> {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email.trim().toLowerCase());
    return methods.length > 0;
  } catch {
    return false;
  }
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
}): ProfileDoc {
  return {
    fullName: input.fullName.trim(),
    dob: input.dob,
    gender: input.gender,
    city: input.city.trim(),
    bio: input.bio?.trim() ?? '',
    intent: input.intent,
    language: input.language,
    activeMode: input.intent === 'matrimonial' ? 'rishta' : 'dating',
    datingVibeTags: [],
    datingIntentionLabel: null,
    rishtaReligion: '',
    rishtaSect: '',
    rishtaFamilyBackground: '',
    rishtaEducation: '',
    rishtaReadiness: 'browsing',
    rishtaPrayerHabits: null,
    rishtaIncomeRange: null,
    rishtaLivingAbroad: null,
    heightCm: null,
    maritalStatus: null,
    hasChildren: null,
    occupation: null,
    practising: null,
    prayerHabits: null,
    halalOnly: null,
    smoking: null,
    drinking: null,
    religiousDress: null,
    openToRelocate: null,
    preferredCountry: null,
    careerPlans: null,
    educationLevel: null,
    degree: null,
    jobTitle: null,
    industry: null,
    languages: null,
    nationality: null,
    grewUpIn: null,
    country: null,
    selfieVerified: Boolean(input.selfieVerified),
    photos: input.photos,
    voiceIntroUrl: null,
    voiceIntroDurationSec: null,
    videoIntroUrl: null,
    waliName: null,
    waliInvitedAt: null,
    isExplorePlus: false,
    subscriptionPlan: null,
    hasUsedTrial: false,
    subscriptionRenewsAt: null,
    createdAt: new Date().toISOString(),
  };
}

function signupErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/email-already-in-use') return 'That email is already registered. Try logging in instead.';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/weak-password') return 'Password is too weak — use at least 6 characters.';
  return (err as { message?: string })?.message ?? 'Could not create the account.';
}

async function signup(input: SignupInput): Promise<UserProfile> {
  const email = input.email.trim().toLowerCase();

  let userId: string;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, input.password);
    userId = credential.user.uid;
    await updateProfile(credential.user, { displayName: input.fullName.trim() });
  } catch (err) {
    throw new Error(signupErrorMessage(err));
  }

  // Uploads run against the freshly created session, so storage rules see the
  // right uid.
  const [photoUrls, cnicPhotoPath, selfiePhotoPath] = await Promise.all([
    Promise.all((input.photos ?? []).map((uri) => mediaUpload.uploadPhoto(userId, uri))),
    input.cnicPhotoUri ? mediaUpload.uploadCnicPhoto(userId, input.cnicPhotoUri) : Promise.resolve(null),
    input.selfieUri ? mediaUpload.uploadSelfiePhoto(userId, input.selfieUri) : Promise.resolve(null),
  ]);

  // setDoc (not addDoc/create-only): if an earlier attempt for this same auth
  // user died partway through (network drop, app kill), retrying completes the
  // documents instead of failing on an already-exists error.
  await Promise.all([
    setDoc(profileDoc(userId), blankProfileDoc({ ...input, photos: photoUrls })),
    setDoc(privateDoc(userId), { email, waliContact: null } satisfies PrivateDoc),
    setDoc(verificationDoc(userId), {
      cnicNumber: input.cnicNumber,
      cnicPhotoPath,
      cnicVerified: true,
      bureauVerified: false,
      selfiePhotoPath,
    } satisfies VerificationDoc),
  ]);

  const profile = await fetchFullProfile(userId);
  if (!profile) throw new Error('Could not load the account that was just created.');
  return profile;
}

function loginErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again in a few minutes.';
  if (code === 'auth/user-disabled') return 'This account has been disabled.';
  // invalid-credential / user-not-found / wrong-password all collapse to one
  // message so the form doesn't reveal which addresses are registered.
  return 'Incorrect email or password.';
}

async function login(email: string, password: string): Promise<UserProfile> {
  const normalized = email.trim().toLowerCase();

  let userId: string;
  let displayName: string | null;
  try {
    const credential = await signInWithEmailAndPassword(auth, normalized, password);
    userId = credential.user.uid;
    displayName = credential.user.displayName;
  } catch (err) {
    throw new Error(loginErrorMessage(err));
  }

  let profile = await fetchFullProfile(userId);

  // Auth user exists but the profile documents don't — a signup that died
  // between account creation and the Firestore writes. Seed a minimal profile
  // so the member isn't stuck at a blank app.
  if (!profile) {
    await Promise.all([
      setDoc(
        profileDoc(userId),
        blankProfileDoc({
          fullName: displayName ?? normalized.split('@')[0] ?? 'User',
          dob: '2000-01-01',
          gender: 'other',
          city: '',
          intent: 'casual',
          language: 'en',
          photos: [],
        })
      ),
      setDoc(privateDoc(userId), { email: normalized, waliContact: null } satisfies PrivateDoc),
    ]);
    profile = await fetchFullProfile(userId);
    if (!profile) throw new Error('Could not create profile.');
  }

  return profile;
}

async function logout(): Promise<void> {
  await signOut(auth);
}

async function getCurrentUser(): Promise<UserProfile | null> {
  const userId = auth.currentUser?.uid;
  if (!userId) return null;
  return fetchFullProfile(userId);
}

async function updateUser(updated: UserProfile): Promise<UserProfile> {
  const userId = updated.id;

  const existingSnap = await getDoc(profileDoc(userId));
  const existingPhotos: string[] = (existingSnap.data() as ProfileDoc | undefined)?.photos ?? [];

  // Local URIs are fresh picks that need uploading; anything already remote is
  // a download URL we stored last save and can be kept as-is.
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

  const patch: Partial<ProfileDoc> = {
    fullName: updated.fullName,
    city: updated.city,
    bio: updated.bio,
    language: updated.language,
    activeMode: updated.activeMode,
    datingVibeTags: updated.dating.vibeTags,
    datingIntentionLabel: updated.dating.intentionLabel ?? null,
    rishtaReligion: updated.rishta.religion,
    rishtaSect: updated.rishta.sect,
    rishtaFamilyBackground: updated.rishta.familyBackground,
    rishtaEducation: updated.rishta.education,
    rishtaReadiness: updated.rishta.readiness,
    rishtaPrayerHabits: updated.rishta.prayerHabits ?? null,
    rishtaIncomeRange: updated.rishta.incomeRange ?? null,
    rishtaLivingAbroad: updated.rishta.livingAbroad ?? null,
    heightCm: updated.heightCm ?? null,
    maritalStatus: updated.maritalStatus ?? null,
    hasChildren: updated.hasChildren ?? null,
    occupation: updated.occupation ?? null,
    practising: updated.practising ?? null,
    prayerHabits: updated.prayerHabits ?? null,
    halalOnly: updated.halalOnly ?? null,
    smoking: updated.smoking ?? null,
    drinking: updated.drinking ?? null,
    religiousDress: updated.religiousDress ?? null,
    openToRelocate: updated.openToRelocate ?? null,
    preferredCountry: updated.preferredCountry ?? null,
    careerPlans: updated.careerPlans ?? null,
    educationLevel: updated.educationLevel ?? null,
    degree: updated.degree ?? null,
    jobTitle: updated.jobTitle ?? null,
    industry: updated.industry ?? null,
    languages: updated.languages ?? null,
    nationality: updated.nationality ?? null,
    grewUpIn: updated.grewUpIn ?? null,
    country: updated.country ?? null,
    selfieVerified: updated.selfieVerified,
    photos: photoUrls,
    voiceIntroUrl,
    voiceIntroDurationSec: updated.voiceIntroDurationSec ?? null,
    videoIntroUrl,
    waliName: updated.waliName ?? null,
    waliInvitedAt: updated.waliInvitedAt ?? null,
    isExplorePlus: updated.isExplorePlus ?? false,
    subscriptionPlan: updated.subscriptionPlan ?? null,
    hasUsedTrial: updated.hasUsedTrial ?? false,
    subscriptionRenewsAt: updated.subscriptionRenewsAt ?? null,
  };

  await updateDoc(profileDoc(userId), patch);
  await setDoc(
    privateDoc(userId),
    { email: updated.email, waliContact: updated.waliContact ?? null } satisfies PrivateDoc,
    { merge: true }
  );

  if (updated.cnicNumber) {
    // A local cnicPhotoUri means a fresh capture to upload; a remote one is the
    // download URL we handed back last fetch — leave the stored path alone.
    const cnicPhotoPath =
      updated.cnicPhotoUri && mediaUpload.isLocalUri(updated.cnicPhotoUri)
        ? await mediaUpload.uploadCnicPhoto(userId, updated.cnicPhotoUri)
        : undefined;

    const verificationPatch: Partial<VerificationDoc> = {
      cnicNumber: updated.cnicNumber,
      cnicVerified: updated.cnicVerified ?? true,
    };
    if (cnicPhotoPath) verificationPatch.cnicPhotoPath = cnicPhotoPath;

    await setDoc(verificationDoc(userId), verificationPatch, { merge: true });
  }

  const removed = existingPhotos.filter((url) => !photoUrls.includes(url));
  if (removed.length) await mediaUpload.removeFiles(removed);

  const profile = await fetchFullProfile(userId);
  if (!profile) throw new Error('Could not reload the updated profile.');
  return profile;
}

/**
 * Firestore doesn't cascade: deleting users/{uid} leaves its subcollections
 * behind. Without a Cloud Function to recurse server-side, the signed-in client
 * clears them itself while it still has permission to.
 */
async function deleteUserSubcollections(userId: string): Promise<void> {
  await Promise.all(
    USER_SUBCOLLECTIONS.map(async (name) => {
      const snap = await getDocs(userCollection(userId, name));
      await Promise.all(snap.docs.map((entry) => deleteDoc(entry.ref)));
    })
  );
}

/** Firebase's window for "recently signed in" before it refuses destructive ops. */
const RECENT_LOGIN_WINDOW_MS = 5 * 60 * 1000;

async function deleteAccount(userId: string): Promise<void> {
  const current = auth.currentUser;
  if (!current || current.uid !== userId) throw new Error('Not signed in.');

  // Checked up front, before anything is destroyed: Firebase rejects deleteUser
  // behind a stale session, and the Firestore documents can only be removed
  // while the user is still authenticated. Failing the whole operation early
  // leaves the account intact and retryable instead of half-deleted.
  const lastSignIn = current.metadata.lastSignInTime ? Date.parse(current.metadata.lastSignInTime) : 0;
  if (!lastSignIn || Date.now() - lastSignIn > RECENT_LOGIN_WINDOW_MS) {
    throw new Error('REAUTH_REQUIRED');
  }

  const snap = await getDoc(profileDoc(userId));
  const photos: string[] = (snap.data() as ProfileDoc | undefined)?.photos ?? [];
  if (photos.length) await mediaUpload.removeFiles(photos);

  // Order matters: the documents have to go while the user is still signed in,
  // because the rules key every write off request.auth.uid.
  await deleteUserSubcollections(userId);
  await Promise.all([deleteDoc(profileDoc(userId)), deleteDoc(userDoc(userId))]);

  try {
    await deleteUser(current);
  } catch (err) {
    // Backstop for the window check above racing the server's own clock. The
    // documents are already gone at this point, so sign out and let the member
    // re-authenticate to clear the leftover login record.
    await signOut(auth);
    if ((err as { code?: string })?.code === 'auth/requires-recent-login') {
      throw new Error('REAUTH_REQUIRED');
    }
    throw err;
  }
}

/**
 * Single-field write for the dating/rishta toggle.
 *
 * Going through `updateUser` for this costs a read, three writes and a
 * three-document reload — enough that the toggle visibly lagged behind the tap.
 * Nothing else about the profile changes when the mode flips, so one `updateDoc`
 * is all it needs.
 */
async function setActiveMode(userId: string, mode: ProfileMode): Promise<void> {
  await updateDoc(profileDoc(userId), { activeMode: mode });
}

export const authService = {
  signup,
  login,
  logout,
  getCurrentUser,
  updateUser,
  setActiveMode,
  deleteAccount,
  emailExists,
};
