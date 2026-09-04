/**
 * 3×3 board geometry. Moves are orthogonal only — tiles must share an edge.
 *
 *   a1 b1 c1
 *   a2 b2 c2
 *   a3 b3 c3
 */

export const COLS = ['a', 'b', 'c'];
export const ROWS = ['1', '2', '3'];

/** Row-major cell ids (a1, b1, c1, a2, …). */
export const CELL_IDS = ROWS.flatMap((row) => COLS.map((col) => `${col}${row}`));

/** @param {string} id */
export function cellCoords(id) {
  return {
    col: id.charCodeAt(0) - 97,
    row: Number(id[1]) - 1,
  };
}

/** True if two cells share an edge (no diagonals, no skips). */
export function isOrthogonalNeighbors(a, b) {
  const A = cellCoords(a);
  const B = cellCoords(b);
  return Math.abs(A.col - B.col) + Math.abs(A.row - B.row) === 1;
}

/**
 * Walk from → to using only shared edges.
 * `walkable` cells can be crossed (empty tiles after a combine).
 */
export function canReachOrthogonally(fromId, toId, boardIds = CELL_IDS, walkable = []) {
  if (!fromId || !toId) return false;
  if (fromId === toId) return true;
  if (isOrthogonalNeighbors(fromId, toId)) return true;

  const walk = new Set(walkable);
  const queue = [fromId];
  const seen = new Set([fromId]);

  while (queue.length) {
    const cur = queue.shift();
    for (const id of boardIds) {
      if (seen.has(id) || !isOrthogonalNeighbors(cur, id)) continue;
      if (id === toId) return true;
      if (!walk.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  return false;
}

/** Consecutive tiles in `path` are each reachable without a diagonal. */
export function isOrthogonalSelection(path, boardIds = CELL_IDS, walkable = []) {
  for (let i = 1; i < path.length; i++) {
    if (!canReachOrthogonally(path[i - 1], path[i], boardIds, walkable)) return false;
  }
  return true;
}

/**
 * The cell set is one rook-connected blob (through its own cells + empties).
 * Used to reject diagonal combines even if the icon words would match.
 */
export function cellsOrthogonallyConnected(cellIds, boardIds = CELL_IDS, vacantIds = []) {
  if (cellIds.length <= 1) return true;
  const walkable = new Set([...cellIds, ...vacantIds]);
  const start = cellIds[0];
  const seen = new Set([start]);
  const queue = [start];

  while (queue.length) {
    const cur = queue.shift();
    for (const id of boardIds) {
      if (seen.has(id) || !walkable.has(id) || !isOrthogonalNeighbors(cur, id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  return cellIds.every((id) => seen.has(id));
}
