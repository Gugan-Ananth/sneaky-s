import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1789600000000 implements MigrationInterface {
  name = 'Migration1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "findom_flags" ("userId" character varying NOT NULL, "previousRoleIds" text array NOT NULL DEFAULT '{}', "whitelisted" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_findom_flags" PRIMARY KEY ("userId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "findom_flags"`);
  }
}
