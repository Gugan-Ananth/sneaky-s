import {
  emptyEscapeState,
  EscapeMethod,
  EscapeState,
  Restraint,
  RestraintKind,
  ScenarioId,
} from './escape-rules';

type MaterialProfile = {
  method: EscapeMethod;
  required: number;
  slippery: boolean;
  cuttable: boolean;
  keyed: boolean;
};

type TargetSpec = {
  id: string;
  label: string;
  kind?: RestraintKind;
  layer?: number;
  blocksHands?: boolean;
  hindersWrists?: boolean;
  selfNeedsHands?: boolean;
  force?: 'stuffing';
};

const knot = (required: number, slippery = false): MaterialProfile => ({
  method: 'knot',
  required,
  slippery,
  cuttable: true,
  keyed: false,
});

const peel = (required: number): MaterialProfile => ({
  method: 'peel',
  required,
  slippery: false,
  cuttable: true,
  keyed: false,
});

const buckle = (required: number): MaterialProfile => ({
  method: 'buckle',
  required,
  slippery: false,
  cuttable: false,
  keyed: false,
});

const chain = (required: number): MaterialProfile => ({
  method: 'chain',
  required,
  slippery: false,
  cuttable: false,
  keyed: false,
});

const lock = (required: number): MaterialProfile => ({
  method: 'lock',
  required,
  slippery: false,
  cuttable: false,
  keyed: true,
});

const PROFILES: Record<string, MaterialProfile> = {
  handcuff: lock(100),
  rope: knot(70),
  transparenttape: peel(90),
  electrictape: peel(110),
  leatherbelt: buckle(70),
  ziptie: {
    method: 'ziptie',
    required: 80,
    slippery: false,
    cuttable: true,
    keyed: false,
  },
  scarves: knot(40, true),
  metalchain: chain(90),
  ropeharness: knot(70),
  transparenttapeharness: peel(90),
  electrictapeharness: peel(110),
  leatherharness: buckle(70),
  scarvesharness: knot(40, true),
  chainharness: chain(90),
  crotchrope: knot(70),
  crotchleatherbelt: buckle(70),
  crotchscarf: knot(40, true),
  crotchmetalchain: chain(90),
  leatherblindfold: buckle(70),
  clothblindfold: knot(40, true),
  scarvesblindfold: knot(40, true),
  transparenttapeblindfold: peel(90),
  electrictapeblindfold: peel(110),
  sleepmask: knot(40, true),
  satinblindfold: knot(40, true),
  ballgag: buckle(70),
  harnessballgag: buckle(70),
  leatherpanelgag: buckle(70),
  scarvescleavegag: knot(40, true),
  scarvesotmgag: knot(40, true),
  scarvesotngag: knot(40, true),
  clothcleavegag: knot(40, true),
  clothotmgag: knot(40, true),
  clothotngag: knot(40, true),
  ropecleavegag: knot(70),
  ringgag: buckle(70),
  harnessringgag: buckle(70),
};

const TARGETS: Record<string, TargetSpec> = {
  wrists: { id: 'wrists', label: 'Wrists', blocksHands: true },
  forearms: { id: 'forearms', label: 'Forearms', blocksHands: true },
  elbows: { id: 'elbows', label: 'Elbows', hindersWrists: true },
  upperarms: { id: 'upper-arms', label: 'Upper arms', hindersWrists: true },
  chest: { id: 'chest', label: 'Chest', selfNeedsHands: true },
  waist: { id: 'waist', label: 'Waist', selfNeedsHands: true },
  crotch: { id: 'crotch', label: 'Crotch', selfNeedsHands: true },
  upperthighs: {
    id: 'upper-thighs',
    label: 'Upper thighs',
    selfNeedsHands: true,
  },
  lowerthighs: {
    id: 'lower-thighs',
    label: 'Lower thighs',
    selfNeedsHands: true,
  },
  upperknees: { id: 'upper-knees', label: 'Upper knees', selfNeedsHands: true },
  lowerknees: { id: 'lower-knees', label: 'Lower knees', selfNeedsHands: true },
  calves: { id: 'calves', label: 'Calves', selfNeedsHands: true },
  ankles: { id: 'ankles', label: 'Ankles', selfNeedsHands: true },
  soles: { id: 'soles', label: 'Soles', selfNeedsHands: true },
  blindfold: {
    id: 'blindfold',
    label: 'Blindfold',
    kind: 'blindfold',
    selfNeedsHands: true,
  },
  mouthstuffing: {
    id: 'gag-stuffing',
    label: 'Mouth stuffing',
    kind: 'gag',
    layer: 0,
    force: 'stuffing',
  },
  mouthgag: {
    id: 'gag-mouth',
    label: 'Mouth gag',
    kind: 'gag',
    layer: 1,
    selfNeedsHands: true,
  },
  additionalgaglayer: {
    id: 'gag-extra',
    label: 'Extra gag',
    kind: 'gag',
    layer: 2,
    selfNeedsHands: true,
  },
};

const SCENE_MATERIAL: Record<ScenarioId, string> = {
  rope: 'Rope',
  leather: 'Padlocked leather',
  tape: 'Electrical tape',
  scarves: 'Scarves',
  chains: 'Steel chain',
};

const SCENE_REQUIRED: Record<
  ScenarioId,
  { arms: number; legs: number; gag: number; blindfold: number }
> = {
  scarves: { arms: 40, legs: 40, gag: 30, blindfold: 20 },
  rope: { arms: 80, legs: 80, gag: 40, blindfold: 20 },
  tape: { arms: 100, legs: 100, gag: 60, blindfold: 50 },
  leather: { arms: 90, legs: 90, gag: 50, blindfold: 30 },
  chains: { arms: 110, legs: 110, gag: 40, blindfold: 60 },
};

export function normalizeChoice(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[\s_-]+/g, '');
}

function baseRestraint(
  spec: TargetSpec,
  material: string,
  profile: MaterialProfile,
): Restraint {
  return {
    id: spec.id,
    label: spec.label,
    material,
    method: profile.method,
    kind: spec.kind ?? 'bondage',
    progress: 0,
    required: profile.required,
    released: false,
    layer: spec.layer ?? 0,
    blocksHands: spec.blocksHands ?? false,
    hindersWrists: spec.hindersWrists ?? false,
    selfNeedsHands: spec.selfNeedsHands ?? false,
    selfAfter: [],
    slippery: profile.slippery,
    cuttable: profile.cuttable,
    keyed: profile.keyed,
    edgeFound: false,
  };
}

export function restraintFromBindAnswer(
  target: string,
  answer: string,
): Restraint | null {
  if (normalizeChoice(answer) === 'skip') return null;

  const spec = TARGETS[normalizeChoice(target)];
  if (!spec) {
    throw new Error(`Unknown restraint target "${target}"`);
  }

  if (spec.force === 'stuffing') {
    return baseRestraint(spec, answer, {
      method: 'stuffing',
      required: 50,
      slippery: false,
      cuttable: false,
      keyed: false,
    });
  }

  const profile = PROFILES[normalizeChoice(answer)];
  if (!profile) {
    throw new Error(`Unknown restraint option "${answer}" for ${target}`);
  }

  return baseRestraint(spec, answer, profile);
}

export function buildBindRestraints(
  answers: { target: string; answer: string }[],
): Restraint[] {
  return answers.flatMap(({ target, answer }) => {
    const restraint = restraintFromBindAnswer(target, answer);
    return restraint ? [restraint] : [];
  });
}

function sceneProfile(
  scenarioId: ScenarioId,
  required: number,
): MaterialProfile {
  if (scenarioId === 'tape') return peel(required);
  if (scenarioId === 'leather' || scenarioId === 'chains')
    return lock(required);
  return knot(required, scenarioId === 'scarves');
}

function sceneRestraint(
  scenarioId: ScenarioId,
  id: string,
  label: string,
  required: number,
  extra: Partial<Restraint> = {},
): Restraint {
  const profile = sceneProfile(scenarioId, required);
  return {
    id,
    label,
    material: SCENE_MATERIAL[scenarioId],
    method: profile.method,
    kind: extra.kind ?? 'bondage',
    progress: 0,
    required: profile.required,
    released: false,
    layer: extra.layer ?? 0,
    blocksHands: extra.blocksHands ?? false,
    hindersWrists: false,
    selfNeedsHands: extra.selfNeedsHands ?? false,
    selfAfter: extra.selfAfter ?? [],
    slippery: profile.slippery,
    cuttable: profile.cuttable,
    keyed: profile.keyed,
    edgeFound: false,
  };
}

export function restraintsForScenario(
  scenarioId: ScenarioId,
  options: { gag: boolean; blindfold: boolean },
): Restraint[] {
  const required = SCENE_REQUIRED[scenarioId];
  const restraints = [
    sceneRestraint(scenarioId, 'arms', 'Arms', required.arms, {
      blocksHands: true,
    }),
    sceneRestraint(scenarioId, 'legs', 'Legs', required.legs, {
      selfNeedsHands: true,
    }),
  ];

  if (options.gag) {
    restraints.push(
      sceneRestraint(scenarioId, 'gag', 'Gag', required.gag, {
        kind: 'gag',
        layer: 1,
        selfNeedsHands: true,
      }),
    );
  }

  if (options.blindfold) {
    restraints.push(
      sceneRestraint(scenarioId, 'blindfold', 'Blindfold', required.blindfold, {
        kind: 'blindfold',
        selfNeedsHands: true,
      }),
    );
  }

  return restraints;
}

export function sceneName(scenarioId: ScenarioId | null): string {
  switch (scenarioId) {
    case 'rope':
      return 'Rope';
    case 'leather':
      return 'Padlocked leather';
    case 'tape':
      return 'Electrical tape';
    case 'scarves':
      return 'Scarves';
    case 'chains':
      return 'Padlocked chains';
    default:
      return 'Custom';
  }
}

export function bindEscapeState(
  answers: { target: string; answer: string }[],
): EscapeState {
  return emptyEscapeState(null, buildBindRestraints(answers));
}

export function scenarioEscapeState(
  scenarioId: ScenarioId,
  options: { gag: boolean; blindfold: boolean },
): EscapeState {
  return emptyEscapeState(
    scenarioId,
    restraintsForScenario(scenarioId, options),
  );
}
