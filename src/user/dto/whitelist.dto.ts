import { Param, ParamType } from '@discord-nestjs/core';

export class WhitelistDto {
  @Param({
    name: 'user',
    type: ParamType.USER,
    required: true,
    description: 'Flagged user to whitelist as a false positive',
  })
  user?: string;
}
