/**
 * Puzzle Board 4 — Fur / Ant / Ship
 *
 * Coordinate system (letter = column, number = row, row 1 at top):
 *   a1 b1 c1
 *   a2 b2 c2
 *   a3 b3 c3
 *
 * Visual board:
 *   mink           hip            she
 *   rabbit         [fill fox]     shh
 *   ant colony     [fill anthill] queen ant
 *
 * Groups (order inside each group does not matter):
 *   mink + rabbit + fox = fur                         → [a1,a2,b2]  result at b2
 *   anthill + ant colony + queen ant = ant            → [a3,b3,c3]  result at c3
 *   shh + she + hip = ship                            → [c2,c1,b1]  result at c2
 *
 * Theme (final combine on the leftover tiles):
 *   fur + ant + ship = friendship
 *
 * After a group is solved, two tiles clear and the result pops onto
 * that group's result cell. Combine until the board is empty (4 moves).
 */

/** @typedef {{ id: string; type: 'fixed'|'fill'; word?: string; options?: string[]; correct?: string }} Cell */
/** @typedef {{ id: string; word: string; kind: 'link'|'rebus'; cells: string[]; resultCell?: string }} Group */

/** @type {Cell[]} */
export const BOARD = [
  // row 1
  { id: 'a1', type: 'fixed', word: 'mink' },
  { id: 'b1', type: 'fixed', word: 'hip' },
  { id: 'c1', type: 'fixed', word: 'she' },
  // row 2
  { id: 'a2', type: 'fixed', word: 'rabbit' },
  {
    id: 'b2',
    type: 'fill',
    options: ['fox', 'lamb', 'goat'],
    correct: 'fox',
  },
  { id: 'c2', type: 'fixed', word: 'shh' },
  // row 3
  { id: 'a3', type: 'fixed', word: 'ant colony' },
  {
    id: 'b3',
    type: 'fill',
    options: ['anthill', 'owl home', 'nest'],
    correct: 'anthill',
  },
  { id: 'c3', type: 'fixed', word: 'queen ant' },
];

/** Answer groups — cell-id order is the results equation (matching is unordered). */
/** @type {Group[]} */
export const GROUPS = [
  { id: 'fur', word: 'fur', kind: 'link', cells: ['a1', 'a2', 'b2'], resultCell: 'b2' },
  { id: 'ant', word: 'ant', kind: 'link', cells: ['a3', 'b3', 'c3'], resultCell: 'c3' },
  { id: 'ship', word: 'ship', kind: 'rebus', cells: ['c2', 'c1', 'b1'], resultCell: 'c2' },
];

/** Final theme shown on results: fur + ant + ship = friendship */
export const THEME = {
  word: 'friendship',
  icons: ['fur', 'ant', 'ship'],
};

/** Fourth combine — leftover result tiles, matched by icon not cell id. */
export const THEME_GROUP = {
  id: 'friendship',
  word: 'friendship',
  kind: 'rebus',
  cells: /** @type {string[]} */ ([]),
};

/**
 * Hint reveal order (not board tiles).
 * Hint 1 → fur (link), Hint 2 → ant (link), Hint 3 → ship (rebus).
 */
export const HINT_REVEAL_ORDER = ['fur', 'ant', 'ship'];
export const MAX_HINTS = 3;
export const COMBINE_SIZE = 3;
/** Three board groups + the leftover theme combine. */
export const TOTAL_MOVES = GROUPS.length + 1;

/**
 * Post-attempt tint when ≥2 tiles in a failed swipe belong to one unsolved group.
 * rebus (ship) = dark, link 1 (fur) = medium, link 2 (ant) = light
 */
export const GROUP_COLORS = {
  ship: '#00008B',
  fur: '#0000CD',
  ant: '#ADD8E6',
  friendship: '#5e8fb6',
};

/** @param {string} cellId */
export function groupIdForCell(cellId) {
  const group = GROUPS.find((g) => g.cells.includes(cellId));
  return group?.id ?? null;
}

/** @param {string} groupId */
export function colorForGroup(groupId) {
  return GROUP_COLORS[groupId] ?? null;
}

/** @param {Group} group */
export function resultCellForGroup(group) {
  return group.resultCell || group.cells[group.cells.length - 1];
}

/**
 * First three groups may be solved in any order; the theme combine is last.
 * @param {string[]} solvedOrder
 */
export function isSequenceStillValid(solvedOrder) {
  const boardIds = GROUPS.map((g) => g.id);
  const seen = new Set();
  for (let i = 0; i < solvedOrder.length; i++) {
    const id = solvedOrder[i];
    if (id === THEME_GROUP.id) {
      if (i !== solvedOrder.length - 1) return false;
      if (seen.size !== boardIds.length) return false;
      continue;
    }
    if (!boardIds.includes(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export const COLLECTIBLE = {
  number: '004',
  word: 'friendship',
};

export const MAX_LIVES = 3;

/** Correct fill-in picks, keyed by cell id. */
export function correctFillAnswers() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const cell of BOARD) {
    if (cell.type === 'fill' && cell.correct) out[cell.id] = cell.correct;
  }
  return out;
}

/** Compare two cell-id lists as unordered sets. */
export function sameCellSet(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * If `selectedIds` matches an unsolved group, return that group.
 * Fill-in cells in the group must already have the correct answer.
 * After the three board groups are solved, three leftover result icons
 * matching the theme also count.
 *
 * @param {string[]} selectedIds
 * @param {string[]} solvedGroupIds
 * @param {Record<string, string>} fillAnswers
 * @param {Record<string, string | null>} [boardWords]
 */
export function matchGroup(selectedIds, solvedGroupIds, fillAnswers, boardWords) {
  for (const group of GROUPS) {
    if (solvedGroupIds.includes(group.id)) continue;
    if (!sameCellSet(selectedIds, group.cells)) continue;

    const cells = BOARD.filter((c) => group.cells.includes(c.id));
    const fillsOk = cells.every((c) => {
      if (c.type !== 'fill') return true;
      return fillAnswers[c.id] === c.correct;
    });
    if (!fillsOk) continue;

    return group;
  }

  if (
    GROUPS.every((g) => solvedGroupIds.includes(g.id)) &&
    !solvedGroupIds.includes(THEME_GROUP.id) &&
    selectedIds.length === COMBINE_SIZE &&
    boardWords
  ) {
    const words = selectedIds.map((id) => boardWords[id]).filter(Boolean);
    if (sameCellSet(words, THEME.icons)) return THEME_GROUP;
  }

  return null;
}

/** Fill-in cells — counted solved only after their group is combined. */
export const FILL_CELL_IDS = BOARD.filter((c) => c.type === 'fill').map((c) => c.id);
export const LINK_GROUP_IDS = GROUPS.filter((g) => g.kind === 'link').map((g) => g.id);
export const REBUS_GROUP_IDS = [
  ...GROUPS.filter((g) => g.kind === 'rebus').map((g) => g.id),
  THEME_GROUP.id,
];

/**
 * In-game checklist totals.
 * Fill-ins increment only when the 3-icon group that includes that
 * fill-in is solved — picking an option alone does not count.
 * @param {string[]} solvedOrder
 */
export function solveProgress(solvedOrder) {
  const solved = new Set(solvedOrder);
  const fillDone = FILL_CELL_IDS.filter((id) => {
    const group = GROUPS.find((g) => g.cells.includes(id));
    return !!group && solved.has(group.id);
  }).length;
  const linkDone = LINK_GROUP_IDS.filter((id) => solved.has(id)).length;
  const rebusDone = REBUS_GROUP_IDS.filter((id) => solved.has(id)).length;
  return {
    fill: { done: fillDone, total: FILL_CELL_IDS.length, label: 'Fill-ins' },
    rebus: { done: rebusDone, total: REBUS_GROUP_IDS.length, label: 'Rebuses' },
    link: { done: linkDone, total: LINK_GROUP_IDS.length, label: 'Links' },
  };
}

/** Icon words for a group, using correct fill-in answers. */
export function iconsForGroup(group) {
  if (group.id === THEME_GROUP.id) return [...THEME.icons];
  return group.cells.map((id) => {
    const cell = BOARD.find((c) => c.id === id);
    if (!cell) return '';
    if (cell.type === 'fixed') return cell.word;
    return cell.correct;
  });
}
