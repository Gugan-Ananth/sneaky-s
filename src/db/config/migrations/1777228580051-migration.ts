import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1777228580051 implements MigrationInterface {
  name = 'Migration1777228580051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "active_sessions" DROP COLUMN IF EXISTS "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "bondageDescription" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "gagDescription" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ADD COLUMN IF NOT EXISTS "blindfoldDescription" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "active_sessions" DROP COLUMN "blindfoldDescription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" DROP COLUMN "gagDescription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" DROP COLUMN "bondageDescription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_sessions" ADD "description" text NOT NULL`,
    );
  }
}
