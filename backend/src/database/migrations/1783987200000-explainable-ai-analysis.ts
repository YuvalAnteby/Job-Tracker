import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExplainableAiAnalysis1783987200000 implements MigrationInterface {
  name = 'ExplainableAiAnalysis1783987200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN CREATE TYPE "analysis_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE "recommendation_enum" AS ENUM ('APPLY', 'STRETCH', 'RESEARCH', 'SKIP');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "jobs" ALTER COLUMN "llm_is_applicable" DROP NOT NULL;
      ALTER TABLE "jobs" ALTER COLUMN "llm_domain" DROP NOT NULL;
      ALTER TABLE "jobs" ALTER COLUMN "llm_summary" DROP NOT NULL;
      ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "score_breakdown" jsonb;
      ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "recommendation" "recommendation_enum";
      ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "analysis_status" "analysis_status_enum" NOT NULL DEFAULT 'COMPLETED';
      ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "analysis_error" text;
      ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "analysis_model" text;
      ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "prompt_version" text;
      ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "analyzed_at" timestamptz;
      ALTER TABLE "jobs" ALTER COLUMN "analysis_status" SET DEFAULT 'PENDING';
      ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "job_description_excerpt" text;
      ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "cv_evidence" text;
      ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "evidence_inferred" boolean NOT NULL DEFAULT false;
      ALTER TABLE "gap_summaries" ALTER COLUMN "summary" DROP NOT NULL;
      ALTER TABLE "gap_summaries" ADD COLUMN IF NOT EXISTS "analysis_status" "analysis_status_enum" NOT NULL DEFAULT 'COMPLETED';
      ALTER TABLE "gap_summaries" ADD COLUMN IF NOT EXISTS "analysis_error" text;
      ALTER TABLE "gap_summaries" ADD COLUMN IF NOT EXISTS "analysis_model" text;
      ALTER TABLE "gap_summaries" ADD COLUMN IF NOT EXISTS "prompt_version" text;
      ALTER TABLE "gap_summaries" ADD COLUMN IF NOT EXISTS "analyzed_at" timestamptz;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gap_summaries" DROP COLUMN IF EXISTS "analyzed_at";
      ALTER TABLE "gap_summaries" DROP COLUMN IF EXISTS "prompt_version";
      ALTER TABLE "gap_summaries" DROP COLUMN IF EXISTS "analysis_model";
      ALTER TABLE "gap_summaries" DROP COLUMN IF EXISTS "analysis_error";
      ALTER TABLE "gap_summaries" DROP COLUMN IF EXISTS "analysis_status";
      DELETE FROM "gap_summaries" WHERE "summary" IS NULL;
      ALTER TABLE "gap_summaries" ALTER COLUMN "summary" SET NOT NULL;
      ALTER TABLE "job_requirements" DROP COLUMN IF EXISTS "evidence_inferred";
      ALTER TABLE "job_requirements" DROP COLUMN IF EXISTS "cv_evidence";
      ALTER TABLE "job_requirements" DROP COLUMN IF EXISTS "job_description_excerpt";
      ALTER TABLE "jobs" DROP COLUMN IF EXISTS "analyzed_at";
      ALTER TABLE "jobs" DROP COLUMN IF EXISTS "prompt_version";
      ALTER TABLE "jobs" DROP COLUMN IF EXISTS "analysis_model";
      ALTER TABLE "jobs" DROP COLUMN IF EXISTS "analysis_error";
      ALTER TABLE "jobs" DROP COLUMN IF EXISTS "analysis_status";
      ALTER TABLE "jobs" DROP COLUMN IF EXISTS "recommendation";
      ALTER TABLE "jobs" DROP COLUMN IF EXISTS "score_breakdown";
      UPDATE "jobs" SET "llm_is_applicable" = false WHERE "llm_is_applicable" IS NULL;
      UPDATE "jobs" SET "llm_domain" = "domain" WHERE "llm_domain" IS NULL;
      UPDATE "jobs" SET "llm_summary" = '' WHERE "llm_summary" IS NULL;
      ALTER TABLE "jobs" ALTER COLUMN "llm_is_applicable" SET NOT NULL;
      ALTER TABLE "jobs" ALTER COLUMN "llm_domain" SET NOT NULL;
      ALTER TABLE "jobs" ALTER COLUMN "llm_summary" SET NOT NULL;
      DROP TYPE IF EXISTS "recommendation_enum";
      DROP TYPE IF EXISTS "analysis_status_enum";
    `);
  }
}
