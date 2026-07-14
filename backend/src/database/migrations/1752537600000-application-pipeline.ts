import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApplicationPipeline1752537600000 implements MigrationInterface {
  name = 'ApplicationPipeline1752537600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN CREATE TYPE "jobs_listing_state_enum" AS ENUM ('OPEN', 'CLOSED', 'UNKNOWN');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE "jobs_user_decision_enum" AS ENUM ('UNDECIDED', 'INTERESTED', 'APPLY', 'SKIP');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE "jobs_application_stage_enum" AS ENUM ('NOT_APPLIED', 'APPLIED', 'RECRUITER_SCREEN', 'TECHNICAL_INTERVIEW', 'ASSIGNMENT', 'ONSITE', 'OFFER', 'REJECTED', 'WITHDRAWN');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "jobs"
      ADD COLUMN IF NOT EXISTS "listing_state" "jobs_listing_state_enum" NOT NULL DEFAULT 'OPEN',
      ADD COLUMN IF NOT EXISTS "user_decision" "jobs_user_decision_enum" NOT NULL DEFAULT 'UNDECIDED',
      ADD COLUMN IF NOT EXISTS "application_stage" "jobs_application_stage_enum" NOT NULL DEFAULT 'NOT_APPLIED',
      ADD COLUMN IF NOT EXISTS "include_in_gap" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "posting_snapshot" jsonb
    `);
    await queryRunner.query(`
      UPDATE "jobs" SET
        "listing_state" = CASE WHEN "status" IN ('INACTIVE', 'DELETED') THEN 'CLOSED'::"jobs_listing_state_enum" ELSE 'OPEN'::"jobs_listing_state_enum" END,
        "user_decision" = CASE
          WHEN "status" = 'APPLIED' THEN 'APPLY'::"jobs_user_decision_enum"
          WHEN "status" IN ('INACTIVE', 'DELETED') THEN 'SKIP'::"jobs_user_decision_enum"
          WHEN "is_interesting" THEN 'INTERESTED'::"jobs_user_decision_enum"
          ELSE 'UNDECIDED'::"jobs_user_decision_enum" END,
        "application_stage" = CASE WHEN "status" = 'APPLIED' THEN 'APPLIED'::"jobs_application_stage_enum" ELSE 'NOT_APPLIED'::"jobs_application_stage_enum" END,
        "include_in_gap" = "status" IN ('ACTIVE', 'APPLIED'),
        "posting_snapshot" = jsonb_build_object(
          'company_name', "company_name", 'title', "title", 'url', "url",
          'description', "description", 'posted_at', "posted_at"
        )
    `);
    await queryRunner.query(
      'ALTER TABLE "jobs" ALTER COLUMN "posting_snapshot" SET NOT NULL',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "application_stage_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "job_id" uuid NOT NULL,
        "previous_stage" "jobs_application_stage_enum" NOT NULL,
        "new_stage" "jobs_application_stage_enum" NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        "source" text NOT NULL DEFAULT 'WEB',
        "notes" text,
        "rejection_reason" text,
        CONSTRAINT "FK_application_stage_events_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      INSERT INTO "application_stage_events" ("job_id", "previous_stage", "new_stage", "occurred_at", "source", "notes")
      SELECT "id", 'NOT_APPLIED', 'APPLIED', COALESCE("applied_at", "added_at"), 'MIGRATION', 'Backfilled from legacy status'
      FROM "jobs" WHERE "status" = 'APPLIED'
      AND NOT EXISTS (SELECT 1 FROM "application_stage_events" event WHERE event."job_id" = "jobs"."id")
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_application_stage_events_job_time" ON "application_stage_events" ("job_id", "occurred_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "application_stage_events"');
    await queryRunner.query(`
      ALTER TABLE "jobs"
      DROP COLUMN IF EXISTS "posting_snapshot",
      DROP COLUMN IF EXISTS "include_in_gap",
      DROP COLUMN IF EXISTS "application_stage",
      DROP COLUMN IF EXISTS "user_decision",
      DROP COLUMN IF EXISTS "listing_state"
    `);
    await queryRunner.query(
      'DROP TYPE IF EXISTS "jobs_application_stage_enum"',
    );
    await queryRunner.query('DROP TYPE IF EXISTS "jobs_user_decision_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "jobs_listing_state_enum"');
  }
}
