import { MigrationInterface, QueryRunner } from 'typeorm';

export class TargetProfileCohorts1784073600000 implements MigrationInterface {
  name = 'TargetProfileCohorts1784073600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN CREATE TYPE "analysis_classification_enum" AS ENUM ('TARGET', 'STRETCH', 'RESEARCH', 'IRRELEVANT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      ALTER TABLE "jobs"
        ADD COLUMN IF NOT EXISTS "suggested_classification" "analysis_classification_enum",
        ADD COLUMN IF NOT EXISTS "classification_override" "analysis_classification_enum";
      UPDATE "jobs" SET "suggested_classification" = CASE "recommendation"::text
        WHEN 'APPLY' THEN 'TARGET'::"analysis_classification_enum"
        WHEN 'STRETCH' THEN 'STRETCH'::"analysis_classification_enum"
        WHEN 'RESEARCH' THEN 'RESEARCH'::"analysis_classification_enum"
        WHEN 'SKIP' THEN 'IRRELEVANT'::"analysis_classification_enum"
      END WHERE "suggested_classification" IS NULL;
      ALTER TABLE "gap_summaries"
        ADD COLUMN IF NOT EXISTS "job_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "profile_revision" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cohort_options" jsonb NOT NULL DEFAULT '{}'::jsonb;
      INSERT INTO "settings" ("key", "value") VALUES (
        'target_profile_state',
        '{"revision":0,"profile":{"target_domains":[],"target_roles":[],"must_have_skills":[]}}'::jsonb
      ) ON CONFLICT ("key") DO NOTHING;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "settings" WHERE "key" = 'target_profile_state';
      ALTER TABLE "gap_summaries"
        DROP COLUMN IF EXISTS "cohort_options",
        DROP COLUMN IF EXISTS "profile_revision",
        DROP COLUMN IF EXISTS "job_ids";
      ALTER TABLE "jobs"
        DROP COLUMN IF EXISTS "classification_override",
        DROP COLUMN IF EXISTS "suggested_classification";
      DROP TYPE IF EXISTS "analysis_classification_enum";
    `);
  }
}
