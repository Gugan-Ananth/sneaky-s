import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveSession } from './active-session.entity';
import { BondageService } from './bondage.service';

@Injectable()
export class ReleaseCronService {
  private readonly logger = new Logger(ReleaseCronService.name);

  constructor(
    @InjectRepository(ActiveSession)
    private readonly activeSessionRepository: Repository<ActiveSession>,
    private readonly bondageService: BondageService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredSessions() {
    const now = new Date();

    const activeSessions = await this.activeSessionRepository.find({
      where: {
        status: 'active',
      },
    });

    for (const session of activeSessions) {
      if ((session.endTime ?? now) > now) {
        continue;
      }

      try {
        await this.bondageService.endSession(session);
      } catch (err) {
        this.logger.error(
          `Failed to release ${session.userId}`,
          err instanceof Error ? err.stack : String(err),
        );

        if (session.userId) {
          await this.activeSessionRepository
            .delete({ userId: session.userId })
            .catch(() => null);
        }
      }
    }
  }
}
