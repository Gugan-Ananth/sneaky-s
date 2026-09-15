import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1789420800000 implements MigrationInterface {
  name = 'Migration1789420800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "friendIds" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "friendIds"`,
    );
  }
}
