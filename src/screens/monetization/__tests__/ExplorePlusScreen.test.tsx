import React from 'react';
import { Linking } from 'react-native';
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
import {
  fetchExplorePlusPackages,
  purchaseExplorePlus,
  syncExplorePlusEntitlement,
  PurchaseCancelledError,
} from '../../../services/billingService';
import type { UserProfile } from '../../../types/user';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../../store/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/BoostContext', () => ({ useBoost: jest.fn() }));
jest.mock('../../../store/DialogContext', () => ({ useDialog: jest.fn() }));
jest.mock('../../../store/LikeLimitContext', () => ({ useLikeLimit: jest.fn() }));
jest.mock('../../../store/PrivacyContext', () => ({ usePrivacy: jest.fn() }));
jest.mock('../../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('../../../services/likesService', () => ({ likesService: { fetchLikesReceived: jest.fn() } }));
jest.mock('../../../services/billingService', () => ({
  fetchExplorePlusPackages: jest.fn(),
  purchaseExplorePlus: jest.fn(),
  syncExplorePlusEntitlement: jest.fn(),
  PurchaseCancelledError: class PurchaseCancelledError extends Error {},
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseBoost = useBoost as jest.Mock;
const mockUseDialog = useDialog as jest.Mock;
const mockUseLikeLimit = useLikeLimit as jest.Mock;
const mockUsePrivacy = usePrivacy as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const mockFetchPackages = fetchExplorePlusPackages as jest.Mock;
const mockPurchase = purchaseExplorePlus as jest.Mock;
const mockSync = syncExplorePlusEntitlement as jest.Mock;

let refreshUser: jest.Mock;
let addBoosts: jest.Mock;
let notify: jest.Mock;

const monthlyPackage = { identifier: '$rc_monthly', product: { identifier: 'explore_plus_monthly', priceString: 'PKR 999/mo' } };
const yearlyPackage = { identifier: '$rc_annual', product: { identifier: 'explore_plus_yearly', priceString: 'PKR 8,990/yr' } };

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
  refreshUser = jest.fn().mockResolvedValue(user({ isExplorePlus: true, subscriptionPlan: 'monthly' }));
  mockUseAuth.mockReturnValue({ user: user(), refreshUser });
  addBoosts = jest.fn();
  mockUseBoost.mockReturnValue({ addBoosts });
  notify = jest.fn().mockResolvedValue(undefined);
  mockUseDialog.mockReturnValue({ notify, confirm: jest.fn().mockResolvedValue(false) });
  mockUseLikeLimit.mockReturnValue({ used: 2, limit: 5 });
  mockUsePrivacy.mockReturnValue({ prefs: { profileVisible: true } });
  mockUseMatches.mockReturnValue({ blockedProfiles: [] });
  (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([]);
  mockFetchPackages.mockResolvedValue({ monthly: monthlyPackage, yearly: yearlyPackage });
  mockPurchase.mockResolvedValue(true);
  mockSync.mockResolvedValue(undefined);
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
});

describe('ExplorePlusScreen', () => {
  it('renders nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, refreshUser });
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
    mockUseAuth.mockReturnValue({ user: user({ hasUsedTrial: true }), refreshUser });
    renderScreen();
    expect(screen.queryByText('Free Trial')).toBeNull();
  });

  it('shows real Play prices once billing is available', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('PKR 999/mo')).toBeTruthy());
    fireEvent.press(screen.getByText('Yearly'));
    expect(screen.getByText('PKR 8,990/yr')).toBeTruthy();
  });

  it('falls back to the static price when billing is unavailable', async () => {
    mockFetchPackages.mockResolvedValue(null);
    renderScreen();
    await waitFor(() => expect(mockFetchPackages).toHaveBeenCalled());
    expect(screen.getByText('PKR 999/mo')).toBeTruthy();
  });

  it('buys the monthly package, syncs the entitlement, and grants boosts', async () => {
    renderScreen();
    await waitFor(() => expect(mockFetchPackages).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Upgrade to Explore+'));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith(monthlyPackage));
    await waitFor(() => expect(mockSync).toHaveBeenCalled());
    await waitFor(() => expect(addBoosts).toHaveBeenCalledWith(5));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Welcome to Explore+' })));
  });

  it('starts a free trial by buying the monthly package', async () => {
    refreshUser.mockResolvedValue(user({ isExplorePlus: true, subscriptionPlan: 'trial' }));
    renderScreen();
    await waitFor(() => expect(mockFetchPackages).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Free Trial'));
    fireEvent.press(screen.getByText('Start free trial'));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith(monthlyPackage));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('7-day free trial') }))
    );
  });

  it('shows a billing-pending notice when no Play package is available', async () => {
    mockFetchPackages.mockResolvedValue(null);
    renderScreen();
    await waitFor(() => expect(mockFetchPackages).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Upgrade to Explore+'));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Billing is not connected yet' }))
    );
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(addBoosts).not.toHaveBeenCalled();
  });

  it('shows a billing-pending notice when the purchase does not stick', async () => {
    refreshUser.mockResolvedValue(user({ isExplorePlus: false }));
    renderScreen();
    await waitFor(() => expect(mockFetchPackages).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Upgrade to Explore+'));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Billing is not connected yet' }))
    );
    expect(addBoosts).not.toHaveBeenCalled();
  });

  it('says nothing when the member cancels the Play purchase sheet', async () => {
    mockPurchase.mockRejectedValue(new PurchaseCancelledError());
    renderScreen();
    await waitFor(() => expect(mockFetchPackages).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Upgrade to Explore+'));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalled());
    expect(notify).not.toHaveBeenCalled();
  });

  it('shows the manage-subscription card for an existing Explore+ member', () => {
    mockUseAuth.mockReturnValue({
      user: user({ isExplorePlus: true, subscriptionPlan: 'yearly', subscriptionRenewsAt: '2027-01-01' }),
      refreshUser,
    });
    renderScreen();
    expect(screen.getByText("You're on Explore+")).toBeTruthy();
    expect(screen.getByText('Manage subscription')).toBeTruthy();
  });

  it('opens Play Store subscription management', async () => {
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true, subscriptionPlan: 'monthly' }), refreshUser });
    renderScreen();

    fireEvent.press(screen.getByText('Manage subscription'));

    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://play.google.com/store/account/subscriptions?package=com.rishtaandrang.app'
      )
    );
  });

  it('shows a fallback notice when the Play Store link cannot be opened', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true, subscriptionPlan: 'monthly' }), refreshUser });
    renderScreen();

    fireEvent.press(screen.getByText('Manage subscription'));

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('shows admirers blurred for a free member', async () => {
    (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([admirer()]);
    renderScreen();

    await waitFor(() => expect(screen.queryByText('Bilal')).toBeNull());
    expect(screen.getByText("Upgrade to see who's already interested")).toBeTruthy();
  });

  it('shows admirer names unlocked for an Explore+ member', async () => {
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true, subscriptionPlan: 'monthly' }), refreshUser });
    (likesService.fetchLikesReceived as jest.Mock).mockResolvedValue([admirer()]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Bilal')).toBeTruthy());
  });

  it('excludes blocked profiles from the admirers list', async () => {
    mockUseMatches.mockReturnValue({ blockedProfiles: [{ id: 'p1' }] });
    mockUseAuth.mockReturnValue({ user: user({ isExplorePlus: true }), refreshUser });
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
