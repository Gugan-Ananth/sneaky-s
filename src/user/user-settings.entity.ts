import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn()
  userId?: string;

  @Column({ nullable: true })
  safeword?: string;

  @Column('text', { array: true, default: () => "'{}'" })
  friendIds?: string[];
}
