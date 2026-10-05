import { EscapeFailure, EscapeSuccess, Restraint } from './escape-rules';

function spot(restraint: Restraint): string {
  return `${restraint.material.toLowerCase()} on your ${restraint.label.toLowerCase()}`;
}

function who(
  result: EscapeSuccess,
  actorName: string | null,
): {
  you: boolean;
  name: string;
} {
  if (!result.actorIsHelper) return { you: true, name: 'You' };
  return { you: false, name: actorName ?? 'Someone' };
}

function conjugate(verb: string, you: boolean): string {
  if (you) return verb;
  if (verb === 'pry') return 'pries';
  if (verb.endsWith('s') || verb.endsWith('sh') || verb.endsWith('ch')) {
    return `${verb}es`;
  }
  return `${verb}s`;
}

function act(
  person: { you: boolean; name: string },
  verb: string,
  rest: string,
): string {
  return `${person.name} ${conjugate(verb, person.you)} ${rest}`;
}

export function describePublic(
  result: EscapeSuccess,
  actorName: string | null,
): string {
  if (result.kind === 'search') {
    const name = result.hideActor ? 'Someone' : (actorName ?? 'Someone');
    if (result.found === 'nothing') {
      return `${name} searches the room and comes up with nothing.`;
    }
    if (result.found === 'pin') {
      return `${name} searches the room and finds a bobby pin.`;
    }
    if (result.found === 'scissors') {
      return `${name} searches the room and finds scissors.`;
    }
    return `${name} searches the room and finds a key.`;
  }

  const person = who(result, actorName);
  const restraint = result.restraint;
  const place = spot(restraint);

  if (result.effect === 'miss') {
    return 'You grab at empty air.';
  }

  if (result.effect === 'reset') {
    return 'The ziptie refuses to snap and bites down tighter.';
  }

  if (result.effect === 'free') {
    if (result.action === 'cut') {
      return act(person, 'cut', `the ${place} away.`);
    }
    if (result.action === 'key') {
      return `${person.name === 'You' ? 'You turn' : `${person.name} turns`} a key. The lock on your ${restraint.label.toLowerCase()} pops open.`;
    }
    if (result.action === 'snap') {
      return 'The ziptie snaps.';
    }
    if (restraint.method === 'stuffing') {
      return person.you
        ? `You work the ${restraint.material.toLowerCase()} out of your mouth.`
        : `${person.name} pulls the ${restraint.material.toLowerCase()} out of your mouth.`;
    }
    return `The ${place} comes loose.`;
  }

  if (result.effect === 'regress') {
    if (result.action === 'yank') {
      return `The yank cinches the ${place} tighter.`;
    }
    if (result.action === 'rip') {
      return `The rip fails and the ${restraint.material.toLowerCase()} welds back down.`;
    }
    return `The ${place} tightens.`;
  }

  if (restraint.method === 'stuffing') {
    return person.you
      ? `You push at the ${restraint.material.toLowerCase()} with your tongue.`
      : `${person.name} pulls at the ${restraint.material.toLowerCase()} in your mouth.`;
  }

  switch (result.action) {
    case 'pick':
      return `${act(person, 'pick', `at the ${place}.`)} It eases.`;
    case 'yank':
      return `The ${restraint.material.toLowerCase()} slips under the yank.`;
    case 'edge':
      return act(person, 'find', `an edge on the ${place}.`);
    case 'peel':
      return act(person, 'peel', `the ${place} back.`);
    case 'rip':
      return `The ${restraint.material.toLowerCase()} rips.`;
    case 'pry':
      return act(
        person,
        'pry',
        `at the buckle on your ${restraint.label.toLowerCase()}.`,
      );
    case 'tug':
      return act(
        person,
        'tug',
        `the strap on your ${restraint.label.toLowerCase()}.`,
      );
    case 'shim':
      return act(person, 'work', 'a shim under the ziptie.');
    case 'rake':
      return `The lock on your ${restraint.label.toLowerCase()} clicks.`;
    case 'lift':
      return act(person, 'lift', `a loop of the ${place}.`);
    case 'heave':
      return act(person, 'heave', `against the ${place}.`);
    default:
      return act(person, 'work', `at the ${place}.`);
  }
}

export function describeFailure(failure: EscapeFailure): string {
  if (failure.reason === 'cooldown') {
    const seconds = Math.max(1, Math.ceil((failure.retryInMs ?? 1000) / 1000));
    if (seconds >= 60) {
      return `Give it a moment. You can try again in ${Math.ceil(seconds / 60)}m.`;
    }
    return `Give it a moment. You can try again in ${seconds}s.`;
  }

  switch (failure.reason) {
    case 'unreachable':
      return "You can't reach that.";
    case 'no-item':
      return "You don't have anything that will work on that.";
    case 'not-helper':
      return 'Someone else in the cage has to do that.';
    default:
      return "That won't work on this restraint.";
  }
}
