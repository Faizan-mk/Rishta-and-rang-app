-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "gender" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "intent" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "active_mode" TEXT NOT NULL DEFAULT 'dating',
    "dating_vibe_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dating_intention_label" TEXT,
    "rishta_religion" TEXT NOT NULL DEFAULT '',
    "rishta_sect" TEXT NOT NULL DEFAULT '',
    "rishta_family_background" TEXT NOT NULL DEFAULT '',
    "rishta_education" TEXT NOT NULL DEFAULT '',
    "rishta_readiness" TEXT NOT NULL DEFAULT 'browsing',
    "rishta_prayer_habits" TEXT,
    "rishta_income_range" TEXT,
    "rishta_living_abroad" BOOLEAN,
    "heightCm" INTEGER,
    "marital_status" TEXT,
    "has_children" BOOLEAN,
    "occupation" TEXT,
    "practising" BOOLEAN,
    "prayer_habits" TEXT,
    "halal_only" BOOLEAN,
    "smoking" BOOLEAN,
    "drinking" BOOLEAN,
    "religious_dress" TEXT,
    "open_to_relocate" BOOLEAN,
    "preferred_country" TEXT,
    "career_plans" TEXT,
    "education_level" TEXT,
    "degree" TEXT,
    "job_title" TEXT,
    "industry" TEXT,
    "languages" TEXT[],
    "nationality" TEXT,
    "grew_up_in" TEXT,
    "country" TEXT,
    "selfie_verified" BOOLEAN NOT NULL DEFAULT false,
    "voice_intro_path" TEXT,
    "voice_intro_duration_sec" INTEGER,
    "video_intro_path" TEXT,
    "wali_name" TEXT,
    "wali_contact" TEXT,
    "wali_invited_at" TIMESTAMPTZ,
    "is_explore_plus" BOOLEAN NOT NULL DEFAULT false,
    "subscription_plan" TEXT,
    "has_used_trial" BOOLEAN NOT NULL DEFAULT false,
    "subscription_renews_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_verification" (
    "profile_id" UUID NOT NULL,
    "cnic_number" TEXT,
    "cnic_photo_path" TEXT,
    "cnic_verified" BOOLEAN NOT NULL DEFAULT false,
    "bureau_verified" BOOLEAN NOT NULL DEFAULT false,
    "selfie_photo_path" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profile_verification_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "profile_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_photos_profile_id_position_key" ON "profile_photos"("profile_id", "position");

-- AddForeignKey
ALTER TABLE "profile_verification" ADD CONSTRAINT "profile_verification_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
