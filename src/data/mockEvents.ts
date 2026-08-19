import type { CommunityEvent } from '../types/content';

// Placeholder demo data only — a real backend would replace this with events
// pulled from a service layer (city-filtered, RSVP-aware).
export const mockEvents: CommunityEvent[] = [
  {
    id: 'e1',
    title: 'Rishta & Rang Meetup — Lahore',
    city: 'Lahore',
    dateLabel: '12 September, 6:00 PM',
    description:
      'An invite-only evening for verified members to meet in person over chai and dessert. Families welcome for the second hour.',
    image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800',
  },
  {
    id: 'e2',
    title: 'Matrimonial Q&A with Family Counsellors',
    city: 'Karachi',
    dateLabel: '20 September, 5:30 PM',
    description:
      'A panel session on navigating family involvement, wali conversations, and setting expectations early — open to all members.',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800',
  },
  {
    id: 'e3',
    title: 'Young Professionals Coffee Hour',
    city: 'Islamabad',
    dateLabel: '28 September, 4:00 PM',
    description: 'A casual, low-pressure meetup for members exploring the Dating Mode community in Islamabad.',
    image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800',
  },
];
