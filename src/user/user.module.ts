import { TypeOrmModule } from 'node_modules/@nestjs/typeorm';
import { UserSettings } from './user-settings.entity';
import { ActiveSession } from '../bondage/active-session.entity';
import { Module } from 'node_modules/@nestjs/common';
import { UserService } from './user.service';
import { UserSettingsCommand } from './user.command';
import { ReflectMetadataProvider } from 'node_modules/@discord-nestjs/core/dist';
import { UserProfileCommand } from './profile.command';
import { CleanupService } from './cleanup.service';
import { RoleSeparatorService } from './role_separator.service';
import { SharedDiscordModule } from 'src/helper/shared-discord.module';
import { BondageModule } from 'src/bondage/bondage.module';
import { FriendsCommand } from './friends.command';
import { FindomFlag } from './findom-flag.entity';
import { WhitelistCommand } from './whitelist.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSettings, ActiveSession, FindomFlag]),
    SharedDiscordModule,
    BondageModule,
  ],
  providers: [
    UserService,
    UserSettingsCommand,
    UserProfileCommand,
    FriendsCommand,
    WhitelistCommand,
    CleanupService,
    RoleSeparatorService,
    ReflectMetadataProvider,
  ],
})
export class UsersModule {}
