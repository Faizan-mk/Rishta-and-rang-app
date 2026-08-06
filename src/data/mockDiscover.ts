import type { DiscoverProfile } from '../types/content';

function gallery(...imgs: number[]): string[] {
  return imgs.map((n) => `https://i.pravatar.cc/600?img=${n}`);
}

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
    photos: gallery(47, 48, 49),
  },
  {
    id: 'd2',
    name: 'Hamza',
    age: 29,
    gender: 'male',
    city: 'Karachi',
    bio: 'Software engineer by day, amateur chef by night. Still looking for the perfect biryani recipe.',
    vibeTags: ['foodie', 'cricket fan', 'early riser'],
    photos: gallery(12, 13),
  },
  {
    id: 'd3',
    name: 'Zainab',
    age: 24,
    gender: 'female',
    city: 'Islamabad',
    bio: 'Design student, plant mom, and terminally online about K-dramas.',
    vibeTags: ['creative', 'homebody', 'ambivert'],
    photos: gallery(32, 33, 34),
  },
  {
    id: 'd4',
    name: 'Bilal',
    age: 28,
    gender: 'male',
    city: 'Lahore',
    bio: 'Weekend cricketer, deen-focused, believes the best conversations happen over chai.',
    vibeTags: ['deen-focused', 'sporty', 'family-oriented'],
    photos: gallery(51, 52),
  },
  {
    id: 'd5',
    name: 'Sara',
    age: 27,
    gender: 'female',
    city: 'Faisalabad',
    bio: 'Doctor, dog person, and firmly of the opinion that dessert is a food group.',
    vibeTags: ['ambitious', 'dog lover', 'traveller'],
    photos: gallery(45, 46),
  },
  {
    id: 'd6',
    name: 'Usman',
    age: 30,
    gender: 'male',
    city: 'Multan',
    bio: 'Entrepreneur building a logistics startup. Looking for someone who gets the hustle.',
    vibeTags: ['entrepreneur', 'deen-focused', 'night owl'],
    photos: gallery(14, 15),
  },
];

// Bureau verification + photo-blur privacy demoed on a subset of profiles for variety.
export const mockDiscoverProfiles: DiscoverProfile[] = rawDiscoverProfiles.map((p, i) => ({
  ...p,
  bureauVerified: i % 3 === 0,
  photosBlurred: i % 4 === 1,
}));
