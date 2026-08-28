import { FEMALE_DEMO_PHOTOS, MALE_DEMO_PHOTOS } from './demoPhotos';
import type { DiscoverProfile } from '../types/content';
import type { Intent } from '../types/user';

// Demo portraits come bundled (see demoPhotos.ts) rather than from a remote
// avatar host: a blocked or slow third-party domain used to leave every demo
// card blank. W()/M() wrap around their own gender's list, so any call number
// stays gender-correct.
const W = (n: number) => FEMALE_DEMO_PHOTOS[n % FEMALE_DEMO_PHOTOS.length];
const M = (n: number) => MALE_DEMO_PHOTOS[n % MALE_DEMO_PHOTOS.length];

// Placeholder demo data only — a real backend would replace this with actual
// candidate profiles from the matching service.
const rawDiscoverProfiles: DiscoverProfile[] = [
  {
    id: 'd1',
    name: 'Ayesha',
    age: 26,
    gender: 'female',
    city: 'Lahore',
    bio: 'Coffee over cold brew debates, weekend hiker, and a sucker for old Urdu poetry.',
    vibeTags: ['bookworm', 'traveller', 'deen-focused'],
    photos: [W(0), W(1), W(2)],
    heightCm: 163,
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Architect',
    readiness: 'few_months',
    religion: 'Islam',
    sect: 'Sunni',
    practising: true,
    prayerHabits: 'Prays 5 times daily',
    halalOnly: true,
    smoking: false,
    drinking: false,
    religiousDress: 'Wears hijab',
    openToRelocate: true,
    preferredCountry: 'UAE',
    careerPlans: 'Growing into a design lead role',
    educationLevel: "Master's degree",
    degree: 'M.Arch, Architecture',
    jobTitle: 'Architect',
    industry: 'Design & Construction',
    languages: ['Urdu', 'English', 'Punjabi'],
    nationality: 'Pakistani',
    grewUpIn: 'Lahore',
    country: 'Pakistan',
  },
  {
    id: 'd2',
    name: 'Hamza',
    age: 29,
    gender: 'male',
    city: 'Karachi',
    bio: 'Software engineer by day, amateur chef by night. Still looking for the perfect biryani recipe.',
    vibeTags: ['foodie', 'cricket fan', 'early riser'],
    photos: [M(0), M(1)],
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Software Engineer',
    readiness: 'ready_now',
    smoking: false,
    drinking: false,
    educationLevel: "Bachelor's degree",
    degree: 'BS Computer Science',
    jobTitle: 'Senior Software Engineer',
    industry: 'Technology',
    languages: ['Urdu', 'English'],
    nationality: 'Pakistani',
    grewUpIn: 'Karachi',
    country: 'Pakistan',
  },
  {
    id: 'd3',
    name: 'Zainab',
    age: 24,
    gender: 'female',
    city: 'Islamabad',
    bio: 'Design student, plant mom, and terminally online about K-dramas.',
    vibeTags: ['creative', 'homebody', 'ambivert'],
    photos: [W(3), W(4), W(5)],
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Design Student',
    readiness: 'browsing',
    educationLevel: "Bachelor's degree (in progress)",
    degree: 'BFA, Visual Design',
    languages: ['Urdu', 'English'],
    nationality: 'Pakistani',
    grewUpIn: 'Islamabad',
    country: 'Pakistan',
  },
  {
    id: 'd4',
    name: 'Bilal',
    age: 28,
    gender: 'male',
    city: 'Lahore',
    bio: 'Weekend cricketer, deen-focused, believes the best conversations happen over chai.',
    vibeTags: ['deen-focused', 'sporty', 'family-oriented'],
    photos: [M(2), M(3)],
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Marketing Manager',
    readiness: 'few_months',
    religion: 'Islam',
    sect: 'Sunni',
    practising: true,
    prayerHabits: 'Prays 5 times daily',
    halalOnly: true,
    smoking: false,
    drinking: false,
    educationLevel: "Bachelor's degree",
    jobTitle: 'Marketing Manager',
    industry: 'FMCG',
    languages: ['Urdu', 'English', 'Punjabi'],
    nationality: 'Pakistani',
    grewUpIn: 'Lahore',
    country: 'Pakistan',
  },
  {
    id: 'd5',
    name: 'Sara',
    age: 27,
    gender: 'female',
    city: 'Faisalabad',
    bio: 'Doctor, dog person, and firmly of the opinion that dessert is a food group.',
    vibeTags: ['ambitious', 'dog lover', 'traveller'],
    photos: [W(6), W(7)],
    maritalStatus: 'divorced',
    hasChildren: false,
    occupation: 'Doctor',
    readiness: 'ready_now',
    smoking: false,
    drinking: false,
    openToRelocate: true,
    preferredCountry: 'Canada',
    educationLevel: 'Doctorate',
    degree: 'MBBS',
    jobTitle: 'General Physician',
    industry: 'Healthcare',
    languages: ['Urdu', 'English'],
    nationality: 'Pakistani',
    grewUpIn: 'Faisalabad',
    country: 'Pakistan',
  },
  {
    id: 'd6',
    name: 'Usman',
    age: 30,
    gender: 'male',
    city: 'Multan',
    bio: 'Entrepreneur building a logistics startup. Looking for someone who gets the hustle.',
    vibeTags: ['entrepreneur', 'deen-focused', 'night owl'],
    photos: [M(4), M(5)],
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Entrepreneur',
    readiness: 'browsing',
    religion: 'Islam',
    sect: 'Sunni',
    practising: true,
    smoking: false,
    drinking: false,
    careerPlans: 'Scaling the startup regionally',
    jobTitle: 'Founder & CEO',
    industry: 'Logistics',
    languages: ['Urdu', 'English', 'Saraiki'],
    nationality: 'Pakistani',
    grewUpIn: 'Multan',
    country: 'Pakistan',
  },
  {
    id: 'd7',
    name: 'Hania',
    age: 25,
    gender: 'female',
    city: 'Karachi',
    bio: 'Marine biology grad turned science teacher. Ask me about sharks, I will not stop talking.',
    vibeTags: ['nerdy', 'traveller', 'animal lover'],
    photos: [W(8), W(9), W(10)],
    heightCm: 160,
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Teacher',
    readiness: 'few_months',
    religion: 'Islam',
    sect: 'Sunni',
    practising: false,
    smoking: false,
    drinking: false,
    educationLevel: "Master's degree",
    degree: 'MSc Marine Biology',
    jobTitle: 'Science Teacher',
    industry: 'Education',
    languages: ['Urdu', 'English', 'Sindhi'],
    nationality: 'Pakistani',
    grewUpIn: 'Karachi',
    country: 'Pakistan',
  },
  {
    id: 'd8',
    name: 'Danish',
    age: 27,
    gender: 'male',
    city: 'Islamabad',
    bio: 'Civil servant, gym regular, and a firm believer that the best biryani is homemade.',
    vibeTags: ['fitness', 'family-oriented', 'foodie'],
    photos: [M(6), M(7)],
    heightCm: 178,
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Civil Servant',
    readiness: 'ready_now',
    religion: 'Islam',
    sect: 'Sunni',
    practising: true,
    prayerHabits: 'Prays 5 times daily',
    halalOnly: true,
    smoking: false,
    drinking: false,
    educationLevel: "Master's degree",
    degree: 'MPA, Public Administration',
    jobTitle: 'Assistant Commissioner',
    industry: 'Government',
    languages: ['Urdu', 'English'],
    nationality: 'Pakistani',
    grewUpIn: 'Islamabad',
    country: 'Pakistan',
  },
  {
    id: 'd9',
    name: 'Mahin',
    age: 23,
    gender: 'female',
    city: 'Lahore',
    bio: 'Fashion design student who sews her own clothes and definitely over-plans every trip.',
    vibeTags: ['creative', 'organizer', 'traveller'],
    photos: [W(11), W(12)],
    heightCm: 165,
    maritalStatus: 'single',
    hasChildren: false,
    occupation: 'Fashion Design Student',
    readiness: 'browsing',
    openToRelocate: false,
    educationLevel: "Bachelor's degree (in progress)",
    degree: 'BDes, Fashion Design',
    languages: ['Urdu', 'English', 'Punjabi'],
    nationality: 'Pakistani',
    grewUpIn: 'Lahore',
    country: 'Pakistan',
  },
  {
    id: 'd10',
    name: 'Fahad',
    age: 31,
    gender: 'male',
    city: 'Faisalabad',
    bio: 'Textile business owner, weekend photographer, and a very serious tea connoisseur.',
    vibeTags: ['entrepreneur', 'creative', 'calm'],
    photos: [M(8), M(9)],
    heightCm: 175,
    maritalStatus: 'divorced',
    hasChildren: true,
    occupation: 'Business Owner',
    readiness: 'few_months',
    religion: 'Islam',
    sect: 'Sunni',
    practising: true,
    smoking: false,
    drinking: false,
    careerPlans: 'Expanding into export markets',
    jobTitle: 'Owner',
    industry: 'Textiles',
    languages: ['Urdu', 'English', 'Punjabi'],
    nationality: 'Pakistani',
    grewUpIn: 'Faisalabad',
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
// on the demo deck just makes the cards look like broken/low-quality photos.
// Extra demo members, one per pair of the bundled asset portraits added in
// demoPhotos.ts. Written compactly rather than as two dozen more full records:
// the mapper below fills in the same derived fields (verification, distance,
// intent) the hand-written profiles get, so these behave identically in the deck.
interface ExtraSeed {
  name: string;
  age: number;
  city: string;
  occupation: string;
  bio: string;
  vibeTags: string[];
}

const EXTRA_WOMEN: ExtraSeed[] = [
  { name: 'Zoya', age: 24, city: 'Lahore', occupation: 'Graphic Designer', bio: 'Designs by day, thrifts old records by weekend. Ask me about my terrible plant survival rate.', vibeTags: ['creative', 'music lover', 'chai person'] },
  { name: 'Areeba', age: 27, city: 'Karachi', occupation: 'Dentist', bio: 'Sea view walks and long drives on Sunday mornings. I laugh at my own jokes first.', vibeTags: ['foodie', 'beach walks', 'early riser'] },
  { name: 'Mahnoor', age: 25, city: 'Islamabad', occupation: 'Content Writer', bio: 'Margalla trails, second-hand bookshops, and a very serious opinion on karak chai.', vibeTags: ['bookworm', 'hiker', 'writer'] },
  { name: 'Sana', age: 29, city: 'Rawalpindi', occupation: 'Pharmacist', bio: 'Quiet evenings over loud plans. I bake when I am stressed, so my colleagues eat well.', vibeTags: ['baker', 'homebody', 'deen-focused'] },
  { name: 'Iqra', age: 23, city: 'Faisalabad', occupation: 'Teacher', bio: 'Teaching grade five keeps me honest. Weekends belong to my nieces and to biryani.', vibeTags: ['family first', 'foodie', 'patient'] },
  { name: 'Hafsa', age: 28, city: 'Multan', occupation: 'Bank Officer', bio: 'Numbers all week, gardening all weekend. Looking for someone who texts back.', vibeTags: ['gardener', 'organised', 'tea over coffee'] },
  { name: 'Rabia', age: 26, city: 'Peshawar', occupation: 'Physiotherapist', bio: 'I will absolutely correct your posture unprompted. Sorry in advance.', vibeTags: ['fitness', 'outdoorsy', 'straight talker'] },
  { name: 'Nimra', age: 30, city: 'Sialkot', occupation: 'Lawyer', bio: 'Argues for a living, cooks to unwind. Very committed to Sunday nihari.', vibeTags: ['ambitious', 'foodie', 'debater'] },
  { name: 'Aiman', age: 24, city: 'Hyderabad', occupation: 'Software Engineer', bio: 'Building things that mostly work. Fluent in Urdu, English, and sarcasm.', vibeTags: ['techie', 'gamer', 'night owl'] },
  { name: 'Kinza', age: 27, city: 'Gujranwala', occupation: 'Accountant', bio: 'Spreadsheets by day, embroidery by night. I keep my promises and my receipts.', vibeTags: ['crafty', 'reliable', 'homebody'] },
  { name: 'Laiba', age: 25, city: 'Quetta', occupation: 'Lab Technician', bio: 'Mountains over malls. I take my camera everywhere and use it half the time.', vibeTags: ['photographer', 'traveller', 'nature'] },
  { name: 'Maryam', age: 31, city: 'Lahore', occupation: 'School Principal', bio: 'Ran a school before I turned thirty. Still make time for poetry evenings.', vibeTags: ['leader', 'poetry', 'deen-focused'] },
  { name: 'Fatima', age: 26, city: 'Karachi', occupation: 'Marketing Manager', bio: 'Campaigns, cricket, and coffee that is far too strong. Ask me for restaurant advice.', vibeTags: ['cricket fan', 'foodie', 'social'] },
];

const EXTRA_MEN: ExtraSeed[] = [
  { name: 'Bilal', age: 28, city: 'Lahore', occupation: 'Civil Engineer', bio: 'Bridges by day, badminton by evening. I show up on time, every time.', vibeTags: ['sporty', 'punctual', 'family first'] },
  { name: 'Usman', age: 31, city: 'Karachi', occupation: 'Doctor', bio: 'Long shifts, short attention span for small talk. Great with dad jokes.', vibeTags: ['caring', 'foodie', 'early riser'] },
  { name: 'Ahsan', age: 26, city: 'Islamabad', occupation: 'Data Analyst', bio: 'I will find a pattern in anything, including your Spotify history.', vibeTags: ['techie', 'analytical', 'hiker'] },
  { name: 'Zain', age: 29, city: 'Rawalpindi', occupation: 'Architect', bio: 'Sketches on napkins, builds in concrete. Weekend cyclist, weekday realist.', vibeTags: ['creative', 'cyclist', 'ambitious'] },
  { name: 'Talha', age: 27, city: 'Faisalabad', occupation: 'Textile Manager', bio: 'Third generation in textiles, first in the family to burn the biryani.', vibeTags: ['family first', 'cook', 'grounded'] },
  { name: 'Saad', age: 33, city: 'Multan', occupation: 'Business Owner', bio: 'Runs a small mango export business. Yes, I will bring you the good ones.', vibeTags: ['entrepreneur', 'foodie', 'generous'] },
  { name: 'Hassan', age: 25, city: 'Peshawar', occupation: 'Journalist', bio: 'Chases stories and cricket scores with equal energy. Terrible at sitting still.', vibeTags: ['writer', 'cricket fan', 'curious'] },
  { name: 'Umair', age: 30, city: 'Sialkot', occupation: 'Sports Goods Exporter', bio: 'I have handled more footballs than most footballers. Quiet, steady, straightforward.', vibeTags: ['calm', 'sporty', 'reliable'] },
  { name: 'Danish', age: 26, city: 'Hyderabad', occupation: 'Teacher', bio: 'Teaches physics, believes in second attempts. Chai at Saddar is my love language.', vibeTags: ['patient', 'chai person', 'bookworm'] },
  { name: 'Fahad', age: 32, city: 'Gujranwala', occupation: 'Pharmacist', bio: 'Runs the family pharmacy. Reads history books nobody asked about.', vibeTags: ['bookworm', 'family first', 'homebody'] },
  { name: 'Arsalan', age: 28, city: 'Quetta', occupation: 'Geologist', bio: 'Spends half the month in the field. The other half catching up on sleep and family.', vibeTags: ['outdoorsy', 'traveller', 'independent'] },
  { name: 'Rehan', age: 29, city: 'Lahore', occupation: 'Chartered Accountant', bio: 'Balances books and a very serious cricket fantasy league. Both take discipline.', vibeTags: ['organised', 'cricket fan', 'ambitious'] },
];

// The asset portraits sit after the base64 ones in each list, so the extras pick
// up exactly where the hand-written profiles stop: two photos each, no overlap.
const FIRST_ASSET_WOMAN = FEMALE_DEMO_PHOTOS.length - 26;
const FIRST_ASSET_MAN = MALE_DEMO_PHOTOS.length - 24;

const SHARED_EXTRA_FIELDS = {
  maritalStatus: 'single' as const,
  hasChildren: false,
  religion: 'Islam',
  nationality: 'Pakistani',
  country: 'Pakistan',
  languages: ['Urdu', 'English'],
};

// Takes from both lists in turn. Used twice below: once so the extra women and
// men alternate instead of arriving in two blocks, and once so the extras sit
// among the hand-written profiles rather than behind all of them — appended, a
// member had to swipe the entire original deck before seeing a new face.
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

const extraWomenProfiles: DiscoverProfile[] = EXTRA_WOMEN.map((seed, i) => ({
  id: 'dx-w' + (i + 1),
  gender: 'female' as const,
  photos: [W(FIRST_ASSET_WOMAN + i * 2), W(FIRST_ASSET_WOMAN + i * 2 + 1)],
  ...SHARED_EXTRA_FIELDS,
  ...seed,
}));

const extraMenProfiles: DiscoverProfile[] = EXTRA_MEN.map((seed, i) => ({
  id: 'dx-m' + (i + 1),
  gender: 'male' as const,
  photos: [M(FIRST_ASSET_MAN + i * 2), M(FIRST_ASSET_MAN + i * 2 + 1)],
  ...SHARED_EXTRA_FIELDS,
  ...seed,
}));

const extraDiscoverProfiles: DiscoverProfile[] = interleave(extraWomenProfiles, extraMenProfiles);

export const mockDiscoverProfiles: DiscoverProfile[] = interleave(rawDiscoverProfiles, extraDiscoverProfiles).map((p, i) => ({
  ...p,
  bureauVerified: i % 3 === 0,
  selfieVerified: i % 2 === 0,
  distanceKm: i * 7 + 3,
  lastActiveAt: demoLastActive(i),
  joinedAt: demoJoinedAt(i),
  intent: DEMO_INTENTS[i % DEMO_INTENTS.length],
  personality: demoPersonality(i),
}));
