import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1789800000000 implements MigrationInterface {
  name = 'Migration1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "escapeState" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ALTER COLUMN "endTime" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ALTER COLUMN "duration" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "active_sessions" SET "endTime" = NOW() WHERE "endTime" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ALTER COLUMN "endTime" SET NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "active_sessions" SET "duration" = 30 WHERE "duration" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ALTER COLUMN "duration" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" DROP COLUMN "escapeState"`,
    );
  }
}
