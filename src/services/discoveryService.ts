import { getDoc, getDocs, query, where } from 'firebase/firestore';
import { profileDoc, profilesCollection } from './firestorePaths';
import { ageFromDob } from '../utils/date';
import type { ProfileDoc } from './authService';
import type { DiscoverProfile, RishtaListingProfile } from '../types/content';
import type { Gender } from '../types/user';

// ---------------------------------------------------------------------------
// Real-discovery data source.
//
// Reads members from the `profiles` collection instead of the local mock files.
// Every doc there is already safe to show to other members — email, CNIC and
// wali contact live under users/{uid}/private/* and are owner-only (see
// firestore.rules). That replaces the `discover_profiles` view the Postgres
// version needed to work around row-level security.
//
// If the collection is empty (fresh project, no members yet) the screens fall
// back to the demo deck via DiscoveryContext.
// ---------------------------------------------------------------------------

interface ProfileEntry {
  id: string;
  data: ProfileDoc;
}

/** Opposite gender for straight matching; undefined for 'other' viewers. */
function targetGender(viewer?: Gender): Gender | undefined {
  if (viewer === 'male') return 'female';
  if (viewer === 'female') return 'male';
  return undefined;
}

async function fetchProfiles(viewer?: Gender): Promise<ProfileEntry[]> {
  const target = targetGender(viewer);
  const ref = target ? query(profilesCollection(), where('gender', '==', target)) : profilesCollection();
  const snap = await getDocs(ref);
  return snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as ProfileDoc }));
}

function mapToDiscoverProfile({ id, data }: ProfileEntry): DiscoverProfile {
  return {
    id,
    name: data.fullName,
    age: ageFromDob(data.dob) ?? 0,
    gender: data.gender,
    city: data.city ?? '',
    bio: data.bio ?? '',
    vibeTags: data.datingVibeTags ?? [],
    familyBackground: data.rishtaFamilyBackground || undefined,
    education: data.rishtaEducation || undefined,
    photos: data.photos ?? [],
    selfieVerified: data.selfieVerified ?? false,
    bureauVerified: data.bureauVerified ?? false,
    lastActiveAt: data.lastActiveAt ?? undefined,
    joinedAt: data.createdAt ?? undefined,
    intent: data.intent ?? undefined,
    heightCm: data.heightCm ?? undefined,
    maritalStatus: data.maritalStatus ?? undefined,
    hasChildren: data.hasChildren ?? undefined,
    occupation: data.occupation ?? undefined,
    readiness: data.rishtaReadiness ?? undefined,
    religion: data.rishtaReligion ?? undefined,
    sect: data.rishtaSect ?? undefined,
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
  };
}

function mapToRishtaProfile({ id, data }: ProfileEntry): RishtaListingProfile {
  return {
    id,
    name: data.fullName,
    age: ageFromDob(data.dob) ?? 0,
    gender: data.gender,
    city: data.city ?? '',
    religion: data.rishtaReligion ?? '',
    sect: data.rishtaSect ?? '',
    education: data.rishtaEducation ?? '',
    familyBackground: data.rishtaFamilyBackground ?? '',
    readiness: data.rishtaReadiness ?? 'browsing',
    bio: data.bio || undefined,
    vibeTags: data.datingVibeTags ?? undefined,
    photos: data.photos ?? [],
    selfieVerified: data.selfieVerified ?? false,
    bureauVerified: data.bureauVerified ?? false,
    lastActiveAt: data.lastActiveAt ?? undefined,
    joinedAt: data.createdAt ?? undefined,
    intent: data.intent ?? undefined,
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
  };
}

async function fetchDiscoverProfiles(viewerGender?: Gender, excludeId?: string): Promise<DiscoverProfile[]> {
  const rows = await fetchProfiles(viewerGender);
  return rows.filter((row) => row.id !== excludeId).map(mapToDiscoverProfile);
}

async function fetchRishtaProfiles(viewerGender?: Gender, excludeId?: string): Promise<RishtaListingProfile[]> {
  const rows = await fetchProfiles(viewerGender);
  return rows.filter((row) => row.id !== excludeId).map(mapToRishtaProfile);
}

/** Single profile lookup used by ProfileDetailScreen. */
async function fetchProfileById(
  id: string,
  kind: 'dating' | 'rishta'
): Promise<DiscoverProfile | RishtaListingProfile | null> {
  const snap = await getDoc(profileDoc(id));
  if (!snap.exists()) return null;
  const entry: ProfileEntry = { id: snap.id, data: snap.data() as ProfileDoc };
  return kind === 'dating' ? mapToDiscoverProfile(entry) : mapToRishtaProfile(entry);
}

export const discoveryService = {
  fetchDiscoverProfiles,
  fetchRishtaProfiles,
  fetchProfileById,
};
