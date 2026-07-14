import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1752451200000 implements MigrationInterface {
  name = 'InitialSchema1752451200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      DO $$ BEGIN CREATE TYPE "jobs_domain_enum" AS ENUM ('BACKEND', 'FULLSTACK', 'ML', 'DEVOPS', 'OTHER', 'INTERESTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE "jobs_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'APPLIED', 'DELETED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE "job_requirements_met_status_enum" AS ENUM ('MET', 'NOT_MET', 'UNCERTAIN');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE "gap_summaries_domain_filter_enum" AS ENUM ('BACKEND', 'FULLSTACK', 'ML', 'DEVOPS', 'OTHER', 'INTERESTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "jobs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "company_name" varchar(255) NOT NULL,
      "title" varchar(255) NOT NULL, "url" text NOT NULL, "description" text NOT NULL,
      "domain" "jobs_domain_enum" NOT NULL, "status" "jobs_status_enum" NOT NULL DEFAULT 'ACTIVE',
      "llm_score" integer, "score_override" integer, "llm_is_applicable" boolean NOT NULL,
      "is_applicable_override" boolean, "is_interesting" boolean NOT NULL DEFAULT true,
      "is_interesting_override" boolean, "llm_domain" "jobs_domain_enum" NOT NULL,
      "domain_override" "jobs_domain_enum", "llm_summary" text NOT NULL,
      "added_at" timestamptz NOT NULL DEFAULT now(), "posted_at" timestamptz,
      "applied_at" timestamptz, "deleted_at" timestamptz, "notes" text
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "job_requirements" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "job_id" uuid NOT NULL,
      "name" text NOT NULL, "met_status" "job_requirements_met_status_enum" NOT NULL,
      "reasoning" text NOT NULL, "order" integer NOT NULL,
      CONSTRAINT "FK_job_requirements_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "gap_summaries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "generated_at" timestamptz NOT NULL DEFAULT now(),
      "domain_filter" "gap_summaries_domain_filter_enum", "summary" jsonb NOT NULL, "job_count" integer NOT NULL
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "settings" (
      "key" varchar(100) PRIMARY KEY, "value" jsonb NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "job_requirements"');
    await queryRunner.query('DROP TABLE IF EXISTS "gap_summaries"');
    await queryRunner.query('DROP TABLE IF EXISTS "settings"');
    await queryRunner.query('DROP TABLE IF EXISTS "jobs"');
    await queryRunner.query('DROP TYPE IF EXISTS "job_requirements_met_status_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "gap_summaries_domain_filter_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "jobs_status_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "jobs_domain_enum"');
  }
}
