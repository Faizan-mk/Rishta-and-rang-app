import * as ImageManipulator from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';
import { analyzeIdCardPhoto } from '../idCardImageCheck';

// This heuristic pipeline is resize -> decode -> pixel-ratio checks. Both native
// steps are mocked so each branch (tooSmall / wrongShape / notCardColored / valid)
// can be driven directly without a real image.

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('jpeg-js', () => ({
  decode: jest.fn(),
}));

const manipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;
const decode = jpeg.decode as jest.Mock;

// Builds RGBA pixel data where a `greenRatio` share of pixels are card-green and
// a `lightRatio` share are bright white, matching the thresholds in the source.
function buildPixels(totalPixels: number, greenRatio: number, lightRatio: number): Uint8Array {
  const data = new Uint8Array(totalPixels * 4);
  const greenCount = Math.round(totalPixels * greenRatio);
  const lightCount = Math.round(totalPixels * lightRatio);
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    if (i < greenCount) {
      data[offset] = 20; // r
      data[offset + 1] = 150; // g
      data[offset + 2] = 20; // b
    } else if (i < greenCount + lightCount) {
      data[offset] = 200;
      data[offset + 1] = 200;
      data[offset + 2] = 200;
    } else {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }
    data[offset + 3] = 255;
  }
  return data;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('analyzeIdCardPhoto', () => {
  it('flags tooSmall when the resize produces no base64/dimensions', async () => {
    manipulateAsync.mockResolvedValue({ base64: undefined, width: 0, height: 0 });

    const result = await analyzeIdCardPhoto('file://photo.jpg');

    expect(result).toEqual({ looksValid: false, reason: 'tooSmall' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('flags wrongShape when the aspect ratio is not card-like', async () => {
    manipulateAsync.mockResolvedValue({ base64: 'AAAA', width: 48, height: 48 }); // 1:1, outside 1.2-2.2

    const result = await analyzeIdCardPhoto('file://photo.jpg');

    expect(result).toEqual({ looksValid: false, reason: 'wrongShape' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('accepts a portrait-oriented photo of a landscape card (camera held upright)', async () => {
    manipulateAsync.mockResolvedValue({ base64: 'AAAA', width: 30, height: 48 }); // same ~1.6 ratio, rotated
    decode.mockReturnValue({ data: buildPixels(100, 0.3, 0.3), width: 10, height: 10 });

    const result = await analyzeIdCardPhoto('file://photo.jpg');

    expect(result).toEqual({ looksValid: true });
  });

  it('flags notCardColored when both green and light pixel ratios are too low', async () => {
    manipulateAsync.mockResolvedValue({ base64: 'AAAA', width: 48, height: 30 }); // ~1.6 aspect, valid shape
    decode.mockReturnValue({ data: buildPixels(100, 0, 0), width: 10, height: 10 });

    const result = await analyzeIdCardPhoto('file://photo.jpg');

    expect(result).toEqual({ looksValid: false, reason: 'notCardColored' });
  });

  it('accepts an image with a plausible CNIC color profile and aspect ratio', async () => {
    manipulateAsync.mockResolvedValue({ base64: 'AAAA', width: 48, height: 30 });
    decode.mockReturnValue({ data: buildPixels(100, 0.3, 0.3), width: 10, height: 10 });

    const result = await analyzeIdCardPhoto('file://photo.jpg');

    expect(result).toEqual({ looksValid: true });
  });

  it('accepts a mostly-green photo even when the card does not fill the frame with white', async () => {
    manipulateAsync.mockResolvedValue({ base64: 'AAAA', width: 48, height: 30 });
    decode.mockReturnValue({ data: buildPixels(100, 0.2, 0), width: 10, height: 10 });

    const result = await analyzeIdCardPhoto('file://photo.jpg');

    expect(result).toEqual({ looksValid: true });
  });

  it('accepts a mostly-light photo even with little green (e.g. an older-style ID card)', async () => {
    manipulateAsync.mockResolvedValue({ base64: 'AAAA', width: 48, height: 30 });
    decode.mockReturnValue({ data: buildPixels(100, 0, 0.2), width: 10, height: 10 });

    const result = await analyzeIdCardPhoto('file://photo.jpg');

    expect(result).toEqual({ looksValid: true });
  });

  it('passes the resize width and JPEG format through to the manipulator', async () => {
    manipulateAsync.mockResolvedValue({ base64: 'AAAA', width: 48, height: 30 });
    decode.mockReturnValue({ data: buildPixels(100, 0.3, 0.3), width: 10, height: 10 });

    await analyzeIdCardPhoto('file://photo.jpg');

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://photo.jpg',
      [{ resize: { width: 48 } }],
      expect.objectContaining({ format: 'jpeg', base64: true })
    );
  });
});
