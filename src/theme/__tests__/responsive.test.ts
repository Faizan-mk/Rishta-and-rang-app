// `scaleFont`/`scaleSpace` are moderate-scale helpers built on a device-scale
// constant computed once, at import time, from `Dimensions.get('window')`. To
// see how they behave at different screen widths, each scenario mocks
// `react-native` and re-imports the module inside its own sandbox — the only
// way to get a fresh evaluation of that top-level constant.
function loadResponsive(width: number, os: 'ios' | 'android' | 'web' = 'ios') {
  let mod!: typeof import('../responsive');
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Dimensions: { get: () => ({ width, height: 800, scale: 2, fontScale: 1 }) },
      Platform: { OS: os },
    }));
    mod = require('../responsive');
  });
  return mod;
}

describe('scaleFont / scaleSpace', () => {
  it('returns the input size unchanged at the 375pt design baseline', () => {
    const { scaleFont, scaleSpace } = loadResponsive(375);
    expect(scaleFont(16)).toBe(16);
    expect(scaleSpace(16)).toBe(16);
  });

  it('scales up on a wider (tablet-class) device, but by less than the raw ratio', () => {
    const { scaleFont } = loadResponsive(750); // raw scale 2x
    const scaled = scaleFont(16);
    expect(scaled).toBeGreaterThan(16);
    expect(scaled).toBeLessThan(32); // dampened, not a straight 2x
  });

  it('scales down (but stays legible) on a narrower device', () => {
    const { scaleFont } = loadResponsive(320);
    expect(scaleFont(16)).toBeLessThan(16);
  });

  it('scales space more aggressively than font at the same width (factor 0.4 vs 0.3)', () => {
    const { scaleFont, scaleSpace } = loadResponsive(750);
    const fontGrowth = scaleFont(100) - 100;
    const spaceGrowth = scaleSpace(100) - 100;
    expect(spaceGrowth).toBeGreaterThan(fontGrowth);
  });

  it('clamps the device scale on an extreme width rather than scaling without bound', () => {
    const unclamped = loadResponsive(20_000); // would be a ~53x raw ratio
    const clamped = loadResponsive(375 * 2.2); // exactly the MAX_SCALE boundary
    expect(unclamped.scaleFont(16)).toBe(clamped.scaleFont(16));
  });

  it('caps the reference width used on web so a wide browser window does not balloon text', () => {
    const web = loadResponsive(2000, 'web');
    const nativeAtCap = loadResponsive(480); // WEB_MAX_REFERENCE_WIDTH
    expect(web.scaleFont(16)).toBe(nativeAtCap.scaleFont(16));
  });
});
