/**
 * Authoring helpers for a weekly 3×3 puzzle.
 *
 * Copy the template at the bottom of puzzles.js. Groups must sit on a
 * row, column, or L (shared edges only). A group may skip tiles if
 * solving another group first leaves an empty path between them.
 */

import { CELL_IDS, cellsOrthogonallyConnected } from './boardGeometry.js';

const SHARED = {
  COMBINE_SIZE: 3,
  MAX_HINTS: 3,
  MAX_LIVES: 3,
};

const GROUP_PALETTE = ['#00008B', '#0000CD', '#ADD8E6'];
const THEME_COLOR = '#5e8fb6';

/** @param {string} cells */
function parseCells(cells) {
  const list = Array.isArray(cells)
    ? cells
    : String(cells)
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
  return list.map((id) => String(id).toLowerCase());
}

function padNumber(n) {
  return String(n).padStart(3, '0');
}

function resultOf(group) {
  return group.resultCell || group.cells[group.cells.length - 1];
}

function vacantAfter(groups) {
  /** @type {string[]} */
  const vacant = [];
  for (const group of groups) {
    const landing = resultOf(group);
    for (const id of group.cells) {
      if (id !== landing) vacant.push(id);
    }
  }
  return vacant;
}

/** @template T @param {T[]} items */
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations(items.filter((_, j) => j !== i)).map((rest) => [item, ...rest])
  );
}

/**
 * Fill-in tile (top / left / right wedges).
 *   fill('answer', 'decoy', 'decoy')
 *   fill(['top', 'left', 'right'], 'answer')  // when the answer is not the top wedge
 * @param {string | string[]} correctOrOptions
 * @param {string} [decoyAOrCorrect]
 * @param {string} [decoyB]
 */
export function fill(correctOrOptions, decoyAOrCorrect, decoyB) {
  if (Array.isArray(correctOrOptions)) {
    const options = correctOrOptions;
    const correct = decoyAOrCorrect;
    if (!correct || options.length !== 3 || !options.includes(correct)) {
      throw new Error('fill([top, left, right], answer) needs three icons including the answer');
    }
    return { type: 'fill', options, correct };
  }
  if (!correctOrOptions || !decoyAOrCorrect || !decoyB) {
    throw new Error('fill(answer, decoy, decoy) needs three icons');
  }
  return { type: 'fill', options: [correctOrOptions, decoyAOrCorrect, decoyB], correct: correctOrOptions };
}

/**
 * Category / “these belong together” group.
 * @param {string} word
 * @param {string | string[]} cells  e.g. 'a1 a2 b2'
 * @param {string} resultCell       where the answer icon pops
 */
export function link(word, cells, resultCell) {
  return { id: word, word, kind: 'link', cells: parseCells(cells), resultCell };
}

/**
 * Wordplay / rebus group.
 * @param {string} word
 * @param {string | string[]} cells
 * @param {string} resultCell
 */
export function rebus(word, cells, resultCell) {
  return { id: word, word, kind: 'rebus', cells: parseCells(cells), resultCell };
}

function cellFromSpec(id, spec) {
  if (spec && typeof spec === 'object' && spec.type === 'fill') {
    return { id, type: 'fill', options: spec.options, correct: spec.correct };
  }
  if (typeof spec === 'string' && spec.trim()) {
    return { id, type: 'fixed', word: spec.trim() };
  }
  throw new Error(`Cell ${id} is empty — use a word or fill(answer, decoy, decoy).`);
}

function assertGroupsOrthogonal(puzzleId, groups) {
  const orders = permutations(groups);
  for (const order of orders) {
    /** @type {typeof groups} */
    const solved = [];
    let ok = true;
    for (const group of order) {
      if (!cellsOrthogonallyConnected(group.cells, CELL_IDS, vacantAfter(solved))) {
        ok = false;
        break;
      }
      solved.push(group);
    }
    if (ok) return;
  }

  const shapes = groups
    .map((g) => `  ${g.word}: ${g.cells.join('–')}`)
    .join('\n');
  throw new Error(
    `Puzzle "${puzzleId}" has no solve order that stays orthogonal (no diagonals).\n` +
      `Each group must be a row, column, or L — or become one after another group leaves empty tiles.\n` +
      `${shapes}`
  );
}

/**
 * Build a puzzle from a 3×3 board + 3 groups. Throws if the layout
 * would force a diagonal swipe.
 *
 * @param {{
 *   id: string;
 *   number: string | number;
 *   title?: string;
 *   theme: string;
 *   themeKind?: 'link' | 'rebus';
 *   collectible?: string;
 *   hints?: string[];
 *   board: unknown[][];
 *   groups: { id: string; word: string; kind: 'link'|'rebus'; cells: string[]; resultCell?: string }[];
 * }} def
 */
export function definePuzzle(def) {
  const {
    id,
    number,
    theme,
    themeKind = 'rebus',
    collectible,
    hints,
    board,
    groups,
  } = def;

  if (!id) throw new Error('Puzzle is missing id.');
  if (!theme) throw new Error(`Puzzle "${id}" is missing theme.`);
  if (!Array.isArray(board) || board.length !== 3 || board.some((row) => row?.length !== 3)) {
    throw new Error(`Puzzle "${id}" board must be a 3×3 array.`);
  }
  if (!Array.isArray(groups) || groups.length !== 3) {
    throw new Error(`Puzzle "${id}" needs exactly 3 groups.`);
  }

  const BOARD = board.flatMap((row, r) =>
    row.map((spec, c) => cellFromSpec(CELL_IDS[r * 3 + c], spec))
  );

  const GROUPS = groups.map((group) => {
    const cells = parseCells(group.cells);
    if (cells.length !== SHARED.COMBINE_SIZE) {
      throw new Error(
        `Puzzle "${id}" group "${group.word}" must list ${SHARED.COMBINE_SIZE} cells, got ${cells.join(', ')}.`
      );
    }
    for (const cellId of cells) {
      if (!CELL_IDS.includes(cellId)) {
        throw new Error(`Puzzle "${id}" group "${group.word}" has unknown cell "${cellId}".`);
      }
    }
    const resultCell = group.resultCell || cells[cells.length - 1];
    if (!cells.includes(resultCell)) {
      throw new Error(
        `Puzzle "${id}" group "${group.word}" result "${resultCell}" is not one of ${cells.join(', ')}.`
      );
    }
    return {
      id: group.id || group.word,
      word: group.word,
      kind: group.kind,
      cells,
      resultCell,
    };
  });

  const covered = GROUPS.flatMap((g) => g.cells);
  const unique = new Set(covered);
  if (unique.size !== CELL_IDS.length || covered.length !== CELL_IDS.length) {
    throw new Error(`Puzzle "${id}": every board cell must belong to exactly one group.`);
  }

  const groupIds = GROUPS.map((g) => g.id);
  const HINT_REVEAL_ORDER = hints?.length ? hints : groupIds;
  for (const hintId of HINT_REVEAL_ORDER) {
    if (!groupIds.includes(hintId)) {
      throw new Error(`Puzzle "${id}" hint "${hintId}" is not a group. Groups: ${groupIds.join(', ')}`);
    }
  }

  assertGroupsOrthogonal(id, GROUPS);

  /** @type {Record<string, string>} */
  const GROUP_COLORS = { [theme]: THEME_COLOR };
  GROUPS.forEach((group, i) => {
    GROUP_COLORS[group.id] = GROUP_PALETTE[i] ?? THEME_COLOR;
  });

  const num = padNumber(number);

  return {
    ...SHARED,
    id,
    number: num,
    title: def.title || `Puzzle ${Number(number)}`,
    BOARD,
    GROUPS,
    THEME: { word: theme, icons: GROUPS.map((g) => g.word) },
    THEME_GROUP: {
      id: theme,
      word: theme,
      kind: themeKind,
      cells: /** @type {string[]} */ ([]),
    },
    COLLECTIBLE: { number: num, word: collectible || theme },
    HINT_REVEAL_ORDER,
    GROUP_COLORS,
    TOTAL_MOVES: GROUPS.length + 1,
  };
}
