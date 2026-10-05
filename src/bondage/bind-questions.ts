export type BindQuestion = {
  target: string;
  prompt: string;
  options: readonly string[];
};

const STANDARD_OPTIONS = [
  'Rope',
  'Transparent Tape',
  'Electric Tape',
  'Leather Belt',
  'Ziptie',
  'Scarves',
  'Metal Chain',
  'Skip',
];

export const BIND_QUESTIONS: readonly BindQuestion[] = [
  {
    target: 'Wrists',
    prompt: 'How would you like your wrists tied?',
    options: [
      'Hand-cuff',
      'Rope',
      'Transparent Tape',
      'Electric Tape',
      'Leather Belt',
      'Ziptie',
      'Scarves',
      'Metal Chain',
    ],
  },
  {
    target: 'Forearms',
    prompt: 'How would you like your forearms tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Elbows',
    prompt: 'How would you like your elbows tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Upper arms',
    prompt: 'How would you like your upper arms tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Chest',
    prompt: 'How would you like your chest tied?',
    options: [
      'Rope Harness',
      'Transparent Tape Harness',
      'Electric Tape Harness',
      'Leather Harness',
      'Scarves Harness',
      'Chain Harness',
      'Skip',
    ],
  },
  {
    target: 'Waist',
    prompt: 'How would you like your waist tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Crotch',
    prompt: 'How would you like your crotch tied?',
    options: [
      'Crotch Rope',
      'Crotch Leather Belt',
      'Crotch Scarf',
      'Crotch Metal Chain',
      'Skip',
    ],
  },
  {
    target: 'Upper thighs',
    prompt: 'How would you like your upper thighs tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Lower thighs',
    prompt: 'How would you like your lower thighs tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Upper knees',
    prompt: 'How would you like your upper knees tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Lower knees',
    prompt: 'How would you like your lower knees tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Calves',
    prompt: 'How would you like your calves tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Ankles',
    prompt: 'How would you like your ankles tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Soles',
    prompt: 'Do you like your soles tied?',
    options: STANDARD_OPTIONS,
  },
  {
    target: 'Blindfold',
    prompt: 'What Blindfold do you choose?',
    options: [
      'Leather Blindfold',
      'Cloth Blindfold',
      'Scarves Blindfold',
      'Transparent Tape Blindfold',
      'Electric Tape Blindfold',
      'Sleep Mask',
      'Satin Blindfold',
      'Skip',
    ],
  },
  {
    target: 'Mouth Stuffing',
    prompt: 'How would you like your mouth stuffed?',
    options: [
      'Sponge Ball',
      'Dirty Rag',
      'Clothes',
      'Socks',
      'Dirty Socks',
      'Pantyhose',
      'Scarves',
      'Panties',
      'Skip',
    ],
  },
  {
    target: 'Mouth Gag',
    prompt: 'What gag do you choose?',
    options: [
      'Ball Gag',
      'Harness Ball Gag',
      'Leather Panel Gag',
      'Electric Tape',
      'Transparent Tape',
      'Scarves Cleave Gag',
      'Scarves OTM Gag',
      'Scarves OTN Gag',
      'Cloth Cleave Gag',
      'Cloth OTM Gag',
      'Cloth OTN Gag',
      'Rope Cleave Gag',
      'Ring Gag',
      'Harness Ring Gag',
      'Skip',
    ],
  },
  {
    target: 'Additional Gag Layer',
    prompt: 'Would you like an additional Gag Layer?',
    options: [
      'Electric Tape',
      'Transparent Tape',
      'Scarves OTM Gag',
      'Scarves OTN Gag',
      'Cloth OTM Gag',
      'Cloth OTN Gag',
      'Skip',
    ],
  },
] as const;

export const PRIVATE_CAGE_QUESTION: BindQuestion = {
  target: 'Private Cage',
  prompt:
    'Would you like a private cage? (Only you and your friends can see it)',
  options: ['Yes', 'No'],
};

export const READY_QUESTION: BindQuestion = {
  target: 'Ready',
  prompt: 'Are you ready?',
  options: ['Yes', 'No'],
};
