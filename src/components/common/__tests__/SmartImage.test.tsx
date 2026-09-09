import React from 'react';
import { Image } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders, withProviders } from '../../__tests__/testWrappers';
import { SmartImage } from '../SmartImage';
import { cachedImageUri } from '../../../services/imageCache';

jest.mock('../../../services/imageCache', () => ({ cachedImageUri: jest.fn() }));

const mockCachedImageUri = cachedImageUri as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCachedImageUri.mockResolvedValue(null);
});

describe('SmartImage', () => {
  it('renders the remote image when a uri is given', () => {
    renderWithProviders(<SmartImage uri="https://cdn.example.com/a.jpg" />);
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn.example.com/a.jpg' });
  });

  it('swaps in the cached local file once it resolves', async () => {
    mockCachedImageUri.mockResolvedValue('file:///cache/a.jpg');
    renderWithProviders(<SmartImage uri="https://cdn.example.com/a.jpg" />);
    await waitFor(() =>
      expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///cache/a.jpg' })
    );
  });

  it('shows initials from the name when there is no uri', () => {
    renderWithProviders(<SmartImage name="Ayesha Khan" />);
    expect(screen.getByText('AK')).toBeTruthy();
  });

  it('shows a generic person icon when there is no uri and no name', () => {
    renderWithProviders(<SmartImage />);
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('falls back to the initials tile once the remote image errors', () => {
    renderWithProviders(<SmartImage uri="https://cdn.example.com/broken.jpg" name="Ayesha Khan" />);
    fireEvent(screen.UNSAFE_getByType(Image), 'error');
    expect(screen.getByText('AK')).toBeTruthy();
  });

  it('falls back to the network copy once before giving up, when the cached file fails to decode', async () => {
    mockCachedImageUri.mockResolvedValue('file:///cache/a.jpg');
    renderWithProviders(<SmartImage uri="https://cdn.example.com/a.jpg" name="Ayesha Khan" />);
    await waitFor(() =>
      expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///cache/a.jpg' })
    );

    fireEvent(screen.UNSAFE_getByType(Image), 'error'); // cached copy failed
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn.example.com/a.jpg' });

    fireEvent(screen.UNSAFE_getByType(Image), 'error'); // network copy also failed
    expect(screen.getByText('AK')).toBeTruthy();
  });

  it('resets a previous failure once given a new uri', () => {
    const { rerender } = renderWithProviders(<SmartImage uri="https://cdn.example.com/broken.jpg" name="Ayesha Khan" />);
    fireEvent(screen.UNSAFE_getByType(Image), 'error');
    expect(screen.getByText('AK')).toBeTruthy();

    rerender(withProviders(<SmartImage uri="https://cdn.example.com/good.jpg" name="Ayesha Khan" />));
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn.example.com/good.jpg' });
  });
});
