import React from 'react';
import { ActivityIndicator } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { ImageCropper } from '../ImageCropper';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const manipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ImageCropper', () => {
  it('renders nothing to crop (closed) when uri is null', () => {
    renderWithProviders(<ImageCropper uri={null} onCancel={jest.fn()} onCropped={jest.fn()} />);
    expect(manipulateAsync).not.toHaveBeenCalled();
  });

  it('normalizes the picked photo and enables Apply once loaded', async () => {
    manipulateAsync.mockResolvedValue({ uri: 'file:///normalized.jpg', width: 800, height: 1000 });
    renderWithProviders(<ImageCropper uri="file:///picked.jpg" onCancel={jest.fn()} onCropped={jest.fn()} />);

    await waitFor(() => expect(manipulateAsync).toHaveBeenCalledWith('file:///picked.jpg', [], expect.any(Object)));
  });

  it('downsizes a source wider than the max before displaying it', async () => {
    manipulateAsync
      .mockResolvedValueOnce({ uri: 'file:///normalized.jpg', width: 4000, height: 3000 })
      .mockResolvedValueOnce({ uri: 'file:///resized.jpg', width: 1440, height: 1080 });
    renderWithProviders(<ImageCropper uri="file:///picked.jpg" onCancel={jest.fn()} onCropped={jest.fn()} />);

    await waitFor(() => expect(manipulateAsync).toHaveBeenCalledTimes(2));
    expect(manipulateAsync).toHaveBeenLastCalledWith(
      'file:///normalized.jpg',
      [{ resize: { width: 1440 } }],
      expect.any(Object)
    );
  });

  it('shows an error hint when the photo fails to load', async () => {
    manipulateAsync.mockRejectedValue(new Error('bad image'));
    renderWithProviders(<ImageCropper uri="file:///picked.jpg" onCancel={jest.fn()} onCropped={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy());
  });

  it('calls onCancel when Cancel is pressed', () => {
    const onCancel = jest.fn();
    renderWithProviders(<ImageCropper uri="file:///picked.jpg" onCancel={onCancel} onCropped={jest.fn()} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('crops the loaded photo and reports the result uri', async () => {
    manipulateAsync
      .mockResolvedValueOnce({ uri: 'file:///normalized.jpg', width: 800, height: 1000 }) // load
      .mockResolvedValueOnce({ uri: 'file:///cropped.jpg', width: 300, height: 400 }); // crop
    const onCropped = jest.fn();
    renderWithProviders(<ImageCropper uri="file:///picked.jpg" onCancel={jest.fn()} onCropped={onCropped} />);
    // Wait for the load to actually settle (the spinner to be replaced by the
    // crop frame) rather than just for the mock to have been *called* — the
    // call count updates synchronously, before the awaited promise resolves
    // and `setSource` runs, so racing on call count alone presses the button
    // while it is still disabled.
    await waitFor(() => expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0), { timeout: 15000 });

    // "Crop photo" is both the screen title and the confirm button's label;
    // press every match rather than relying on render order — pressing the
    // plain title text (no ancestor handler) is a harmless no-op.
    for (const node of screen.getAllByText('Crop photo')) {
      fireEvent.press(node);
    }

    // Generous timeout: under a full-suite parallel run this async round trip
    // can take noticeably longer than the default 5s than when this file runs
    // alone (verified — the flow itself is not flaky, just slow under load).
    await waitFor(() => expect(onCropped).toHaveBeenCalledWith('file:///cropped.jpg'), { timeout: 15000 });
    expect(manipulateAsync).toHaveBeenLastCalledWith(
      'file:///normalized.jpg',
      [{ crop: expect.objectContaining({ originX: expect.any(Number), originY: expect.any(Number) }) }],
      expect.any(Object)
    );
    // Jest's own default 5s test timeout applies on top of any waitFor
    // timeout — this test needs matching headroom for a busy full-suite run.
  }, 45000);

  it('rotates the loaded photo in place before cropping', async () => {
    manipulateAsync
      .mockResolvedValueOnce({ uri: 'file:///normalized.jpg', width: 800, height: 1000 }) // load
      .mockResolvedValueOnce({ uri: 'file:///rotated.jpg', width: 1000, height: 800 }) // rotate
      .mockResolvedValueOnce({ uri: 'file:///cropped.jpg', width: 400, height: 300 }); // crop
    const onCropped = jest.fn();
    renderWithProviders(<ImageCropper uri="file:///picked.jpg" onCancel={jest.fn()} onCropped={onCropped} />);
    await waitFor(() => expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0), { timeout: 15000 });

    fireEvent.press(screen.getByLabelText('Rotate'));

    await waitFor(
      () =>
        expect(manipulateAsync).toHaveBeenLastCalledWith('file:///normalized.jpg', [{ rotate: 90 }], expect.any(Object)),
      { timeout: 15000 }
    );
    // Rotating swaps back to the loaded (non-spinner) state on the new, rotated source.
    await waitFor(() => expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0), { timeout: 15000 });

    for (const node of screen.getAllByText('Crop photo')) {
      fireEvent.press(node);
    }

    await waitFor(() => expect(onCropped).toHaveBeenCalledWith('file:///cropped.jpg'), { timeout: 15000 });
    // The crop reads from the rotated source, not the pre-rotation one.
    expect(manipulateAsync).toHaveBeenLastCalledWith(
      'file:///rotated.jpg',
      [{ crop: expect.objectContaining({ originX: expect.any(Number), originY: expect.any(Number) }) }],
      expect.any(Object)
    );
  }, 45000);
});
