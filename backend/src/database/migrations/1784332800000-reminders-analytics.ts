import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemindersAnalytics1784332800000 implements MigrationInterface {
  name = 'RemindersAnalytics1784332800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "application_actions_state_enum" AS ENUM ('ACTIVE', 'COMPLETED', 'DISMISSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "application_action_events_event_type_enum" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'DISMISSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "reminder_deliveries_status_enum" AS ENUM ('SENT', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "application_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "label" text NOT NULL,
        "due_at" TIMESTAMPTZ NOT NULL,
        "state" "application_actions_state_enum" NOT NULL,
        "revision" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_application_actions_job" UNIQUE ("job_id"),
        CONSTRAINT "PK_application_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_application_actions_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "application_action_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action_id" uuid NOT NULL,
        "event_type" "application_action_events_event_type_enum" NOT NULL,
        "label" text NOT NULL,
        "due_at" TIMESTAMPTZ NOT NULL,
        "revision" integer NOT NULL,
        "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_action_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_application_action_events_action" FOREIGN KEY ("action_id") REFERENCES "application_actions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "reminder_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action_id" uuid NOT NULL,
        "action_revision" integer NOT NULL,
        "chat_id" text NOT NULL,
        "status" "reminder_deliveries_status_enum" NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_reminder_delivery_due_state" UNIQUE ("action_id", "action_revision", "chat_id"),
        CONSTRAINT "PK_reminder_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reminder_deliveries_action" FOREIGN KEY ("action_id") REFERENCES "application_actions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_application_actions_due" ON "application_actions" ("state", "due_at")`,
    );
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value") VALUES
        ('reminders_enabled', 'true'::jsonb),
        ('reminder_default_days', '3'::jsonb),
        ('reminder_timezone', '"Asia/Jerusalem"'::jsonb)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "settings" WHERE "key" IN ('reminders_enabled', 'reminder_default_days', 'reminder_timezone')`,
    );
    await queryRunner.query(`DROP INDEX "IDX_application_actions_due"`);
    await queryRunner.query(`DROP TABLE "reminder_deliveries"`);
    await queryRunner.query(`DROP TABLE "application_action_events"`);
    await queryRunner.query(`DROP TABLE "application_actions"`);
    await queryRunner.query(`DROP TYPE "reminder_deliveries_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "application_action_events_event_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "application_actions_state_enum"`);
  }
}
