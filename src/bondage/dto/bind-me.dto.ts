import { Choice, Param, ParamType } from '@discord-nestjs/core';
import { Yno } from 'src/user/dto/yno';

export class BindMeDto {
  @Choice(Yno)
  @Param({
    name: 'gag',
    type: ParamType.INTEGER,
    required: false,
    description: 'If you want to get gagged for this session? (default: no)',
  })
  gag?: number;

  @Choice(Yno)
  @Param({
    name: 'blindfold',
    type: ParamType.INTEGER,
    required: false,
    description:
      'If you want to get blindfolded for this session? (default: no)',
  })
  blindfold?: number;

  @Choice(Yno)
  @Param({
    name: 'private-cage',
    type: ParamType.INTEGER,
    required: false,
    description:
      'If you want a private cage that only you and your friends can see (default: no)',
  })
  privateCage?: number;
}
