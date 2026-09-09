import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { render } from '@testing-library/react-native';
import { CollapsibleTabBar } from '../CollapsibleTabBar';
import { ThemeProvider } from '../../store/ThemeContext';
import { TabBarVisibilityProvider } from '../../store/TabBarVisibilityContext';
import { useAuth } from '../../store/AuthContext';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function route(name: string) {
  return { key: `${name}-key`, name };
}

function buildProps(focusedIndex: number, emit: jest.Mock, navigate: jest.Mock): BottomTabBarProps {
  const routes = [route('home'), route('explore'), route('messages'), route('profile')];
  const descriptors = {
    'home-key': { options: { title: 'Home' } },
    'explore-key': { options: { title: 'Explore' } },
    'messages-key': { options: { title: 'Messages', tabBarBadge: 3 } },
    'profile-key': { options: { title: 'Menu' } },
  };
  return {
    state: { routes, index: focusedIndex } as never,
    descriptors: descriptors as never,
    navigation: { emit, navigate } as never,
    insets: { top: 0, bottom: 0, left: 0, right: 0 } as never,
  };
}

function renderTabBar(props: BottomTabBarProps) {
  return render(
    <ThemeProvider>
      <TabBarVisibilityProvider>
        <CollapsibleTabBar {...props} />
      </TabBarVisibilityProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { activeMode: 'dating' } });
});

describe('CollapsibleTabBar', () => {
  it('renders a label for every tab', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    renderTabBar(buildProps(0, emit, jest.fn()));
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('Messages')).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
  });

  it('shows the badge count on the tab that has one', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    renderTabBar(buildProps(0, emit, jest.fn()));
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('caps a large badge at "9+"', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const props = buildProps(0, emit, jest.fn());
    (props.descriptors as never as Record<string, { options: { tabBarBadge?: number } }>)['messages-key'].options.tabBarBadge = 42;
    renderTabBar(props);
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('navigates to a tapped tab that is not already focused', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigate = jest.fn();
    renderTabBar(buildProps(0, emit, navigate));

    fireEvent.press(screen.getByText('Explore'));

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'explore-key' }));
    expect(navigate).toHaveBeenCalledWith('explore');
  });

  it('does not navigate when the tab press event was prevented by a listener', () => {
    const emit = jest.fn(() => ({ defaultPrevented: true }));
    const navigate = jest.fn();
    renderTabBar(buildProps(0, emit, navigate));

    fireEvent.press(screen.getByText('Explore'));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not re-navigate to the already-focused tab', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigate = jest.fn();
    renderTabBar(buildProps(0, emit, navigate));

    fireEvent.press(screen.getByText('Home'));

    expect(navigate).not.toHaveBeenCalled();
  });
});
