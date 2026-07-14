import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CvAnalysisRevisions1784160000000 implements MigrationInterface {
  name = 'CvAnalysisRevisions1784160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cv_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "revision" integer NOT NULL,
        "content" text NOT NULL,
        "ai_visible_text" text NOT NULL,
        "source" text NOT NULL,
        "filename" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_cv_revisions_revision" UNIQUE ("revision"),
        CONSTRAINT "PK_cv_revisions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "job_analysis_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "cv_revision_id" uuid,
        "cv_revision" integer,
        "status" "analysis_status_enum" NOT NULL,
        "result" jsonb,
        "score" integer,
        "recommendation" text,
        "error" text,
        "model" text,
        "prompt_version" text,
        "analyzed_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_job_analysis_revisions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_job_analysis_revisions_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      INSERT INTO "cv_revisions" ("revision", "content", "ai_visible_text", "source", "filename", "created_at")
      SELECT
        ("value"->>'revision')::integer,
        "value"->'current'->>'content',
        "value"->'current'->>'content',
        COALESCE("value"->'current'->>'source', 'legacy_url'),
        "value"->'current'->>'filename',
        COALESCE(("value"->'current'->>'updated_at')::timestamptz, now())
      FROM "settings"
      WHERE "key" = 'master_cv_state' AND "value"->'current'->>'content' IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "settings" s SET "value" = jsonb_set(
        s."value", '{current,id}', to_jsonb(r."id"::text), true
      )
      FROM "cv_revisions" r
      WHERE s."key" = 'master_cv_state' AND r."revision" = (s."value"->>'revision')::integer
    `);
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD "analysis_revision_id" uuid`,
    );
    await queryRunner.query(`ALTER TABLE "jobs" ADD "cv_revision_id" uuid`);
    await queryRunner.query(`ALTER TABLE "jobs" ADD "cv_revision" integer`);
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD "application_cv_revision_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "gap_summaries" ADD "cv_revision_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "gap_summaries" ADD "cv_revision" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "gap_summaries" ADD "analysis_revision_ids" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );

    // Legacy analyses intentionally remain linked to an unknown CV revision.
    await queryRunner.query(`
      INSERT INTO "job_analysis_revisions" (
        "job_id", "cv_revision_id", "cv_revision", "status", "result", "score",
        "recommendation", "error", "model", "prompt_version", "analyzed_at"
      )
      SELECT "id", NULL, NULL, "analysis_status", NULL, "llm_score",
        "recommendation"::text, "analysis_error", "analysis_model", "prompt_version",
        COALESCE("analyzed_at", "added_at")
      FROM "jobs"
      WHERE "analysis_status" <> 'PENDING'
    `);
    await queryRunner.query(`
      UPDATE "jobs" j SET "analysis_revision_id" = r."id"
      FROM "job_analysis_revisions" r WHERE r."job_id" = j."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gap_summaries" DROP COLUMN "analysis_revision_ids"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gap_summaries" DROP COLUMN "cv_revision"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gap_summaries" DROP COLUMN "cv_revision_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP COLUMN "application_cv_revision_id"`,
    );
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "cv_revision"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "cv_revision_id"`);
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP COLUMN "analysis_revision_id"`,
    );
    await queryRunner.query(`DROP TABLE "job_analysis_revisions"`);
    await queryRunner.query(`DROP TABLE "cv_revisions"`);
  }
}
