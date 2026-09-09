import React from 'react';
import { fireEvent, screen, waitFor, render } from '@testing-library/react-native';
import { withProviders } from '../../../components/__tests__/testWrappers';
import { ExplorePlusScreen } from '../ExplorePlusScreen';
import { useAuth } from '../../../store/AuthContext';
import { useBoost } from '../../../store/BoostContext';
import { useDialog } from '../../../store/DialogContext';
import { useLikeLimit } from '../../../store/LikeLimitContext';
import { usePrivacy } from '../../../store/PrivacyContext';
import { useMatches } from '../../../store/MatchesContext';
import { likesService } from '../../../services/likesService';
import type { LikeReceived } from '../../../services/likesService';
import type { UserProfile } from '../../../types/user';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/BoostContext', () => ({ useBoost: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/LikeLimitContext', () => ({ useLikeLimit: jest.fn() }));
jest.mock('../../../store/PrivacyContext', () => ({ usePrivacy: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('../../../services/likesService', () => ({ likesService: { fetchLikesReceived: jest.fn() } }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseBoost = useBoost as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUseLikeLimit = useLikeLimit as jest.Mock;
const mockUsePrivacy = usePrivacy as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;

let updateUser: jest.Mock;
let addBoosts: jest.Mock;
let notify: jest.Mock;
let confirm: jest.Mock;

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    fullName: 'Ayesha Khan',
    email: 'a@example.com',
    dob: '1998-01-01',
    gender: 'female',
    city: 'Lahore',
    bio: '',
    photos: [],
    selfieVerified: false,
    intent: 'matrimonial',
    language: 'en',
    dating: { vibeTags: [] },
    rishta: { religion: 'Islam', sect: 'Sunni', familyBackground: '', education: '', readiness: 'browsing' },
    activeMode: 'dating',
    isExplorePlus: false,
    createdAt: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function admirer(overrides: Partial<LikeReceived> = {}): LikeReceived {
  return { id: 'p1', kind: 'dating', name: 'Bilal', age: 29, city: 'Karachi', photo: 'a.jpg', likedAt: '2026-01-01', ...overrides };
}

function renderScreen() {
  return render(withProviders(<ExplorePlusScreen />));
}

beforeEach(() => {
  jest.clearAllMocks();
  updateUser = jest.fn().mockImplementation((next) => Promise.resolve(next));
  mockUseAuth.mockReturnValue({ user: user(), updateUser });
  addBoosts = jest.fn();
  mockUseBoost.mockReturnValue({ addBoosts });
  notify = jest.fn().mockResolvedValue(undefined);
  confirm = jest.fn().mockResolvedValue(false);
  mockUseDialog.mockReturnValue({ notify, confirm });
  mockUseLikeLimit.mockReturnValue({ used: 2, limit: 5 });
  mockUsePrivacy.mockReturnValue({ prefs: { profileVisible: true } });
  mockUseMatches.mockReturnValue({ blockedProfiles: [] });
  (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([]);
});

describe('ExplorePlusScreen', () => {
  it('renders nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, updateUser });
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeNull();
  });

  it('shows the free-plan pricing options and daily like usage', () => {
    renderScreen();
    expect(screen.getByText('Free Trial')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Yearly')).toBeTruthy();
    expect(screen.getByText('2 of 5 daily likes used on the free plan')).toBeTruthy();
  });

  it('hides the trial option once the trial has been used', () => {
    mockUseAuth.mockReturnValue({ user: user({ hasUsedTrial: true }), updateUser });
    renderScreen();
    expect(screen.queryByText('Free Trial')).toBeNull();
  });

  it('switches to the yearly plan and shows its price', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Yearly'));
    expect(screen.getByText('PKR 8,990/yr')).toBeTruthy();
  });

  it('upgrades to Explore+ and grants boosts', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Upgrade to Explore+'));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ isExplorePlus: true, subscriptionPlan: 'monthly' })));
    await waitFor(() => expect(addBoosts).toHaveBeenCalledWith(5));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Welcome to Explore+' })));
  });

  it('shows a billing-pending notice when the upgrade write does not stick', async () => {
    updateUser.mockResolvedValue(user({ isExplorePlus: false }));
    renderScreen();
    fireEvent.press(screen.getByText('Upgrade to Explore+'));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Billing is not connected yet' }))
    );
    expect(addBoosts).not.toHaveBeenCalled();
  });

  it('starts a free trial', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Free Trial'));
    fireEvent.press(screen.getByText('Start free trial'));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ subscriptionPlan: 'trial' })));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('7-day free trial') }))
    );
  });

  it('shows the manage-subscription card for an existing Explore+ member', () => {
    mockUseAuth.mockReturnValue({
      user: user({ isExplorePlus: true, subscriptionPlan: 'yearly', subscriptionRenewsAt: '2027-01-01' }),
      updateUser,
    });
    renderScreen();
    expect(screen.getByText("You're on Explore+")).toBeTruthy();
    expect(screen.getByText('Cancel subscription')).toBeTruthy();
  });

  it('cancels the subscription after confirming', async () => {
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true, subscriptionPlan: 'monthly' }), updateUser });
    confirm.mockResolvedValue(true);
    renderScreen();

    fireEvent.press(screen.getByText('Cancel subscription'));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ isExplorePlus: false })));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Subscription cancelled' })));
  });

  it('does not cancel when the confirmation is declined', async () => {
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true, subscriptionPlan: 'monthly' }), updateUser });
    confirm.mockResolvedValue(false);
    renderScreen();

    fireEvent.press(screen.getByText('Cancel subscription'));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows admirers blurred for a free member', async () => {
    (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([admirer()]);
    renderScreen();

    await waitFor(() => expect(screen.queryByText('Bilal')).toBeNull());
    expect(screen.getByText("Upgrade to see who's already interested")).toBeTruthy();
  });

  it('shows admirer names unlocked for an Explore+ member', async () => {
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true, subscriptionPlan: 'monthly' }), updateUser });
    (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([admirer()]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Bilal')).toBeTruthy());
  });

  it('excludes blocked profiles from the admirers list', async () => {
    mockUseMatches.mockReturnValue({ blockedProfiles: [{ id: 'p1' }] });
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true }), updateUser });
    (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([admirer(), admirer({ id: 'p2', name: 'Sara' })]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy());
    expect(screen.queryByText('Bilal')).toBeNull();
  });

  it('shows a hidden-profile notice when profile visibility is off', () => {
    mockUsePrivacy.mockReturnValue({ prefs: { profileVisible: false } });
    renderScreen();
    expect(
      screen.getByText(
        "Your profile is hidden (Privacy & safety → Show my profile to others is off), so no one can see or like you right now."
      )
    ).toBeTruthy();
  });
});
