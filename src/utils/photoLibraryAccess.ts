import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Whether the photo library may be opened.
 *
 * Android opens the system Photo Picker, which needs no permission at all —
 * and the app no longer declares READ_MEDIA_IMAGES (app.json blocks it):
 * Google Play only allows that permission to apps whose core purpose is the
 * gallery. Asking for it anyway would come back denied and block every pick.
 * iOS still asks, as before.
 */
export async function canOpenPhotoLibrary(): Promise<boolean> {
  if (Platform.OS === 'android') return true;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}
