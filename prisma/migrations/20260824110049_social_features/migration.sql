-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "photo" TEXT NOT NULL,
    "last_message" TEXT NOT NULL DEFAULT '',
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL,
    "moved_to_rishta" BOOLEAN NOT NULL DEFAULT false,
    "rishta_request_pending" BOOLEAN NOT NULL DEFAULT false,
    "source_profile_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "from_me" BOOLEAN NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'text',
    "audio_path" TEXT,
    "duration_sec" INTEGER,
    "image_path" TEXT,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "profile_id" UUID NOT NULL,
    "target_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "photo" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("profile_id","target_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "profile_id" UUID NOT NULL,
    "new_matches" BOOLEAN NOT NULL DEFAULT true,
    "messages" BOOLEAN NOT NULL DEFAULT true,
    "likes" BOOLEAN NOT NULL DEFAULT true,
    "rishta_requests" BOOLEAN NOT NULL DEFAULT true,
    "product_updates" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "blocked_users" (
    "profile_id" UUID NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "source_profile_id" TEXT,
    "name" TEXT NOT NULL,
    "photo" TEXT NOT NULL,
    "blocked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("profile_id","blocked_id")
);

-- CreateTable
CREATE TABLE "view_history" (
    "profile_id" UUID NOT NULL,
    "viewed_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "photo" TEXT NOT NULL,
    "viewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "view_history_pkey" PRIMARY KEY ("profile_id","viewed_id")
);

-- CreateTable
CREATE TABLE "daily_likes" (
    "profile_id" UUID NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_likes_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "privacy_prefs" (
    "profile_id" UUID NOT NULL,
    "profile_visible" BOOLEAN NOT NULL DEFAULT true,
    "online_status_visible" BOOLEAN NOT NULL DEFAULT true,
    "blur_photos" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "privacy_prefs_pkey" PRIMARY KEY ("profile_id")
);

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_history" ADD CONSTRAINT "view_history_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_likes" ADD CONSTRAINT "daily_likes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_prefs" ADD CONSTRAINT "privacy_prefs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
