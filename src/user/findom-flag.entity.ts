import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('findom_flags')
export class FindomFlag {
  @PrimaryColumn()
  userId?: string;

  @Column('text', { array: true, default: () => "'{}'" })
  previousRoleIds?: string[];

  @Column({ default: false })
  whitelisted?: boolean;
}
