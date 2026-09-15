import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1777583884993 implements MigrationInterface {
  name = 'Migration1777583884993';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "gag"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "blindfold"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "blindfold" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "gag" boolean NOT NULL DEFAULT false`,
    );
  }
}
