import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn()
  userId?: string;

  @Column({ type: 'int', default: 30 })
  defaultDuration?: number;

  @Column({ nullable: true })
  safeword?: string;

  @Column('text', { array: true, default: () => "'{}'" })
  friendIds?: string[];
}
