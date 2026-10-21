import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { canOpenPhotoLibrary } from '../utils/photoLibraryAccess';
import { useDialog } from '../store/DialogContext';
import { useLanguage } from '../store/LanguageContext';
import { useStories } from '../store/StoriesContext';
import { MAX_STORY_VIDEO_SEC } from '../services/storiesService';

// Picks a photo or a short video from the library and posts it as a story.
export function useAddStory() {
  const { post, posting } = useStories();
  const { notify } = useDialog();
  const { t } = useLanguage();

  const addStory = useCallback(async () => {
    if (posting) return;
    if (!(await canOpenPhotoLibrary())) {
      await notify({ title: t('permissions.photoLibraryTitle'), message: t('permissions.photoLibraryBody') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: MAX_STORY_VIDEO_SEC,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;

    const isVideo = asset.type === 'video';
    // The picker reports a video's length in milliseconds. Android ignores
    // `videoMaxDuration` for library picks, so the cap is checked here too.
    const durationSec = isVideo && asset.duration ? asset.duration / 1000 : undefined;
    if (durationSec && durationSec > MAX_STORY_VIDEO_SEC + 0.5) {
      await notify({
        title: t('stories.videoTooLongTitle'),
        message: t('stories.videoTooLongBody', { seconds: MAX_STORY_VIDEO_SEC }),
      });
      return;
    }

    try {
      await post(asset.uri, isVideo ? 'video' : 'image', asset.mimeType, durationSec);
    } catch {
      await notify({ title: t('stories.postFailedTitle'), message: t('stories.postFailedBody') });
    }
  }, [posting, post, notify, t]);

  return { addStory, posting };
}
