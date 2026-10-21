-- ============================================================================
-- 51. Storage upload limits.
--
-- 17_storage.sql made both buckets with no size cap and no type filter, so a
-- signed-in member could put any file of any size under their own {uid}/
-- prefix: an HTML page or an SVG with script in it on the public bucket, or a
-- multi-gigabyte file. Storage now rejects anything the app would never send.
--
--   · public-media          photos, story/intro video, voice notes, chat media.
--                           50 MB covers a 30-second story or intro video.
--   · private-verification  CNIC and selfie photos only. 10 MB.
--
-- Images are listed one by one rather than as image/* so image/svg+xml (which
-- can carry script) stays out. Video and audio take the wildcard: pickers and
-- recorders report a spread of container types (mp4, quicktime, 3gpp, webm,
-- m4a, aac …) and none of them can run as code.
--
-- Storage checks the Content-Type the client declares, not the bytes, so this
-- is a filter on what the app's own uploads say they are; the {uid}/ folder
-- policies in 17_storage.sql still decide who may write where.
-- Safe to run more than once.
-- ============================================================================

update storage.buckets
set file_size_limit = 50 * 1024 * 1024,
    allowed_mime_types = array[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif', 'image/gif',
      'video/*',
      'audio/*'
    ]
where id = 'public-media';

update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif'
    ]
where id = 'private-verification';
