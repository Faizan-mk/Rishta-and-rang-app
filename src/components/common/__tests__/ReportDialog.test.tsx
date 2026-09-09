import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ReportDialog } from '../ReportDialog';

describe('ReportDialog', () => {
  it('renders nothing when not visible', () => {
    renderWithProviders(<ReportDialog visible={false} name="Sara" onCancel={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByText('Submit report')).toBeNull();
  });

  it('shows a validation error when submitting with no reason selected', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<ReportDialog visible name="Sara" onCancel={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('Submit report'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits with the selected reason and empty details', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<ReportDialog visible name="Sara" onCancel={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('Spam or scam'));
    fireEvent.press(screen.getByText('Submit report'));
    expect(onSubmit).toHaveBeenCalledWith({ reason: 'spam', details: '' });
  });

  it('requires custom text when "Other" is selected', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<ReportDialog visible name="Sara" onCancel={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('Other'));
    fireEvent.press(screen.getByText('Submit report'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the typed custom text for "Other"', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<ReportDialog visible name="Sara" onCancel={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('Other'));
    fireEvent.changeText(screen.getByPlaceholderText('Describe the issue...'), 'They asked for money');
    fireEvent.press(screen.getByText('Submit report'));
    expect(onSubmit).toHaveBeenCalledWith({ reason: 'other', details: 'They asked for money' });
  });

  it('calls onCancel when the Cancel button is pressed, resetting the selection', () => {
    const onCancel = jest.fn();
    renderWithProviders(<ReportDialog visible name="Sara" onCancel={onCancel} onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByText('Spam or scam'));
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('includes the reported member\'s name in the title', () => {
    renderWithProviders(<ReportDialog visible name="Sara" onCancel={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.getByText(/Sara/)).toBeTruthy();
  });
});
