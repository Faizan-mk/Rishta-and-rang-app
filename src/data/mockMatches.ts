import type { ChatMessage, Match } from '../types/content';

// Placeholder demo data only — a real backend would replace this with the
// signed-in user's actual matches and message history.
export const mockMatches: Match[] = [
  {
    id: 'm1',
    name: 'Ayesha',
    photo: 'https://i.pravatar.cc/600?img=47',
    lastMessage: 'Haha okay, chai over coffee then ☕',
    lastMessageAt: '2026-08-03T18:20:00.000Z',
    unread: true,
    mode: 'dating',
    movedToRishta: false,
  },
  {
    id: 'm2',
    name: 'Mahnoor',
    photo: 'https://i.pravatar.cc/600?img=25',
    lastMessage: 'Yes, I think our families should talk next.',
    lastMessageAt: '2026-08-03T09:05:00.000Z',
    unread: false,
    mode: 'rishta',
    movedToRishta: true,
  },
  {
    id: 'm3',
    name: 'Hamza',
    photo: 'https://i.pravatar.cc/600?img=12',
    lastMessage: 'What kind of biryani is even the best debate 😂',
    lastMessageAt: '2026-08-02T21:40:00.000Z',
    unread: false,
    mode: 'dating',
    movedToRishta: false,
  },
];

export const mockChatHistory: Record<string, ChatMessage[]> = {
  m1: [
    { id: 'c1', matchId: 'm1', fromMe: false, text: 'Hey! Loved your traveller tag, where to next?', sentAt: '2026-08-03T17:50:00.000Z' },
    { id: 'c2', matchId: 'm1', fromMe: true, text: 'Thinking Hunza this time. You?', sentAt: '2026-08-03T17:55:00.000Z' },
    { id: 'c3', matchId: 'm1', fromMe: false, text: 'No plans yet, but I could be convinced 👀', sentAt: '2026-08-03T18:02:00.000Z' },
    { id: 'c4', matchId: 'm1', fromMe: true, text: 'Coffee to plan it out?', sentAt: '2026-08-03T18:10:00.000Z' },
    { id: 'c5', matchId: 'm1', fromMe: false, text: 'Haha okay, chai over coffee then ☕', sentAt: '2026-08-03T18:20:00.000Z' },
  ],
  m2: [
    { id: 'c6', matchId: 'm2', fromMe: false, text: 'It was really nice getting to know you these past weeks.', sentAt: '2026-08-02T20:00:00.000Z' },
    { id: 'c7', matchId: 'm2', fromMe: true, text: 'Same here. I feel ready to take this to the family stage.', sentAt: '2026-08-02T20:10:00.000Z' },
    { id: 'c8', matchId: 'm2', fromMe: false, text: 'Yes, I think our families should talk next.', sentAt: '2026-08-03T09:05:00.000Z' },
  ],
  m3: [
    { id: 'c9', matchId: 'm3', fromMe: true, text: 'Okay unpopular opinion: Karachi biryani > Lahore biryani', sentAt: '2026-08-02T21:30:00.000Z' },
    { id: 'c10', matchId: 'm3', fromMe: false, text: 'What kind of biryani is even the best debate 😂', sentAt: '2026-08-02T21:40:00.000Z' },
  ],
};
