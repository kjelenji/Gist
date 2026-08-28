/**
 * All Gist puzzles. The live weekly board is CURRENT_PUZZLE_ID;
 * everything else is playable from /archive in the pop-on-board format.
 *
 * Coordinate system (letter = column, number = row, row 1 at top):
 *   a1 b1 c1
 *   a2 b2 c2
 *   a3 b3 c3
 */

/** @typedef {{ id: string; type: 'fixed'|'fill'; word?: string; options?: string[]; correct?: string }} Cell */
/** @typedef {{ id: string; word: string; kind: 'link'|'rebus'; cells: string[]; resultCell?: string }} Group */
/** @typedef {{
 *   id: string;
 *   number: string;
 *   title: string;
 *   BOARD: Cell[];
 *   GROUPS: Group[];
 *   THEME: { word: string; icons: string[] };
 *   THEME_GROUP: Group;
 *   COLLECTIBLE: { number: string; word: string };
 *   HINT_REVEAL_ORDER: string[];
 *   GROUP_COLORS: Record<string, string>;
 *   COMBINE_SIZE: number;
 *   MAX_HINTS: number;
 *   MAX_LIVES: number;
 *   TOTAL_MOVES: number;
 * }} Puzzle
 */

const SHARED = {
  COMBINE_SIZE: 3,
  MAX_HINTS: 3,
  MAX_LIVES: 3,
};

/** @param {Omit<Puzzle, 'COMBINE_SIZE'|'MAX_HINTS'|'MAX_LIVES'|'TOTAL_MOVES'|'THEME_GROUP'> & { themeKind?: 'link'|'rebus' }} def */
function makePuzzle(def) {
  const { themeKind = 'rebus', ...rest } = def;
  return {
    ...SHARED,
    ...rest,
    THEME_GROUP: {
      id: rest.THEME.word,
      word: rest.THEME.word,
      kind: themeKind,
      cells: /** @type {string[]} */ ([]),
    },
    TOTAL_MOVES: rest.GROUPS.length + 1,
  };
}

/**
 * Puzzle 1 — mitt / owl / algae → mythology
 *
 *   [athena]  awl         jay
 *   wisdom    eye         eye chart
 *   hand      himantes2   [himantes1]
 *
 * Each group is an orthogonal 3-path. Leftover results land on
 * b2 / c2 / c3 so the last combine is edge-adjacent (no diagonals).
 */
const mythology = makePuzzle({
  id: 'mythology',
  number: '001',
  title: 'Puzzle 1',
  BOARD: [
    { id: 'a1', type: 'fill', options: ['athena', 'hera', 'aphrodite'], correct: 'athena' },
    { id: 'b1', type: 'fixed', word: 'awl' },
    { id: 'c1', type: 'fixed', word: 'jay' },
    { id: 'a2', type: 'fixed', word: 'wisdom' },
    { id: 'b2', type: 'fixed', word: 'eye' },
    { id: 'c2', type: 'fixed', word: 'eye chart' },
    { id: 'a3', type: 'fixed', word: 'hand' },
    { id: 'b3', type: 'fixed', word: 'himantes2' },
    {
      id: 'c3',
      type: 'fill',
      options: ['himantes1', 'helmet', 'mittens'],
      correct: 'himantes1',
    },
  ],
  GROUPS: [
    { id: 'owl', word: 'owl', kind: 'link', cells: ['a1', 'a2', 'b2'], resultCell: 'b2' },
    { id: 'algae', word: 'algae', kind: 'rebus', cells: ['b1', 'c1', 'c2'], resultCell: 'c2' },
    { id: 'mitt', word: 'mitt', kind: 'link', cells: ['a3', 'b3', 'c3'], resultCell: 'c3' },
  ],
  THEME: { word: 'mythology', icons: ['mitt', 'owl', 'algae'] },
  themeKind: 'rebus',
  COLLECTIBLE: { number: '001', word: 'owl' },
  HINT_REVEAL_ORDER: ['algae', 'owl', 'mitt'],
  GROUP_COLORS: {
    algae: '#00008B',
    mitt: '#0000CD',
    owl: '#ADD8E6',
    mythology: '#5e8fb6',
  },
});

/**
 * Puzzle 2 — car / knee / bull → carnival
 *
 *   [neon]  bumper car   minus
 *   roller  clown car    on
 *   [horn]  red cape     bullseye
 *
 * Car lands on b2 so the vacant bumper-car cell unlocks the knee rebus.
 */
const carnival = makePuzzle({
  id: 'carnival',
  number: '002',
  title: 'Puzzle 2',
  BOARD: [
    { id: 'a1', type: 'fill', options: ['neon', 'x-ray', 'lamp'], correct: 'neon' },
    { id: 'b1', type: 'fixed', word: 'bumper car' },
    { id: 'c1', type: 'fixed', word: 'minus' },
    { id: 'a2', type: 'fixed', word: 'roller coaster' },
    { id: 'b2', type: 'fixed', word: 'clown car' },
    { id: 'c2', type: 'fixed', word: 'on' },
    { id: 'a3', type: 'fill', options: ['horn', 'tusk', 'fingernail'], correct: 'horn' },
    { id: 'b3', type: 'fixed', word: 'red cape' },
    { id: 'c3', type: 'fixed', word: 'bullseye target' },
  ],
  GROUPS: [
    { id: 'car', word: 'car', kind: 'link', cells: ['b1', 'b2', 'a2'], resultCell: 'b2' },
    { id: 'knee', word: 'knee', kind: 'rebus', cells: ['a1', 'c1', 'c2'], resultCell: 'c2' },
    { id: 'bull', word: 'bull', kind: 'link', cells: ['a3', 'b3', 'c3'], resultCell: 'c3' },
  ],
  THEME: { word: 'carnival', icons: ['car', 'knee', 'bull'] },
  themeKind: 'rebus',
  COLLECTIBLE: { number: '002', word: 'ferris-wheel' },
  HINT_REVEAL_ORDER: ['knee', 'car', 'bull'],
  GROUP_COLORS: {
    knee: '#00008B',
    car: '#0000CD',
    bull: '#ADD8E6',
    carnival: '#5e8fb6',
  },
});

/**
 * Puzzle 3 — scent / roll / park → central park
 *
 *   rolled cash   dollar        [divide]
 *   kaiser roll   [RR]          hundred
 *   tree          slide         bench
 *
 * Each group is an orthogonal 3-path. Leftover results land on
 * b2 / c2 / c3 so the last combine is edge-adjacent (no diagonals).
 */
const centralPark = makePuzzle({
  id: 'central-park',
  number: '003',
  title: 'Puzzle 3',
  BOARD: [
    { id: 'a1', type: 'fixed', word: 'rolled cash' },
    { id: 'b1', type: 'fixed', word: 'dollar' },
    { id: 'c1', type: 'fill', options: ['divide', 'multiply', 'addition'], correct: 'divide' },
    { id: 'a2', type: 'fixed', word: 'kaiser roll' },
    {
      id: 'b2',
      type: 'fill',
      options: ['maserati', 'rolls-royce', 'lamborghini'],
      correct: 'rolls-royce',
    },
    { id: 'c2', type: 'fixed', word: 'hundred' },
    { id: 'a3', type: 'fixed', word: 'tree' },
    { id: 'b3', type: 'fixed', word: 'slide' },
    { id: 'c3', type: 'fixed', word: 'bench' },
  ],
  GROUPS: [
    { id: 'roll', word: 'roll', kind: 'link', cells: ['a1', 'a2', 'b2'], resultCell: 'b2' },
    { id: 'scent', word: 'scent', kind: 'rebus', cells: ['b1', 'c1', 'c2'], resultCell: 'c2' },
    { id: 'park', word: 'park', kind: 'link', cells: ['a3', 'b3', 'c3'], resultCell: 'c3' },
  ],
  THEME: { word: 'central park', icons: ['scent', 'roll', 'park'] },
  themeKind: 'rebus',
  COLLECTIBLE: { number: '003', word: 'central park' },
  HINT_REVEAL_ORDER: ['scent', 'roll', 'park'],
  GROUP_COLORS: {
    scent: '#00008B',
    roll: '#0000CD',
    park: '#ADD8E6',
    'central park': '#5e8fb6',
  },
});

/**
 * Puzzle 4 — fur / ant / ship → friendship
 *
 *   mink        hip            she
 *   rabbit      [fox]          shh
 *   ant colony  [anthill]      queen ant
 */
const friendship = makePuzzle({
  id: 'friendship',
  number: '004',
  title: 'Puzzle 4',
  BOARD: [
    { id: 'a1', type: 'fixed', word: 'mink' },
    { id: 'b1', type: 'fixed', word: 'hip' },
    { id: 'c1', type: 'fixed', word: 'she' },
    { id: 'a2', type: 'fixed', word: 'rabbit' },
    { id: 'b2', type: 'fill', options: ['fox', 'lamb', 'goat'], correct: 'fox' },
    { id: 'c2', type: 'fixed', word: 'shh' },
    { id: 'a3', type: 'fixed', word: 'ant colony' },
    { id: 'b3', type: 'fill', options: ['anthill', 'owl home', 'nest'], correct: 'anthill' },
    { id: 'c3', type: 'fixed', word: 'queen ant' },
  ],
  GROUPS: [
    { id: 'fur', word: 'fur', kind: 'link', cells: ['a1', 'a2', 'b2'], resultCell: 'b2' },
    { id: 'ant', word: 'ant', kind: 'link', cells: ['a3', 'b3', 'c3'], resultCell: 'c3' },
    { id: 'ship', word: 'ship', kind: 'rebus', cells: ['c2', 'c1', 'b1'], resultCell: 'c2' },
  ],
  THEME: { word: 'friendship', icons: ['fur', 'ant', 'ship'] },
  themeKind: 'rebus',
  COLLECTIBLE: { number: '004', word: 'friendship' },
  HINT_REVEAL_ORDER: ['fur', 'ant', 'ship'],
  GROUP_COLORS: {
    ship: '#00008B',
    fur: '#0000CD',
    ant: '#ADD8E6',
    friendship: '#5e8fb6',
  },
});

/**
 * Puzzle 5 — leaves / daylight / temperature → fall (this week)
 *
 *   temp     [maple]   day
 *   [air]    aight     lie
 *   char     oak       birch
 *
 * Daylight lands on c2 so vacant aight unlocks maple + oak + birch.
 */
const fall = makePuzzle({
  id: 'fall',
  number: '005',
  title: 'Puzzle 5',
  BOARD: [
    { id: 'a1', type: 'fixed', word: 'temp' },
    {
      id: 'b1',
      type: 'fill',
      options: ['maple', 'honey', 'dandelion'],
      correct: 'maple',
    },
    { id: 'c1', type: 'fixed', word: 'day' },
    {
      id: 'a2',
      type: 'fill',
      options: ['air', 'water', 'fire'],
      correct: 'air',
    },
    { id: 'b2', type: 'fixed', word: 'aight' },
    { id: 'c2', type: 'fixed', word: 'lie' },
    { id: 'a3', type: 'fixed', word: 'char' },
    { id: 'b3', type: 'fixed', word: 'oak' },
    { id: 'c3', type: 'fixed', word: 'birch' },
  ],
  GROUPS: [
    { id: 'leaves', word: 'leaves', kind: 'link', cells: ['b1', 'b3', 'c3'], resultCell: 'c3' },
    { id: 'daylight', word: 'daylight', kind: 'rebus', cells: ['c1', 'c2', 'b2'], resultCell: 'c2' },
    { id: 'temperature', word: 'temperature', kind: 'rebus', cells: ['a1', 'a2', 'a3'], resultCell: 'a2' },
  ],
  THEME: { word: 'fall', icons: ['leaves', 'temperature', 'daylight'] },
  themeKind: 'link',
  COLLECTIBLE: { number: '005', word: 'fall' },
  HINT_REVEAL_ORDER: ['daylight', 'temperature', 'leaves'],
  GROUP_COLORS: {
    daylight: '#00008B',
    temperature: '#0000CD',
    leaves: '#ADD8E6',
    fall: '#5e8fb6',
  },
});

/** @type {Puzzle[]} */
export const PUZZLES = [mythology, carnival, centralPark, friendship, fall];

export const CURRENT_PUZZLE_ID = 'fall';

const byId = Object.fromEntries(PUZZLES.map((p) => [p.id, p]));

/** @param {string | null | undefined} id */
export function getPuzzle(id) {
  if (!id) return null;
  return byId[id] ?? null;
}

export function getCurrentPuzzle() {
  return byId[CURRENT_PUZZLE_ID];
}

export function archivePuzzles() {
  return PUZZLES.filter((p) => p.id !== CURRENT_PUZZLE_ID);
}

/** @param {string | null | undefined} id */
export function isCurrentPuzzle(id) {
  return !!id && id === CURRENT_PUZZLE_ID;
}
