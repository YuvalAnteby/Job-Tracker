import { MigrationInterface, QueryRunner } from 'typeorm';

export class LearningRoadmap1784419200000 implements MigrationInterface {
  name = 'LearningRoadmap1784419200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roadmap_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying(180) NOT NULL,
        "notes" text,
        "skill_id" uuid,
        "status" character varying(20) NOT NULL DEFAULT 'PLANNED',
        "gap_type" character varying(20) NOT NULL DEFAULT 'SKILL',
        "target_date" date,
        "frequency" integer NOT NULL,
        "importance" integer NOT NULL,
        "relevance" integer NOT NULL,
        "evidence_weakness" integer NOT NULL,
        "effort" integer NOT NULL,
        "recommended_priority" double precision NOT NULL,
        "priority_override" double precision,
        "target_profile_revision" integer,
        "cv_evidence" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roadmap_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roadmap_item_skill" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_roadmap_item_status" CHECK ("status" IN ('PLANNED','IN_PROGRESS','BLOCKED','COMPLETED')),
        CONSTRAINT "CHK_roadmap_item_factors" CHECK ("frequency" >= 1 AND "importance" BETWEEN 1 AND 5 AND "relevance" BETWEEN 0 AND 5 AND "evidence_weakness" BETWEEN 1 AND 5 AND "effort" BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "roadmap_proof_artifacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL,
        "title" character varying(180) NOT NULL,
        "url" text,
        "repository_url" text,
        "notes" text,
        "resources" text,
        "promoted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roadmap_proof_artifacts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roadmap_proof_item" FOREIGN KEY ("item_id") REFERENCES "roadmap_items"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "roadmap_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL,
        "event" character varying(40) NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roadmap_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roadmap_history_item" FOREIGN KEY ("item_id") REFERENCES "roadmap_items"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "roadmap_item_jobs" (
        "roadmap_item_id" uuid NOT NULL,
        "job_id" uuid NOT NULL,
        CONSTRAINT "PK_roadmap_item_jobs" PRIMARY KEY ("roadmap_item_id", "job_id"),
        CONSTRAINT "FK_roadmap_job_item" FOREIGN KEY ("roadmap_item_id") REFERENCES "roadmap_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_roadmap_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "roadmap_item_requirements" (
        "roadmap_item_id" uuid NOT NULL,
        "requirement_id" uuid NOT NULL,
        CONSTRAINT "PK_roadmap_item_requirements" PRIMARY KEY ("roadmap_item_id", "requirement_id"),
        CONSTRAINT "FK_roadmap_requirement_item" FOREIGN KEY ("roadmap_item_id") REFERENCES "roadmap_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_roadmap_requirement" FOREIGN KEY ("requirement_id") REFERENCES "job_requirements"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_roadmap_status_date" ON "roadmap_items" ("status", "target_date")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_roadmap_history_item" ON "roadmap_history" ("item_id", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_roadmap_history_item"');
    await queryRunner.query('DROP INDEX "IDX_roadmap_status_date"');
    await queryRunner.query('DROP TABLE "roadmap_item_requirements"');
    await queryRunner.query('DROP TABLE "roadmap_item_jobs"');
    await queryRunner.query('DROP TABLE "roadmap_history"');
    await queryRunner.query('DROP TABLE "roadmap_proof_artifacts"');
    await queryRunner.query('DROP TABLE "roadmap_items"');
  }
}
