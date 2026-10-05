import { BIND_QUESTIONS } from './bind-questions';
import {
  applyEscapeAction,
  derivedRestrictions,
  emptyEscapeState,
  EscapeAction,
  EscapeState,
  getReachableRestraints,
  isBoardClear,
  searchRoom,
} from './escape-rules';
import {
  buildBindRestraints,
  normalizeChoice,
  restraintFromBindAnswer,
  restraintsForScenario,
} from './restraints';
import { scenarios } from './scenarios';

function succeeded<T extends { ok: true }>(result: {
  ok: boolean;
}): result is T {
  return result.ok;
}

function act(
  state: EscapeState,
  action: EscapeAction,
  options: {
    actorId?: string;
    captiveId?: string;
    restraintId?: string;
    blindfolded?: boolean;
    now?: number;
    rng?: () => number;
  } = {},
) {
  const result = applyEscapeAction(state, {
    actorId: options.actorId ?? 'self',
    captiveId: options.captiveId ?? 'self',
    restraintId: options.restraintId ?? state.restraints[0].id,
    action,
    blindfolded: options.blindfolded ?? false,
    now: options.now ?? 0,
    rng: options.rng ?? (() => 0),
  });
  if (!succeeded(result)) {
    throw new Error(result.reason);
  }
  return result;
}

function progressOf(state: EscapeState, id: string): number {
  return (
    state.restraints.find((restraint) => restraint.id === id)?.progress ?? -1
  );
}

describe('escape rules', () => {
  it('frees a scarf wrist in fewer actions than electric tape', () => {
    const scarf = buildBindRestraints([
      { target: 'Wrists', answer: 'Scarves' },
    ])[0];
    const tape = buildBindRestraints([
      { target: 'Wrists', answer: 'Electric Tape' },
    ])[0];

    const count = (
      restraint: typeof scarf,
      first: EscapeAction,
      next: EscapeAction,
    ) => {
      let state = emptyEscapeState(null, [restraint]);
      let action = first;
      let steps = 0;
      while (!isBoardClear(state) && steps < 20) {
        const result = act(state, action, { now: steps * 20_000 });
        state = result.state;
        action = next;
        steps += 1;
      }
      return steps;
    };

    expect(count(scarf, 'pick', 'pick')).toBeLessThan(
      count(tape, 'edge', 'peel'),
    );
  });

  it('lets a yank cinch rope tighter and slip silk loose', () => {
    const rope = buildBindRestraints([{ target: 'Wrists', answer: 'Rope' }])[0];
    rope.progress = 30;
    const yanked = act(emptyEscapeState(null, [rope]), 'yank', {
      rng: () => 0.6,
    });
    expect(progressOf(yanked.state, 'wrists')).toBe(15);

    const silk = buildBindRestraints([
      { target: 'Wrists', answer: 'Scarves' },
    ])[0];
    const slipped = act(emptyEscapeState(null, [silk]), 'yank', {
      rng: () => 0.6,
    });
    expect(slipped.effect).toBe('free');
  });

  it('either snaps a ziptie or resets it', () => {
    const zip = () =>
      buildBindRestraints([{ target: 'Wrists', answer: 'Ziptie' }])[0];

    const freed = act(emptyEscapeState(null, [zip()]), 'snap', {
      rng: () => 0,
    });
    expect(freed.effect).toBe('free');

    const stuck = act(emptyEscapeState(null, [zip()]), 'snap', {
      rng: () => 0.4,
    });
    expect(stuck.effect).toBe('reset');
    expect(progressOf(stuck.state, 'wrists')).toBe(0);
    expect(stuck.state.restraints[0].required).toBe(100);
  });

  it('keeps stuffing locked under the outer gag layers', () => {
    const restraints = buildBindRestraints([
      { target: 'Mouth Stuffing', answer: 'Socks' },
      { target: 'Mouth Gag', answer: 'Cloth Cleave Gag' },
      { target: 'Additional Gag Layer', answer: 'Electric Tape' },
    ]);
    const state = emptyEscapeState(null, restraints);
    expect(getReachableRestraints(state, false).map((item) => item.id)).toEqual(
      ['gag-extra'],
    );

    restraints.find((item) => item.id === 'gag-extra')!.released = true;
    expect(getReachableRestraints(state, false).map((item) => item.id)).toEqual(
      ['gag-mouth'],
    );
    expect(derivedRestrictions(state).gag).toBe(true);

    restraints.find((item) => item.id === 'gag-mouth')!.released = true;
    expect(getReachableRestraints(state, false).map((item) => item.id)).toEqual(
      ['gag-stuffing'],
    );
  });

  it('halves self progress on the legs while the wrists are bound', () => {
    const restraints = buildBindRestraints([
      { target: 'Wrists', answer: 'Rope' },
      { target: 'Ankles', answer: 'Rope' },
    ]);
    const solo = act(emptyEscapeState(null, restraints), 'pick', {
      restraintId: 'ankles',
    });
    expect(progressOf(solo.state, 'ankles')).toBe(12);

    const helped = act(emptyEscapeState(null, restraints), 'pick', {
      restraintId: 'ankles',
      actorId: 'friend',
      captiveId: 'self',
    });
    expect(progressOf(helped.state, 'ankles')).toBe(50);
  });

  it('halves wrist progress while the elbows are still tied', () => {
    const hindered = buildBindRestraints([
      { target: 'Wrists', answer: 'Rope' },
      { target: 'Elbows', answer: 'Rope' },
    ]);
    const slow = act(emptyEscapeState(null, hindered), 'pick', {
      restraintId: 'wrists',
    });
    expect(progressOf(slow.state, 'wrists')).toBe(12);

    const open = buildBindRestraints([{ target: 'Wrists', answer: 'Rope' }]);
    const normal = act(emptyEscapeState(null, open), 'pick');
    expect(progressOf(normal.state, 'wrists')).toBe(25);

    const chest = buildBindRestraints([
      { target: 'Elbows', answer: 'Rope' },
      { target: 'Chest', answer: 'Rope Harness' },
    ]);
    const torso = act(emptyEscapeState(null, chest), 'pick', {
      restraintId: 'chest',
    });
    expect(progressOf(torso.state, 'chest')).toBe(25);
  });

  it('makes only the captive miss while blindfolded', () => {
    const wrists = buildBindRestraints([{ target: 'Wrists', answer: 'Rope' }]);
    const state = emptyEscapeState(null, wrists);
    const missed = applyEscapeAction(state, {
      actorId: 'self',
      captiveId: 'self',
      restraintId: 'wrists',
      action: 'pick',
      blindfolded: true,
      now: 0,
      rng: () => 0,
    });
    expect(succeeded(missed) && missed.effect).toBe('miss');
    if (!succeeded(missed)) return;
    expect(progressOf(missed.state, 'wrists')).toBe(0);

    const helped = act(state, 'pick', {
      actorId: 'friend',
      captiveId: 'self',
      blindfolded: true,
      rng: () => 0,
    });
    expect(helped.effect).toBe('progress');
    expect(progressOf(helped.state, 'wrists')).toBe(50);
  });

  it('spends a key on a lock and refuses scissors', () => {
    const cuffs = buildBindRestraints([
      { target: 'Wrists', answer: 'Hand-cuff' },
    ]);
    const locked = emptyEscapeState(null, cuffs);
    locked.items.friend = { pins: 0, scissors: 1, keys: 1 };

    const cut = applyEscapeAction(locked, {
      actorId: 'friend',
      captiveId: 'self',
      restraintId: 'wrists',
      action: 'cut',
      blindfolded: false,
      now: 0,
      rng: () => 0,
    });
    expect(cut.ok).toBe(false);
    if (!cut.ok) expect(cut.reason).toBe('bad-action');
    expect(locked.items.friend.scissors).toBe(1);

    const unlocked = act(locked, 'key', {
      actorId: 'friend',
      captiveId: 'self',
    });
    expect(unlocked.effect).toBe('free');
    expect(unlocked.state.items.friend.keys).toBe(0);

    const rope = buildBindRestraints([{ target: 'Wrists', answer: 'Rope' }]);
    const tied = emptyEscapeState(null, rope);
    tied.items.friend = { pins: 0, scissors: 1, keys: 0 };
    const snipped = act(tied, 'cut', {
      actorId: 'friend',
      captiveId: 'self',
    });
    expect(snipped.effect).toBe('free');
    expect(snipped.state.items.friend.scissors).toBe(0);
  });

  it('speeds lock raking when the actor is holding a pin', () => {
    const plain = act(
      emptyEscapeState(null, [
        buildBindRestraints([{ target: 'Wrists', answer: 'Hand-cuff' }])[0],
      ]),
      'rake',
    );
    expect(progressOf(plain.state, 'wrists')).toBe(20);

    const pinnedState = emptyEscapeState(null, [
      buildBindRestraints([{ target: 'Wrists', answer: 'Hand-cuff' }])[0],
    ]);
    pinnedState.items.friend = { pins: 1, scissors: 0, keys: 0 };
    const pinned = act(pinnedState, 'rake', {
      actorId: 'friend',
      captiveId: 'self',
    });
    expect(progressOf(pinned.state, 'wrists')).toBe(80);
  });

  it('signals a clear board when the last restraint comes off', () => {
    let state = emptyEscapeState(null, [
      buildBindRestraints([{ target: 'Wrists', answer: 'Scarves' }])[0],
    ]);
    const first = act(state, 'pick');
    expect(first.allFree).toBe(false);
    const second = act(first.state, 'pick', { now: 20_000 });
    expect(second.allFree).toBe(true);
    expect(isBoardClear(second.state)).toBe(true);
  });

  it('keeps separate cooldowns and search loot', () => {
    const state = emptyEscapeState(
      'chains',
      restraintsForScenario('chains', { gag: false, blindfold: false }),
    );
    const first = act(state, 'rake', { restraintId: 'arms' });
    const helper = act(first.state, 'rake', {
      actorId: 'friend',
      captiveId: 'self',
      restraintId: 'arms',
      now: 1_000,
    });
    expect(helper.ok).toBe(true);

    const blocked = applyEscapeAction(first.state, {
      actorId: 'self',
      captiveId: 'self',
      restraintId: 'arms',
      action: 'rake',
      blindfolded: false,
      now: 1_000,
    });
    expect(blocked.ok).toBe(false);

    const found = searchRoom(state, {
      actorId: 'friend',
      captiveId: 'self',
      blindfolded: true,
      now: 0,
      rng: () => 0.9,
    });
    expect(succeeded(found) && found.kind === 'search' && found.found).toBe(
      'key',
    );
    if (!succeeded(found) || found.kind !== 'search') return;
    expect(found.hideActor).toBe(true);
    expect(found.state.items.friend.keys).toBe(1);

    const again = searchRoom(found.state, {
      actorId: 'friend',
      captiveId: 'self',
      blindfolded: false,
      now: 20_000,
      rng: () => 0.9,
    });
    expect(again.ok).toBe(false);

    const selfSearch = searchRoom(state, {
      actorId: 'self',
      captiveId: 'self',
      blindfolded: false,
      now: 0,
    });
    expect(!selfSearch.ok && selfSearch.reason).toBe('not-helper');
  });

  it('builds /bind-me scenes as one method, with arms before legs', () => {
    for (const scenarioId of ['leather', 'chains'] as const) {
      const restraints = restraintsForScenario(scenarioId, {
        gag: true,
        blindfold: true,
      });
      expect(
        restraints.every(
          (restraint) => restraint.method === 'lock' && restraint.keyed,
        ),
      ).toBe(true);
    }

    expect(
      restraintsForScenario('rope', { gag: true, blindfold: true }).every(
        (restraint) => restraint.method === 'knot' && !restraint.keyed,
      ),
    ).toBe(true);
    expect(
      restraintsForScenario('scarves', { gag: true, blindfold: true }).every(
        (restraint) => restraint.slippery,
      ),
    ).toBe(true);
    expect(
      restraintsForScenario('tape', { gag: true, blindfold: true }).every(
        (restraint) => restraint.method === 'peel' && restraint.cuttable,
      ),
    ).toBe(true);

    const scene = emptyEscapeState(
      'rope',
      restraintsForScenario('rope', { gag: false, blindfold: false }),
    );
    expect(getReachableRestraints(scene, false).map((item) => item.id)).toEqual(
      ['arms'],
    );
    expect(getReachableRestraints(scene, true).map((item) => item.id)).toEqual([
      'arms',
      'legs',
    ]);
  });

  it('maps every /bind option and drops skips', () => {
    for (const question of BIND_QUESTIONS) {
      for (const option of question.options) {
        const restraint = restraintFromBindAnswer(question.target, option);
        if (normalizeChoice(option) === 'skip') {
          expect(restraint).toBeNull();
          continue;
        }
        expect(restraint?.required).toBeGreaterThan(0);
      }
    }

    expect(
      buildBindRestraints([
        { target: 'Wrists', answer: 'Rope' },
        { target: 'Elbows', answer: 'Skip' },
      ]).map((restraint) => restraint.id),
    ).toEqual(['wrists']);
  });

  it('keeps the five /bind-me scenes in the story order', () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'rope',
      'leather',
      'tape',
      'scarves',
      'chains',
    ]);
  });
});
