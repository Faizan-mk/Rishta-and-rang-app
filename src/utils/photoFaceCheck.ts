import FaceDetection from '@react-native-ml-kit/face-detection';

// Every profile photo has to show a face (on-device, ML Kit), so a flower, a
// car or a meme can't stand in for a member. Like cnicPhotoMatch, this is a
// guard against casual misuse, not identity verification: it says a face is
// there, not whose face it is, and it runs in the app.

// The smallest face counted, as a share of the photo's width: a face in the
// far background of a landscape shouldn't pass for a profile photo.
const MIN_FACE_SIZE = 0.15;

export type PhotoFaceCheck = 'face' | 'noFace' | 'unavailable';

export async function checkPhotoFace(uri: string): Promise<PhotoFaceCheck> {
  try {
    const faces = await FaceDetection.detect(uri, { performanceMode: 'accurate', minFaceSize: MIN_FACE_SIZE });
    return faces.length > 0 ? 'face' : 'noFace';
  } catch {
    // Expo Go and web have no native module. Unlike the CNIC check this lets
    // the photo through: store builds always carry the module, and a member
    // shouldn't be stuck on signup because detection itself failed.
    return 'unavailable';
  }
}
