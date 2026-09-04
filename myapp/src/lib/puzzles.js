/**
 * All Gist puzzles. Switch the live week with CURRENT_PUZZLE_ID.
 *
 * How to add a puzzle
 * -------------------
 * 1. Put PNGs in static/icons/ (filename = icon word, spaces → hyphens)
 *    or add an emoji in icons.js.
 * 2. Copy WEEK_TEMPLATE below, rename it, and fill in the 3×3.
 * 3. List 3 groups. cells: 'a1 a2 b2'  (a1 is top-left).
 *    result: the cell where the answer icon pops; the other two go empty.
 * 4. Push the puzzle into PUZZLES and set CURRENT_PUZZLE_ID.
 *
 * Groups must be a row, column, or L — no diagonals. A group may skip
 * tiles if solving another group first leaves an empty path (carnival “knee”).
 *
 *   a1 b1 c1
 *   a2 b2 c2
 *   a3 b3 c3
 */

import { definePuzzle, fill, link, rebus } from './definePuzzle.js';

export { definePuzzle, fill, link, rebus };

/** @typedef {{ id: string; type: 'fixed'|'fill'; word?: string; options?: string[]; correct?: string }} Cell */
/** @typedef {{ id: string; word: string; kind: 'link'|'rebus'; cells: string[]; resultCell?: string }} Group */
/** @typedef {ReturnType<typeof definePuzzle>} Puzzle */

const mythology = definePuzzle({
  id: 'mythology',
  number: 1,
  theme: 'mythology',
  collectible: 'owl',
  hints: ['algae', 'owl', 'mitt'],
  board: [
    [fill('athena', 'hera', 'aphrodite'), 'awl', 'jay'],
    ['wisdom', 'eye', 'eye chart'],
    ['hand', 'himantes2', fill('himantes1', 'helmet', 'mittens')],
  ],
  groups: [
    link('owl', 'a1 a2 b2', 'b2'),
    rebus('algae', 'b1 c1 c2', 'c2'),
    link('mitt', 'a3 b3 c3', 'c3'),
  ],
});

const carnival = definePuzzle({
  id: 'carnival',
  number: 2,
  theme: 'carnival',
  collectible: 'ferris-wheel',
  hints: ['knee', 'car', 'bull'],
  board: [
    [fill('neon', 'x-ray', 'lamp'), 'bumper car', 'minus'],
    ['roller coaster', 'clown car', 'on'],
    [fill('horn', 'tusk', 'fingernail'), 'red cape', 'bullseye target'],
  ],
  groups: [
    link('car', 'b1 b2 a2', 'b2'),
    rebus('knee', 'a1 c1 c2', 'c2'),
    link('bull', 'a3 b3 c3', 'c3'),
  ],
});

const centralPark = definePuzzle({
  id: 'central-park',
  number: 3,
  theme: 'central park',
  collectible: 'central park',
  hints: ['scent', 'roll', 'park'],
  board: [
    ['rolled cash', 'dollar', fill('divide', 'multiply', 'addition')],
    ['kaiser roll', fill(['maserati', 'rolls-royce', 'lamborghini'], 'rolls-royce'), 'hundred'],
    ['tree', 'slide', 'bench'],
  ],
  groups: [
    link('roll', 'a1 a2 b2', 'b2'),
    rebus('scent', 'b1 c1 c2', 'c2'),
    link('park', 'a3 b3 c3', 'c3'),
  ],
});

const friendship = definePuzzle({
  id: 'friendship',
  number: 4,
  theme: 'friendship',
  collectible: 'friendship',
  hints: ['fur', 'ant', 'ship'],
  board: [
    ['mink', 'hip', 'she'],
    ['rabbit', fill('fox', 'lamb', 'goat'), 'shh'],
    ['ant colony', fill('anthill', 'owl home', 'nest'), 'queen ant'],
  ],
  groups: [
    link('fur', 'a1 a2 b2', 'b2'),
    link('ant', 'a3 b3 c3', 'c3'),
    rebus('ship', 'c2 c1 b1', 'c2'),
  ],
});

const fall = definePuzzle({
  id: 'fall',
  number: 5,
  theme: 'fall',
  themeKind: 'link',
  collectible: 'fall',
  hints: ['daylight', 'temperature', 'leaves'],
  board: [
    ['temp', fill('maple', 'honey', 'dandelion'), 'oak'],
    [fill('air', 'water', 'fire'), 'birch', 'aight'],
    ['char', 'day', 'lie'],
  ],
  groups: [
    link('leaves', 'b1 c1 b2', 'b2'),
    rebus('daylight', 'b3 c3 c2', 'c2'),
    rebus('temperature', 'a1 a2 a3', 'a2'),
  ],
});

/*
const WEEK_TEMPLATE = definePuzzle({
  id: 'example',
  number: 6,
  theme: 'example',
  themeKind: 'rebus',
  collectible: 'example',
  hints: ['group-a', 'group-b', 'group-c'],
  board: [
    ['top-left', fill('answer', 'decoy', 'decoy'), 'top-right'],
    ['mid-left', 'center', 'mid-right'],
    ['bot-left', 'bot-center', 'bot-right'],
  ],
  groups: [
    link('group-a', 'a1 a2 b2', 'b2'),
    rebus('group-b', 'b1 c1 c2', 'c2'),
    link('group-c', 'a3 b3 c3', 'c3'),
  ],
});
*/

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
