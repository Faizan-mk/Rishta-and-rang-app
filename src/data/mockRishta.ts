import { FEMALE_DEMO_PHOTOS, MALE_DEMO_PHOTOS } from './demoPhotos';
import type { RishtaListingProfile } from '../types/content';
import type { Intent } from '../types/user';

// Demo portraits come bundled (see demoPhotos.ts) rather than from a remote
// avatar host: a blocked or slow third-party domain used to leave every demo
// card blank. W()/M() wrap around their own gender's list, so any call number
// stays gender-correct.
const W = (n: number) => FEMALE_DEMO_PHOTOS[n % FEMALE_DEMO_PHOTOS.length];
const M = (n: number) => MALE_DEMO_PHOTOS[n % MALE_DEMO_PHOTOS.length];

// Placeholder demo data only — a real backend would replace this with actual
// matrimonial listings filtered server-side.
const rawRishtaProfiles: RishtaListingProfile[] = [
  {
    id: 'r1',
    name: 'Mahnoor',
    age: 25,
    gender: 'female',
    city: 'Lahore',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'MBA, LUMS',
    familyBackground: 'Small family, settled in Lahore, father is a retired army officer.',
    readiness: 'ready_now',
    photos: [W(13), W(14)],
  },
  {
    id: 'r2',
    name: 'Ahmed',
    age: 29,
    gender: 'male',
    city: 'Karachi',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'BSc Computer Science, FAST',
    familyBackground: 'Joint family, business background, two siblings.',
    readiness: 'few_months',
    photos: [M(8), M(9)],
  },
  {
    id: 'r3',
    name: 'Fatima',
    age: 27,
    gender: 'female',
    city: 'Islamabad',
    religion: 'Islam',
    sect: 'Shia',
    education: 'MSc Economics',
    familyBackground: 'Nuclear family, both parents retired government officers.',
    readiness: 'ready_now',
    photos: [W(15), W(16)],
  },
  {
    id: 'r4',
    name: 'Hassan',
    age: 31,
    gender: 'male',
    city: 'Lahore',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'Chartered Accountant',
    familyBackground: 'Small family, settled in DHA, father runs a textile business.',
    readiness: 'browsing',
    photos: [M(10), M(11)],
  },
  {
    id: 'r5',
    name: 'Amina',
    age: 24,
    gender: 'female',
    city: 'Faisalabad',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'Doctor, King Edward Medical University',
    familyBackground: 'Large joint family, both parents in medicine.',
    readiness: 'few_months',
    photos: [W(17), W(18)],
  },
  {
    id: 'r6',
    name: 'Zara',
    age: 26,
    gender: 'female',
    city: 'Karachi',
    religion: 'Islam',
    sect: 'Ismaili',
    education: 'BBA, IBA',
    familyBackground: 'Small family, both parents in business.',
    readiness: 'ready_now',
    photos: [W(19), W(20)],
  },
  {
    id: 'r7',
    name: 'Bilal',
    age: 30,
    gender: 'male',
    city: 'Rawalpindi',
    religion: 'Islam',
    sect: 'Deobandi',
    education: 'MPhil Islamic Studies',
    familyBackground: 'Religious family, father is a khateeb.',
    readiness: 'few_months',
    photos: [M(12), M(13)],
  },
  {
    id: 'r8',
    name: 'Sana',
    age: 28,
    gender: 'female',
    city: 'Lahore',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'MPhil Chemistry, PU',
    familyBackground: 'Nuclear family, father is a university professor, one younger brother.',
    readiness: 'ready_now',
    photos: [W(21), W(22)],
    heightCm: 158,
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Lecturer',
    practising: true,
    prayerHabits: 'Prays 5 times daily',
    halalOnly: true,
    smoking: false,
    drinking: false,
    religiousDress: 'Wears hijab',
    openToRelocate: true,
    preferredCountry: 'Saudi Arabia',
    languages: ['Urdu', 'English', 'Punjabi'],
    nationality: 'Pakistani',
    grewUpIn: 'Lahore',
    country: 'Pakistan',
  },
  {
    id: 'r9',
    name: 'Usama',
    age: 33,
    gender: 'male',
    city: 'Karachi',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'MBBS, Dow Medical College',
    familyBackground: 'Small family, settled in Karachi, both parents doctors.',
    readiness: 'few_months',
    photos: [M(14), M(15)],
    heightCm: 180,
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Doctor',
    practising: true,
    smoking: false,
    drinking: false,
    careerPlans: 'Completing FCPS then opening a private practice',
    languages: ['Urdu', 'English'],
    nationality: 'Pakistani',
    grewUpIn: 'Karachi',
    country: 'Pakistan',
  },
  {
    id: 'r10',
    name: 'Rabia',
    age: 30,
    gender: 'female',
    city: 'Multan',
    religion: 'Islam',
    sect: 'Sunni',
    education: 'LLB, Punjab University',
    familyBackground: 'Joint family, father is a lawyer, close-knit extended family in Multan.',
    readiness: 'browsing',
    photos: [W(23), W(24)],
    heightCm: 162,
    maritalStatus: 'widowed',
    hasChildren: true,
    occupation: 'Lawyer',
    practising: true,
    halalOnly: true,
    smoking: false,
    drinking: false,
    languages: ['Urdu', 'English', 'Saraiki'],
    nationality: 'Pakistani',
    grewUpIn: 'Multan',
    country: 'Pakistan',
  },
];


// Personality traits demoed off a shared pool so every card has a Personality
// section to render; a real backend would store the member's own picks.
const PERSONALITY_POOL = [
  'Active Listener',
  'Adventurous',
  'Affectionate',
  'Animal lover',
  'Cheerful',
  'Ambitious',
  'Thoughtful',
  'Funny',
];

function demoPersonality(i: number): string[] {
  return [0, 1, 2].map((n) => PERSONALITY_POOL[(i * 3 + n) % PERSONALITY_POOL.length]);
}

// Intent spread so the intent filter has something to bite on.
const DEMO_INTENTS: Intent[] = ['casual', 'serious', 'matrimonial'];

// Join dates spread over the last few months so "Just joined" has something to
// order; index 0 is the newest member.
function demoJoinedAt(i: number): string {
  return new Date(Date.now() - (i * 9 + 2) * 24 * 60 * 60 * 1000).toISOString();
}

// Roughly "seen N hours ago" — every other profile lands inside the 24h window
// that drives the "Active today" badge.
function demoLastActive(i: number): string {
  const hoursAgo = i % 2 === 0 ? (i % 12) + 1 : 26 + i * 5;
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

// Bureau verification demoed on a subset of profiles for variety. `photosBlurred`
// is deliberately left off here: it's a real member's privacy choice, and faking it
// on the demo deck just makes the listings look like broken/low-quality photos.
export const mockRishtaProfiles: RishtaListingProfile[] = rawRishtaProfiles.map((p, i) => ({
  ...p,
  bureauVerified: i % 3 === 0,
  selfieVerified: i % 2 === 1,
  distanceKm: i * 9 + 5,
  lastActiveAt: demoLastActive(i),
  joinedAt: demoJoinedAt(i),
  intent: (i % 2 === 0 ? 'matrimonial' : DEMO_INTENTS[i % DEMO_INTENTS.length]),
  personality: demoPersonality(i),
}));
