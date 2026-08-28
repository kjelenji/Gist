/**
 * Puzzle engine — matching, progress, and board helpers.
 * Board data lives in puzzles.js; pass a puzzle into these functions.
 */

import { getCurrentPuzzle } from './puzzles.js';

/** @typedef {import('./puzzles.js').Puzzle} Puzzle */
/** @typedef {import('./puzzles.js').Group} Group */

/** @param {Group} group */
export function resultCellForGroup(group) {
  return group.resultCell || group.cells[group.cells.length - 1];
}

/** Compare two lists as unordered sets. */
export function sameCellSet(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/** @param {Puzzle} puzzle */
export function correctFillAnswers(puzzle) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const cell of puzzle.BOARD) {
    if (cell.type === 'fill' && cell.correct) out[cell.id] = cell.correct;
  }
  return out;
}

/** @param {Puzzle} puzzle @param {string} cellId */
export function groupIdForCell(puzzle, cellId) {
  const group = puzzle.GROUPS.find((g) => g.cells.includes(cellId));
  return group?.id ?? null;
}

/** @param {Puzzle} puzzle @param {string} groupId */
export function colorForGroup(puzzle, groupId) {
  return puzzle.GROUP_COLORS[groupId] ?? null;
}

/**
 * First three groups may be solved in any order; the theme combine is last.
 * Board geometry still gates groups that need a vacant path.
 * @param {Puzzle} puzzle
 * @param {string[]} solvedOrder
 */
export function isSequenceStillValid(puzzle, solvedOrder) {
  const boardIds = puzzle.GROUPS.map((g) => g.id);
  const seen = new Set();
  for (let i = 0; i < solvedOrder.length; i++) {
    const id = solvedOrder[i];
    if (id === puzzle.THEME_GROUP.id) {
      if (i !== solvedOrder.length - 1) return false;
      if (seen.size !== boardIds.length) return false;
      continue;
    }
    if (!boardIds.includes(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/**
 * If `selectedIds` matches an unsolved group, return that group.
 * Fill-in cells in the group must already have the correct answer.
 * After the three board groups are solved, three leftover result icons
 * matching the theme also count.
 *
 * @param {Puzzle} puzzle
 * @param {string[]} selectedIds
 * @param {string[]} solvedGroupIds
 * @param {Record<string, string>} fillAnswers
 * @param {Record<string, string | null>} [boardWords]
 */
export function matchGroup(puzzle, selectedIds, solvedGroupIds, fillAnswers, boardWords) {
  for (const group of puzzle.GROUPS) {
    if (solvedGroupIds.includes(group.id)) continue;
    if (!sameCellSet(selectedIds, group.cells)) continue;

    const cells = puzzle.BOARD.filter((c) => group.cells.includes(c.id));
    const fillsOk = cells.every((c) => {
      if (c.type !== 'fill') return true;
      return fillAnswers[c.id] === c.correct;
    });
    if (!fillsOk) continue;

    return group;
  }

  if (
    puzzle.GROUPS.every((g) => solvedGroupIds.includes(g.id)) &&
    !solvedGroupIds.includes(puzzle.THEME_GROUP.id) &&
    selectedIds.length === puzzle.COMBINE_SIZE &&
    boardWords
  ) {
    const words = selectedIds.map((id) => boardWords[id]).filter(Boolean);
    if (sameCellSet(words, puzzle.THEME.icons)) return puzzle.THEME_GROUP;
  }

  return null;
}

/** @param {Puzzle} puzzle */
export function fillCellIds(puzzle) {
  return puzzle.BOARD.filter((c) => c.type === 'fill').map((c) => c.id);
}

/** @param {Puzzle} puzzle */
export function linkGroupIds(puzzle) {
  return puzzle.GROUPS.filter((g) => g.kind === 'link').map((g) => g.id);
}

/** @param {Puzzle} puzzle */
export function rebusGroupIds(puzzle) {
  const ids = puzzle.GROUPS.filter((g) => g.kind === 'rebus').map((g) => g.id);
  if (puzzle.THEME_GROUP.kind === 'rebus') ids.push(puzzle.THEME_GROUP.id);
  return ids;
}

/**
 * In-game checklist totals.
 * Fill-ins increment only when the 3-icon group that includes that
 * fill-in is solved — picking an option alone does not count.
 * @param {Puzzle} puzzle
 * @param {string[]} solvedOrder
 */
export function solveProgress(puzzle, solvedOrder) {
  const solved = new Set(solvedOrder);
  const fills = fillCellIds(puzzle);
  const links = [
    ...linkGroupIds(puzzle),
    ...(puzzle.THEME_GROUP.kind === 'link' ? [puzzle.THEME_GROUP.id] : []),
  ];
  const rebuses = rebusGroupIds(puzzle);
  const fillDone = fills.filter((id) => {
    const group = puzzle.GROUPS.find((g) => g.cells.includes(id));
    return !!group && solved.has(group.id);
  }).length;
  const linkDone = links.filter((id) => solved.has(id)).length;
  const rebusDone = rebuses.filter((id) => solved.has(id)).length;
  return {
    fill: { done: fillDone, total: fills.length, label: 'Fill-ins' },
    rebus: { done: rebusDone, total: rebuses.length, label: 'Rebuses' },
    link: { done: linkDone, total: links.length, label: 'Links' },
  };
}

/** Icon words for a group, using correct fill-in answers. */
export function iconsForGroup(puzzle, group) {
  if (group.id === puzzle.THEME_GROUP.id) return [...puzzle.THEME.icons];
  return group.cells.map((id) => {
    const cell = puzzle.BOARD.find((c) => c.id === id);
    if (!cell) return '';
    if (cell.type === 'fixed') return cell.word;
    return cell.correct;
  });
}

/** Answer-key rows for the result page. */
export function answerKey(puzzle) {
  return [
    ...puzzle.GROUPS.map((g) => ({
      word: g.word,
      cells: [...g.cells],
      icons: iconsForGroup(puzzle, g),
    })),
    {
      word: puzzle.THEME.word,
      cells: /** @type {string[]} */ ([]),
      icons: [...puzzle.THEME.icons],
    },
  ];
}

/**
 * Bound helpers for the current weekly puzzle.
 * Prefer passing an explicit puzzle into the functions above.
 */
const current = getCurrentPuzzle();
export const BOARD = current.BOARD;
export const GROUPS = current.GROUPS;
export const THEME = current.THEME;
export const THEME_GROUP = current.THEME_GROUP;
export const COLLECTIBLE = current.COLLECTIBLE;
export const HINT_REVEAL_ORDER = current.HINT_REVEAL_ORDER;
export const GROUP_COLORS = current.GROUP_COLORS;
export const COMBINE_SIZE = current.COMBINE_SIZE;
export const MAX_HINTS = current.MAX_HINTS;
export const MAX_LIVES = current.MAX_LIVES;
export const TOTAL_MOVES = current.TOTAL_MOVES;
export const FILL_CELL_IDS = fillCellIds(current);
export const LINK_GROUP_IDS = linkGroupIds(current);
export const REBUS_GROUP_IDS = rebusGroupIds(current);
