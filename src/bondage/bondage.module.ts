import { TypeOrmModule } from 'node_modules/@nestjs/typeorm';
import { ActiveSession } from '../bondage/active-session.entity';
import { Module } from 'node_modules/@nestjs/common';
import { UserSettings } from 'src/user/user-settings.entity';
import { BondageService } from './bondage.service';
import { BondageCommand } from './bondage.command';
import { SafewordCommand } from './safeword.command';
import { SharedDiscordModule } from 'src/helper/shared-discord.module';
import { BindCommand } from './bind.command';
import { EscapeCommand } from './escape.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSettings, ActiveSession]),
    SharedDiscordModule,
  ],
  providers: [
    BondageService,
    BondageCommand,
    BindCommand,
    SafewordCommand,
    EscapeCommand,
  ],
  exports: [BondageService],
})
export class BondageModule {}
