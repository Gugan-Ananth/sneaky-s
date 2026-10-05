import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { EscapeState } from './escape-rules';

@Entity('active_sessions')
export class ActiveSession {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ unique: true })
  userId?: string;

  @Column()
  guildId?: string;

  @Column({ type: 'text', nullable: true, default: null })
  bondageDescription?: string;

  @Column({ type: 'text', nullable: true, default: null })
  gagDescription?: string;

  @Column({ type: 'text', nullable: true, default: null })
  blindfoldDescription?: string;

  @Column()
  channelId?: string;

  @Column('text', { array: true })
  originalRoles?: string[];

  @Column()
  startTime?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime?: Date | null;

  @Column({ default: false })
  gag?: boolean;

  @Column({ default: false })
  blindfold?: boolean;

  @Column({ nullable: true })
  safeword?: string;

  @Column({ type: 'int', nullable: true })
  duration?: number | null;

  @Column({ default: 'active' })
  status?: string;

  @Column({ type: 'jsonb', nullable: true })
  escapeState?: EscapeState | null;
}
