import React from 'react';
import { Image } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import { PhotoStrip } from '../PhotoStrip';

describe('PhotoStrip', () => {
  it('renders an empty placeholder and no images when there are no photos', () => {
    renderWithProviders(<PhotoStrip photos={[]} />);
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('renders only the primary photo when there is exactly one', () => {
    renderWithProviders(<PhotoStrip photos={['a.jpg']} />);
    const images = screen.UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'a.jpg' });
  });

  it('renders the primary photo plus a thumbnail strip for the rest', () => {
    renderWithProviders(<PhotoStrip photos={['a.jpg', 'b.jpg', 'c.jpg']} />);
    const images = screen.UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(3);
    expect(images[0].props.source).toEqual({ uri: 'a.jpg' });
    expect(images.slice(1).map((img) => img.props.source)).toEqual([{ uri: 'b.jpg' }, { uri: 'c.jpg' }]);
  });
});
