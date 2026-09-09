import React from 'react';
import TabsLayout from '../(tabs)/_layout';
import { renderWithProviders } from '../../components/__tests__/testWrappers';
import { useNotifications } from '../../store/NotificationContext';
import { useMatches } from '../../store/MatchesContext';
import { screen } from '@testing-library/react-native';

// expo-router's real <Tabs>/<Tabs.Screen> resolve the current route from the
// router's own file-based context, which doesn't exist outside the real app —
// rendering them standalone throws "No filename found". Stubbing them lets
// this test verify TabsLayout's own logic (which badge count goes on which
// tab) without needing the router harness.
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { Text } = require('react-native');
  function TabsScreen({ options }: { options?: { title?: string; tabBarBadge?: number } }) {
    return ReactActual.createElement(
      Text,
      null,
      options?.title,
      options?.tabBarBadge !== undefined ? ` [badge:${options.tabBarBadge}]` : ''
    );
  }
  function TabsMock({ children }: { children: React.ReactNode }) {
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }
  TabsMock.Screen = TabsScreen;
  return { Tabs: TabsMock };
});
jest.mock('../../store/NotificationContext', () => ({ useNotifications: jest.fn() }));
jest.mock('../../store/MatchesContext', () => ({ useMatches: jest.fn() }));
jest.mock('../../components/CollapsibleTabBar', () => ({ CollapsibleTabBar: () => null }));

const mockUseNotifications = useNotifications as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TabsLayout', () => {
  it('shows no home tab badge when there are no unread notifications', () => {
    mockUseNotifications.mockReturnValue({ unreadCount: 0 });
    mockUseMatches.mockReturnValue({ unreadCount: 0 });
    renderWithProviders(<TabsLayout />);
    expect(screen.queryByText(/badge:/)).toBeNull();
  });

  it('wires the notifications unread count to the home tab badge', () => {
    mockUseNotifications.mockReturnValue({ unreadCount: 3 });
    mockUseMatches.mockReturnValue({ unreadCount: 0 });
    renderWithProviders(<TabsLayout />);
    expect(screen.getByText(/badge:3/)).toBeTruthy();
  });

  it('wires the matches unread count to the messages tab badge', () => {
    mockUseNotifications.mockReturnValue({ unreadCount: 0 });
    mockUseMatches.mockReturnValue({ unreadCount: 5 });
    renderWithProviders(<TabsLayout />);
    expect(screen.getByText(/badge:5/)).toBeTruthy();
  });
});
