import { Param, ParamType } from '@discord-nestjs/core';

export class FriendsDto {
  @Param({
    name: 'add',
    type: ParamType.USER,
    required: false,
    description: 'Friend who can visit your private cages',
  })
  add?: string;

  @Param({
    name: 'add-2',
    type: ParamType.USER,
    required: false,
    description: 'Another friend who can visit your private cages',
  })
  add2?: string;

  @Param({
    name: 'add-3',
    type: ParamType.USER,
    required: false,
    description: 'Another friend who can visit your private cages',
  })
  add3?: string;

  @Param({
    name: 'add-4',
    type: ParamType.USER,
    required: false,
    description: 'Another friend who can visit your private cages',
  })
  add4?: string;

  @Param({
    name: 'add-5',
    type: ParamType.USER,
    required: false,
    description: 'Another friend who can visit your private cages',
  })
  add5?: string;

  @Param({
    name: 'remove',
    type: ParamType.USER,
    required: false,
    description: 'Friend to remove from your list',
  })
  remove?: string;
}
