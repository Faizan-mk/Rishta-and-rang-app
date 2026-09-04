import { PROFILE_SELECT, fetchProfileRow, type ProfileDoc } from './authService';
import { supabase } from './supabase';
import { ageFromDob } from '../utils/date';
import { targetGenders } from '../utils/genderMatch';
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

/** How many members one page of the deck carries. */
export const DECK_PAGE_SIZE = 30;

async function fetchProfiles(viewer: Gender | undefined, page: number, pageSize: number): Promise<ProfileEntry[]> {
  const from = page * pageSize;
  // male sees female, female sees male, 'other' sees both — see utils/genderMatch.
  //
  // Ordered before it is ranged, or "page 2" means nothing: without an explicit
  // order PostgreSQL may return rows in any order it likes, and two pages could
  // repeat a member or skip one. Newest first is also the order a deck wants.
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('gender', targetGenders(viewer))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + pageSize - 1);
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

export interface DeckPage {
  dating: DiscoverProfile[];
  rishta: RishtaListingProfile[];
  /** A full page came back, so there is probably another behind it. */
  hasMore: boolean;
}

/**
 * One page of the member pool, mapped into both shapes.
 *
 * Both decks read the same rows and the same columns, so fetching them
 * separately — which is what `fetchDiscoverProfiles` and `fetchRishtaProfiles`
 * did, one after the other — was the same query run twice for the same data.
 * It is one query now, mapped twice, which is free.
 */
async function fetchDeckPage(
  viewerGender: Gender | undefined,
  excludeId: string | undefined,
  page: number = 0,
  pageSize: number = DECK_PAGE_SIZE
): Promise<DeckPage> {
  const rows = await fetchProfiles(viewerGender, page, pageSize);
  // Filtered after the range, so a page that contains the viewer is one short
  // rather than reaching into the next page — `hasMore` is measured on what the
  // database returned, not on what survived the filter.
  const visible = rows.filter((row) => row.id !== excludeId);
  return {
    dating: visible.map(mapToDiscoverProfile),
    rishta: visible.map(mapToRishtaProfile),
    hasMore: rows.length >= pageSize,
  };
}

/**
 * Just the last-seen times, for profiles already on screen.
 *
 * The deck is fetched once and held, so its `lastActiveAt` is as old as the
 * fetch — a member who came online a minute ago still reads as whatever they
 * were when the deck loaded, and the "Active now" badge could never appear on a
 * card that had been sitting there. This is two columns for the ids already
 * held, which is cheap enough to run whenever the app is looked at again.
 */
async function fetchActivity(ids: string[]): Promise<Map<string, string | null>> {
  const activity = new Map<string, string | null>();
  if (ids.length === 0) return activity;
  const { data, error } = await supabase.from('profiles').select('id, last_active_at').in('id', ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const profile = row as unknown as { id: string; last_active_at: string | null };
    activity.set(profile.id, profile.last_active_at);
  }
  return activity;
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
  fetchDeckPage,
  fetchActivity,
  fetchProfileById,
};