import { Param, ParamType } from '@discord-nestjs/core';

export class SettingsDto {
  @Param({
    name: 'safeword',
    type: ParamType.STRING,
    required: false,
    description: 'Safeword (default is red)',
  })
  safeword?: string;
}
