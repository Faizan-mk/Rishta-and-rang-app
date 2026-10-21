import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BottomSheet } from '../../components/common/BottomSheet';
import { ReportDialog, type ReportSubmission } from '../../components/common/ReportDialog';
import { fonts, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { useAuth } from '../../store/AuthContext';
import { useDialog } from '../../store/DialogContext';
import { useLanguage } from '../../store/LanguageContext';
import { useMatches } from '../../store/MatchesContext';
import { useStories } from '../../store/StoriesContext';
import { useTheme } from '../../store/ThemeContext';
import { reportsService } from '../../services/reportsService';
import { MAX_STORY_VIDEO_SEC, storiesService } from '../../services/storiesService';
import { timeAgo } from '../../utils/time';
import type { StoryGroup, StoryViewer } from '../../types/content';

// How long a photo stays up.
const IMAGE_MS = 5000;
const TICK_MS = 50;
// How far, or how fast, a downward swipe has to go to close the viewer.
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 800;

function firstUnseen(group: StoryGroup): number {
  const index = group.stories.findIndex((s) => !s.seen);
  return index === -1 ? 0 : index;
}

// Full-screen story player. Opened on one person's circle; for anyone else it
// carries on into the next people in the strip, the way Instagram does. Tap the
// right side for the next story, the left for the previous one, hold to pause,
// swipe down to close.
export function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { confirm, notify } = useDialog();
  const { mine, others, markSeen, toggleLike, remove, refresh } = useStories();
  const { matches, blockMatch, blockProfile } = useMatches();

  const isMine = userId === user?.id;
  // Other people's groups are fixed when the viewer opens, so marking a story
  // seen (which reorders the strip) never shifts what is playing. The member's
  // own group stays live, so a deleted story drops out at once.
  const [othersAtOpen] = useState(() => {
    const start = others.findIndex((g) => g.userId === userId);
    return start === -1 ? [] : others.slice(start);
  });
  const groups = isMine ? (mine ? [mine] : []) : othersAtOpen;

  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(() => (groups[0] && !isMine ? firstUnseen(groups[0]) : 0));
  const [held, setHeld] = useState(false);
  // Set when the last story has played: the viewer stays open on a "Watch
  // again" card instead of closing. `playKey` bumps on a replay so the same
  // story restarts from zero even when its id has not changed.
  const [finished, setFinished] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[] | null>(null);
  // Seen-by counts read fresh from the list itself, which beat the count the
  // strip loaded with: someone may have watched since.
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});
  // Likes made while the viewer is open. Other people's groups are a snapshot
  // taken at open (othersAtOpen), so the heart reads from here first.
  const [likedNow, setLikedNow] = useState<Record<string, boolean>>({});
  // The ⋯ menu on someone else's story (Report / Block), and the report form.
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const heartScale = useSharedValue(1);

  // The counts on the member's own stories date from when the strip loaded.
  // Re-read them on open so the "seen by" pill is current.
  useEffect(() => {
    if (isMine) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const group = groups[groupIndex];
  const story = group?.stories[Math.min(storyIndex, group.stories.length - 1)];
  const paused = held || viewersOpen || finished || menuOpen || reportVisible;

  const progress = useSharedValue(0);
  const elapsed = useRef(0);
  const dragY = useSharedValue(0);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }, [router]);

  // Nothing (left) to show: the last story was deleted, or the person's
  // stories expired between the strip loading and the tap.
  useEffect(() => {
    if (!story) close();
  }, [story, close]);

  const next = useCallback(() => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(firstUnseen(groups[groupIndex + 1]));
    } else {
      setFinished(true);
    }
  }, [group, groups, groupIndex, storyIndex]);

  // Back to the first story of the first person this viewer opened on.
  const watchAgain = useCallback(() => {
    setFinished(false);
    setGroupIndex(0);
    setStoryIndex(0);
    setPlayKey((k) => k + 1);
  }, []);

  const previous = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
    } else {
      // Already on the very first story: start it over. Bumping the key
      // remounts it, which restarts a video as well as a photo's clock.
      setPlayKey((k) => k + 1);
    }
  }, [groups, groupIndex, storyIndex]);

  // A new story starts from zero and counts as seen.
  useEffect(() => {
    if (!story) return;
    elapsed.current = 0;
    progress.value = 0;
    setImageLoaded(false);
    markSeen(story);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, playKey]);

  // A photo's clock. Video drives its own bar from the player (StoryVideo).
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!story || story.mediaType !== 'image' || paused || !imageLoaded) return;
    const timer = setInterval(() => {
      elapsed.current += TICK_MS;
      progress.value = Math.min(1, elapsed.current / IMAGE_MS);
      if (elapsed.current >= IMAGE_MS) {
        // Stop before moving on, so a tick that lands before the next render
        // cannot skip a second story.
        clearInterval(timer);
        nextRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [story, paused, imageLoaded, progress]);

  const onTap = useCallback(
    (x: number, width: number) => {
      if (x < width / 3) previous();
      else next();
    },
    [next, previous]
  );

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(250)
      .runOnJS(true)
      .onEnd((e, success) => {
        if (success) onTap(e.x, width);
      });
    const hold = Gesture.LongPress()
      .minDuration(200)
      .runOnJS(true)
      .onStart(() => setHeld(true))
      .onFinalize(() => setHeld(false));
    const swipeDown = Gesture.Pan()
      .activeOffsetY(15)
      .failOffsetX([-30, 30])
      .onUpdate((e) => {
        dragY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
          dragY.value = withTiming(height, { duration: 180 });
          runOnJS(close)();
        } else {
          dragY.value = withTiming(0, { duration: 180 });
        }
      });
    return Gesture.Race(swipeDown, hold, tap);
  }, [onTap, width, height, close, dragY]);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }, { scale: 1 - Math.min(dragY.value / height, 1) * 0.15 }],
    borderRadius: dragY.value > 0 ? 16 : 0,
  }));

  const liked = story ? likedNow[story.id] ?? story.liked : false;

  const onLike = () => {
    if (!story || isMine) return;
    toggleLike({ ...story, liked });
    setLikedNow((prev) => ({ ...prev, [story.id]: !liked }));
    if (!liked) heartScale.value = withSequence(withTiming(1.35, { duration: 120 }), withSpring(1));
  };

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const openViewers = async () => {
    if (!story) return;
    setViewersOpen(true);
    setViewers(null);
    try {
      const list = await storiesService.fetchViewers(story.id);
      setViewers(list);
      setSeenCounts((prev) => ({ ...prev, [story.id]: list.length }));
    } catch {
      setViewers([]);
    }
  };

  // Report and Block sit behind the ⋯ on someone else's story, as on Instagram
  // and WhatsApp: Play asks for a way to report user content where it is shown.
  const onReport = () => {
    setMenuOpen(false);
    setReportVisible(true);
  };

  const onSubmitReport = async (submission: ReportSubmission) => {
    setReportVisible(false);
    if (!user || !group) return;
    try {
      await reportsService.submitReport(user.id, {
        targetId: group.userId,
        reason: submission.reason,
        details: submission.details,
        context: 'story',
      });
    } catch {
      await notify({ title: t('report.failedTitle'), message: t('report.failedBody') });
      return;
    }
    await notify({ title: t('chat.reportSentTitle'), message: t('chat.reportSentBody') });
  };

  const onBlock = async () => {
    setMenuOpen(false);
    if (!group) return;
    const confirmed = await confirm({
      title: t('chat.blockConfirmTitle', { name: group.name }),
      message: t('chat.blockConfirmBody'),
      confirmLabel: t('chat.block'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    // With a thread between them this is the chat's own block, which keeps the
    // thread (hidden) so unblocking brings it back; without one, a plain block.
    const match = matches.find((m) => m.sourceProfileId === group.userId);
    if (match) blockMatch(match.id);
    else blockProfile({ id: group.userId, name: group.name, photo: group.photo, mode: 'dating' });
    // Their stories stop being served once the block lands; the strip reloads
    // without them and the viewer closes rather than play on.
    refresh();
    close();
  };

  const onDelete = async () => {
    if (!story) return;
    setHeld(true);
    const confirmed = await confirm({
      title: t('stories.deleteTitle'),
      message: t('stories.deleteBody'),
      confirmLabel: t('stories.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) {
      setHeld(false);
      return;
    }
    try {
      await remove(story);
      // The live group shrinks under us; stay at the same slot, or step back
      // when the last one went.
      setStoryIndex((i) => Math.max(0, Math.min(i, (group?.stories.length ?? 1) - 2)));
    } catch {
      await notify({ title: t('stories.deleteFailedTitle'), message: t('stories.deleteFailedBody') });
    } finally {
      setHeld(false);
    }
  };

  if (!group || !story) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.stage, dragStyle]}>
        {/* Only the media takes the tap / hold / swipe gestures. The header and
            "seen by" buttons sit above it, outside the detector, so pressing
            one does not also count as a tap to the next story. */}
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false}>
            {story.mediaType === 'image' ? (
              <Image
                key={`${story.id}-${playKey}`}
                source={{ uri: story.mediaUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            ) : (
              <StoryVideo key={`${story.id}-${playKey}`} uri={story.mediaUrl} durationSec={story.durationSec} paused={paused} progress={progress} onEnd={next} />
            )}

            {story.mediaType === 'image' && !imageLoaded && (
              <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" />
            )}
          </View>
        </GestureDetector>

        {/* Darkens the top so the bars and name read on a white photo. */}
        <View style={[styles.topShade, { height: insets.top + 90 }]} pointerEvents="none" />

        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <View style={styles.bars} pointerEvents="none">
            {group.stories.map((s, i) => (
              <ProgressBar key={s.id} state={i < storyIndex ? 'done' : i === storyIndex ? 'active' : 'todo'} progress={progress} />
            ))}
          </View>

          <View style={styles.header} pointerEvents="box-none">
            {group.photo ? (
              <Image source={{ uri: group.photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {isMine ? t('discover.myStory') : group.name}
            </Text>
            <Text style={styles.time} numberOfLines={1}>
                {timeAgo(story.createdAt, t)}
              </Text>
            <View style={styles.spacer} />
            {isMine && (
              <Pressable onPress={onDelete} hitSlop={10} style={styles.headerButton}>
                <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
              </Pressable>
            )}
            {!isMine && (
              <Pressable
                onPress={() => setMenuOpen(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('stories.moreOptions')}
                style={styles.headerButton}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
              </Pressable>
            )}
            <Pressable onPress={close} hitSlop={10} style={styles.headerButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {isMine && (
          <Pressable
            onPress={openViewers}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('stories.seenBy', { count: seenCounts[story.id] ?? story.viewCount })}
            style={[styles.seenBy, { bottom: insets.bottom + spacing.md }]}
          >
            <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
            <Text style={styles.seenByText}>{seenCounts[story.id] ?? story.viewCount}</Text>
          </Pressable>
        )}

        {!isMine && (
          <Pressable
            onPress={onLike}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t(liked ? 'stories.unlike' : 'stories.like')}
            accessibilityState={{ selected: liked }}
            style={[styles.likeButton, { bottom: insets.bottom + spacing.md }]}
          >
            <Animated.View style={heartStyle}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#FF3B5C' : '#FFFFFF'} />
            </Animated.View>
          </Pressable>
        )}
      </Animated.View>

      {/* Outside the gesture area, so its buttons get their taps rather than
          the story's tap-to-advance. */}
      {finished && (
        <View style={styles.endCard}>
          <Pressable onPress={watchAgain} accessibilityRole="button" style={styles.replay}>
            <View style={styles.replayCircle}>
              <Ionicons name="refresh" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.replayLabel}>{t('stories.watchAgain')}</Text>
          </Pressable>
          <Pressable onPress={close} hitSlop={10} style={[styles.endClose, { top: insets.top + spacing.md }]}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      <BottomSheet visible={viewersOpen} onClose={() => setViewersOpen(false)} maxHeight="60%">
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>{t('stories.viewersTitle')}</Text>
        {viewers === null ? (
          <ActivityIndicator color={colors.teal} style={styles.sheetLoading} />
        ) : viewers.length === 0 ? (
          <Text style={[styles.sheetEmpty, { color: colors.textSecondary }]}>{t('stories.noViewers')}</Text>
        ) : (
          <FlatList
            data={viewers}
            keyExtractor={(v) => v.id}
            renderItem={({ item }) => (
              <View style={styles.viewerRow}>
                <Image source={{ uri: item.photo }} style={[styles.viewerAvatar, { backgroundColor: colors.skeleton }]} />
                <Text style={[styles.viewerName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.liked && <Ionicons name="heart" size={16} color="#FF3B5C" />}
                <Text style={[styles.viewerTime, { color: colors.textTertiary }]} numberOfLines={1}>
                  {timeAgo(item.viewedAt, t)}
                </Text>
              </View>
            )}
          />
        )}
      </BottomSheet>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} maxHeight="40%">
        <Pressable onPress={onReport} accessibilityRole="button" style={styles.menuRow}>
          <Ionicons name="flag-outline" size={22} color={colors.textPrimary} />
          <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('chat.report')}</Text>
        </Pressable>
        <Pressable onPress={onBlock} accessibilityRole="button" style={styles.menuRow}>
          <Ionicons name="ban-outline" size={22} color={colors.danger} />
          <Text style={[styles.menuLabel, { color: colors.danger }]}>{t('chat.block')}</Text>
        </Pressable>
      </BottomSheet>

      {group && (
        <ReportDialog
          visible={reportVisible}
          name={group.name}
          onCancel={() => setReportVisible(false)}
          onSubmit={onSubmitReport}
        />
      )}
    </View>
  );
}

function ProgressBar({ state, progress }: { state: 'done' | 'active' | 'todo'; progress: SharedValue<number> }) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${(state === 'done' ? 1 : state === 'active' ? progress.value : 0) * 100}%`,
  }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, fillStyle]} />
    </View>
  );
}

// One video story. Mounted per story (keyed by id), so each gets a fresh player.
function StoryVideo({
  uri,
  durationSec,
  paused,
  progress,
  onEnd,
}: {
  uri: string;
  durationSec?: number;
  paused: boolean;
  progress: SharedValue<number>;
  onEnd: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = TICK_MS / 1000;
  });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      onEndRef.current();
    };
    const subs = [
      player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') setReady(true);
        // A file that will not play should not trap the viewer on it.
        if (status === 'error') finish();
      }),
      player.addListener('timeUpdate', ({ currentTime }) => {
        const length = Math.min(durationSec || player.duration || MAX_STORY_VIDEO_SEC, MAX_STORY_VIDEO_SEC);
        if (length > 0) progress.value = Math.min(1, currentTime / length);
        if (currentTime >= MAX_STORY_VIDEO_SEC) finish();
      }),
      player.addListener('playToEnd', finish),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player, durationSec, progress]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      {!ready && <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" />}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  stage: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.sm },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  name: { ...typography.label, color: '#FFFFFF', fontFamily: fonts.bodyBold, flexShrink: 1 },
  // Never shrinks or wraps: on a narrow phone "just now" used to break onto a
  // second line that the header cut off. The name gives way instead.
  time: { ...typography.caption, color: 'rgba(255,255,255,0.75)', flexShrink: 0 },
  spacer: { flex: 1 },
  headerButton: { padding: 4 },
  // Small "eye + count" pill in the bottom-right corner of the member's own
  // story; tapping it opens the list of who has seen it.
  seenBy: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  seenByText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: scaleFont(12) },
  // The heart on someone else's story, bottom-right like Instagram.
  likeButton: { position: 'absolute', right: spacing.md, padding: 6 },
  endCard: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replay: { alignItems: 'center', gap: spacing.sm },
  replayCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayLabel: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: scaleFont(15) },
  endClose: { position: 'absolute', right: spacing.md, padding: 4 },
  sheetTitle: { ...typography.h3, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sheetLoading: { marginVertical: spacing.xl },
  sheetEmpty: { ...typography.body, textAlign: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20 },
  viewerName: { ...typography.bodyBold, flex: 1 },
  viewerTime: { ...typography.caption, flexShrink: 0 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  menuLabel: { ...typography.bodyBold },
});
