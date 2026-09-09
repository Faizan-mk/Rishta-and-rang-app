import React from 'react';
import { Switch } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { SettingsRow } from '../SettingsRow';

describe('SettingsRow', () => {
  it('renders the label and optional description', () => {
    renderWithProviders(<SettingsRow label="Notifications" description="Manage alerts" />);
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Manage alerts')).toBeTruthy();
  });

  it('renders no description text when none is given', () => {
    renderWithProviders(<SettingsRow label="Notifications" />);
    expect(screen.queryByText('Manage alerts')).toBeNull();
  });

  it('calls onPress when the row itself is tappable', () => {
    const onPress = jest.fn();
    renderWithProviders(<SettingsRow label="Blocked users" onPress={onPress} right="chevron" />);
    fireEvent.press(screen.getByText('Blocked users'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('toggles a switch row and reports the new value', () => {
    const onSwitchChange = jest.fn();
    renderWithProviders(
      <SettingsRow label="Show online status" right="switch" switchValue={false} onSwitchChange={onSwitchChange} />
    );
    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);
    expect(onSwitchChange).toHaveBeenCalledWith(true);
  });

  it('reflects the current switch value', () => {
    renderWithProviders(<SettingsRow label="Show online status" right="switch" switchValue={true} onSwitchChange={jest.fn()} />);
    expect(screen.UNSAFE_getByType(Switch).props.value).toBe(true);
  });
});
