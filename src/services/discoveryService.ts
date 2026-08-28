import { PROFILE_SELECT, fetchProfileRow, type ProfileDoc } from './authService';
import { supabase } from './supabase';
import { ageFromDob } from '../utils/date';
import type { DiscoverProfile, RishtaListingProfile } from '../types/content';
import type { Gender } from '../types/user';

// ---------------------------------------------------------------------------
// Real-discovery data source.
//
// Reads members from the `profiles` table instead of the local mock files.
// Every row there is already safe to show to other members — email, CNIC and
// wali contact live in the owner-only `profile_private` / `profile_verification`
// tables (see supabase/2_profiles.sql RLS), so no `discover_profiles` view is needed.
//
// If the table is empty (fresh project, no members yet) the screens fall back
// to the demo deck via DiscoveryContext.
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
  let query = supabase.from('profiles').select(PROFILE_SELECT);
  if (target) query = query.eq('gender', target);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const profile = row as unknown as ProfileDoc;
    return { id: profile.id, data: profile };
  });
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
  const data = await fetchProfileRow(id);
  if (!data) return null;
  const entry: ProfileEntry = { id, data };
  return kind === 'dating' ? mapToDiscoverProfile(entry) : mapToRishtaProfile(entry);
}

export const discoveryService = {
  fetchDiscoverProfiles,
  fetchRishtaProfiles,
  fetchProfileById,
};