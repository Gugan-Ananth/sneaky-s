import { Injectable } from 'node_modules/@nestjs/common';
import { InjectRepository } from 'node_modules/@nestjs/typeorm';
import { UserSettings } from './user-settings.entity';
import { Repository } from 'node_modules/typeorm';

export const MAX_FRIENDS = 10;

export type AddFriendsResult = {
  friendIds: string[];
  added: string[];
  alreadyFriends: string[];
  skippedLimit: string[];
};

export type RemoveFriendsResult = {
  friendIds: string[];
  removed: string[];
  notFriends: string[];
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly userSettingsRepository: Repository<UserSettings>,
  ) {}

  async updateUserSettings(
    userId: string,
    settingsData: Partial<UserSettings>,
  ) {
    const settings = await this.getOrCreateSettings(userId);

    const cleanData = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(settingsData).filter(([_, v]) => v !== undefined),
    );

    Object.assign(settings, cleanData);
    return this.userSettingsRepository.save(settings);
  }

  async getUserSettings(userId: string): Promise<UserSettings | null> {
    return this.userSettingsRepository.findOne({
      where: { userId },
    });
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const settings = await this.getUserSettings(userId);
    return settings?.friendIds ?? [];
  }

  async addFriends(
    userId: string,
    friendIdsToAdd: string[],
  ): Promise<AddFriendsResult> {
    const settings = await this.getOrCreateSettings(userId);
    const friendIds = new Set(settings.friendIds ?? []);
    const added: string[] = [];
    const alreadyFriends: string[] = [];
    const skippedLimit: string[] = [];

    for (const friendId of friendIdsToAdd) {
      if (friendIds.has(friendId)) {
        alreadyFriends.push(friendId);
        continue;
      }

      if (friendIds.size >= MAX_FRIENDS) {
        skippedLimit.push(friendId);
        continue;
      }

      friendIds.add(friendId);
      added.push(friendId);
    }

    settings.friendIds = [...friendIds];
    await this.userSettingsRepository.save(settings);

    return {
      friendIds: settings.friendIds,
      added,
      alreadyFriends,
      skippedLimit,
    };
  }

  async removeFriends(
    userId: string,
    friendIdsToRemove: string[],
  ): Promise<RemoveFriendsResult> {
    const settings = await this.getOrCreateSettings(userId);
    const friendIds = new Set(settings.friendIds ?? []);
    const removed: string[] = [];
    const notFriends: string[] = [];

    for (const friendId of friendIdsToRemove) {
      if (!friendIds.has(friendId)) {
        notFriends.push(friendId);
        continue;
      }

      friendIds.delete(friendId);
      removed.push(friendId);
    }

    settings.friendIds = [...friendIds];
    await this.userSettingsRepository.save(settings);

    return {
      friendIds: settings.friendIds,
      removed,
      notFriends,
    };
  }

  private async getOrCreateSettings(userId: string): Promise<UserSettings> {
    const existing = await this.userSettingsRepository.findOne({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.userSettingsRepository.create({
      userId,
      defaultDuration: 30,
      safeword: 'red',
      friendIds: [],
    });
  }
}
