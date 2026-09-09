import { withAlpha, modeAccent, glow } from '../glow';
import { lightPalette } from '../palettes';

describe('withAlpha', () => {
  it('converts a 6-digit hex color to an rgba() string', () => {
    expect(withAlpha('#FF8800', 0.5)).toBe('rgba(255, 136, 0, 0.5)');
  });

  it('is case-insensitive on the hex digits', () => {
    expect(withAlpha('#ff8800', 0.5)).toBe(withAlpha('#FF8800', 0.5));
  });

  it('hands back anything that is not a plain 6-digit hex untouched', () => {
    expect(withAlpha('rgba(1,2,3,1)', 0.5)).toBe('rgba(1,2,3,1)');
    expect(withAlpha('#fff', 0.5)).toBe('#fff'); // 3-digit shorthand not supported
    expect(withAlpha('transparent', 0.5)).toBe('transparent');
  });
});

describe('modeAccent', () => {
  it('uses the dating hue for dating and rishta hue for rishta', () => {
    const dating = modeAccent(lightPalette, 'dating');
    const rishta = modeAccent(lightPalette, 'rishta');
    expect(dating.primary).toBe(lightPalette.dating);
    expect(rishta.primary).toBe(lightPalette.rishta);
    expect(dating.secondary).toBe(lightPalette.gold);
    expect(rishta.secondary).toBe(lightPalette.teal);
  });

  it('builds a 3-stop ramp and a 2-stop duo from the same two hues', () => {
    const accent = modeAccent(lightPalette, 'dating');
    expect(accent.ramp).toHaveLength(3);
    expect(accent.ramp[0]).toBe(accent.primary);
    expect(accent.ramp[2]).toBe(accent.secondary);
    expect(accent.duo).toEqual([accent.primary, accent.secondary]);
  });

  it('fades the wash to fully transparent as its last stop', () => {
    const accent = modeAccent(lightPalette, 'rishta');
    expect(accent.wash[2]).toBe('transparent');
  });
});

describe('glow', () => {
  it('applies sensible defaults', () => {
    const style = glow('#FF0000');
    expect(style).toEqual({
      shadowColor: '#FF0000',
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    });
  });

  it('honours explicit overrides', () => {
    const style = glow('#00FF00', 0.8, 24, 12);
    expect(style).toMatchObject({ shadowOpacity: 0.8, shadowRadius: 24, elevation: 12 });
  });
});
