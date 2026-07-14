import { MigrationInterface, QueryRunner } from 'typeorm';

export class SkillEvidenceMatrix1784246400000 implements MigrationInterface {
  name = 'SkillEvidenceMatrix1784246400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "skills" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        CONSTRAINT "UQ_skills_name" UNIQUE ("name"),
        CONSTRAINT "PK_skills" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "skill_aliases" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "normalized_alias" character varying(160) NOT NULL,
        "skill_id" uuid NOT NULL,
        "is_manual" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_skill_aliases_normalized" UNIQUE ("normalized_alias"),
        CONSTRAINT "PK_skill_aliases" PRIMARY KEY ("id"),
        CONSTRAINT "FK_skill_alias_skill" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "job_requirements"
        ADD "skill_id" uuid,
        ADD "priority" character varying(20) NOT NULL DEFAULT 'REQUIRED',
        ADD "gap_type" character varying(20) NOT NULL DEFAULT 'SKILL',
        ADD "actionability" character varying(20) NOT NULL DEFAULT 'HIGH',
        ADD "effort" character varying(20) NOT NULL DEFAULT 'MEDIUM',
        ADD CONSTRAINT "FK_requirement_skill" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      UPDATE "job_requirements"
      SET
        "priority" = CASE WHEN lower("name") ~ '(preferred|nice to have|bonus|advantage|plus)' THEN 'PREFERRED' ELSE 'REQUIRED' END,
        "gap_type" = CASE
          WHEN lower("name") ~ '(\\m[0-9]+\\+?[[:space:]]*(years?|yrs?)\\M|graduat(e|ed|ing|ion)|degree by|class of)' THEN 'TIME_BOUND'
          WHEN lower("name") ~ '\\m(senior|staff|principal|lead|manager|director)\\M' THEN 'ROLE_MISMATCH'
          WHEN "cv_evidence" IS NOT NULL THEN 'EVIDENCE'
          ELSE 'SKILL'
        END,
        "actionability" = CASE WHEN "cv_evidence" IS NOT NULL THEN 'MEDIUM' ELSE 'HIGH' END,
        "effort" = CASE WHEN "cv_evidence" IS NOT NULL THEN 'SMALL' ELSE 'MEDIUM' END
    `);
    await queryRunner.query(`
      UPDATE "job_requirements"
      SET "actionability" = 'LOW', "effort" = 'LARGE'
      WHERE "gap_type" IN ('TIME_BOUND', 'ROLE_MISMATCH')
    `);
    await queryRunner.query(`
      WITH canonical AS (
        SELECT lower(trim(regexp_replace("name", '[^a-zA-Z0-9+#.]', ' ', 'g'))) AS alias, min(left(trim("name"), 120)) AS name
        FROM "job_requirements"
        WHERE "gap_type" NOT IN ('TIME_BOUND', 'ROLE_MISMATCH')
        GROUP BY lower(trim(regexp_replace("name", '[^a-zA-Z0-9+#.]', ' ', 'g')))
      )
      INSERT INTO "skills" ("name") SELECT "name" FROM canonical ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      WITH canonical AS (
        SELECT lower(trim(regexp_replace("name", '[^a-zA-Z0-9+#.]', ' ', 'g'))) AS alias, min(left(trim("name"), 120)) AS name
        FROM "job_requirements"
        WHERE "gap_type" NOT IN ('TIME_BOUND', 'ROLE_MISMATCH')
        GROUP BY lower(trim(regexp_replace("name", '[^a-zA-Z0-9+#.]', ' ', 'g')))
      )
      INSERT INTO "skill_aliases" ("normalized_alias", "skill_id")
      SELECT canonical.alias, skills.id FROM canonical JOIN skills ON skills.name = canonical.name
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "job_requirements" requirement
      SET "skill_id" = alias."skill_id"
      FROM "skill_aliases" alias
      WHERE alias."normalized_alias" = lower(trim(regexp_replace(requirement."name", '[^a-zA-Z0-9+#.]', ' ', 'g')))
        AND requirement."gap_type" NOT IN ('TIME_BOUND', 'ROLE_MISMATCH')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "job_requirements" DROP CONSTRAINT "FK_requirement_skill"',
    );
    await queryRunner.query(`
      ALTER TABLE "job_requirements"
        DROP COLUMN "effort",
        DROP COLUMN "actionability",
        DROP COLUMN "gap_type",
        DROP COLUMN "priority",
        DROP COLUMN "skill_id"
    `);
    await queryRunner.query('DROP TABLE "skill_aliases"');
    await queryRunner.query('DROP TABLE "skills"');
  }
}
