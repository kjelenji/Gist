<script lang="ts">
  /**
   * PUZZLE PAGE (/puzzle)
   *
   * - Fill-in tiles show 3 icons; tap one to select/deselect
   * - Swipe across 3 icons to combine them
   * - The result pops onto the board; clear every tile (4 combines)
   * - Board shows icons only (no words)
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import { iconLabel } from '$lib/icons.js';
  import {
    matchGroup,
    isSequenceStillValid,
    sameCellSet,
    colorForGroup,
    correctFillAnswers,
    resultCellForGroup,
    solveProgress,
    answerKey,
  } from '$lib/puzzleBoard.js';
  import {
    getPuzzle,
    getCurrentPuzzle,
    CURRENT_PUZZLE_ID,
  } from '$lib/puzzles.js';
  import {
    hasPlayedThisWeek,
    markPlayedThisWeek,
    markPlayedArchive,
    ensureUsername,
    computePoints,
    addLocalCollectible,
    weekKey,
    hasSeenHowTo,
    markHowToSeen,
  } from '$lib/player.js';
  import { saveResult } from '$lib/resultStore.js';
  import HowToPlay from '$lib/components/HowToPlay.svelte';
  import { tap } from '$lib/iosTap.js';
  import { playPop, unlockAudio } from '$lib/sounds.js';

  type Phase = 'playing' | 'finished';

  const requestedId = $derived(page.url.searchParams.get('id'));
  const archive = $derived(!!requestedId && requestedId !== CURRENT_PUZZLE_ID);
  const puzzle = $derived(requestedId ? getPuzzle(requestedId) : getCurrentPuzzle());

  const BOARD = $derived(puzzle?.BOARD ?? []);
  const GROUPS = $derived(puzzle?.GROUPS ?? []);
  const THEME = $derived(puzzle?.THEME ?? { word: '', icons: [] });
  const THEME_GROUP = $derived(puzzle?.THEME_GROUP ?? { id: '', word: '', kind: 'rebus', cells: [] });
  const COLLECTIBLE = $derived(puzzle?.COLLECTIBLE ?? { number: '', word: '' });
  const HINT_REVEAL_ORDER = $derived(puzzle?.HINT_REVEAL_ORDER ?? []);
  const MAX_LIVES = $derived(puzzle?.MAX_LIVES ?? 3);
  const MAX_HINTS = $derived(puzzle?.MAX_HINTS ?? 3);
  const TOTAL_MOVES = $derived(puzzle?.TOTAL_MOVES ?? 4);
  const COMBINE_SIZE = $derived(puzzle?.COMBINE_SIZE ?? 3);

  let phase = $state<Phase>('playing');
  let lives = $state(3);
  let selected = $state<string[]>([]);
  let solvedOrder = $state<string[]>([]);
  let fillAnswers = $state<Record<string, string>>({});
  /** Result icons that popped onto a cell after a combine. */
  let remnants = $state<Record<string, string>>({});
  /** Cells cleared by a combine (path-through). */
  let vacant = $state<string[]>([]);
  let poppingCell = $state<string | null>(null);
  let feedback = $state('');
  let gameStartMs = $state(0);
  let elapsedSeconds = $state(0);
  let blocked = $state(false);
  let showHowTo = $state(false);
  /** How many hints used (0–MAX_HINTS). */
  let hintsUsed = $state(0);
  /** Group ids that were already hinted when the player solved them. */
  let solvedWithHint = $state<string[]>([]);
  /**
   * After a failed 3-tile attempt: tint cells that were partly correct
   * for one unsolved group (post-submit clue only).
   */
  let attemptHint = $state<{ groupId: string; cellIds: string[] } | null>(null);

  /** Swipe tracking */
  let swiping = $state(false);
  let swipeMoved = false;
  let swipeStartId: string | null = null;
  /** Last cell under the finger (includes vacant tiles for pathing). */
  let swipeCursorId: string | null = null;
  let activePointerId: number | null = null;
  /** Fill-in wedge under the pointer when a tap starts. */
  let fillStartOption: string | null = null;
  /** Fill-in option currently pressed (mobile word tooltip). */
  let heldFill = $state<{ cellId: string; option: string } | null>(null);

  const hintedIds = $derived(HINT_REVEAL_ORDER.slice(0, hintsUsed));
  const hintsLeft = $derived(MAX_HINTS - hintsUsed);
  const movesLeft = $derived(Math.max(0, TOTAL_MOVES - solvedOrder.length));
  const peekHints = $derived(
    hintedIds.filter((id) => !solvedOrder.includes(id)).map((id) => ({
      id,
      word: GROUPS.find((g) => g.id === id)?.word ?? id,
    }))
  );
  const progress = $derived(puzzle ? solveProgress(puzzle, solvedOrder) : {
    fill: { done: 0, total: 0, label: 'Fill-ins' },
    rebus: { done: 0, total: 0, label: 'Rebuses' },
    link: { done: 0, total: 0, label: 'Links' },
  });
  const checklist = $derived([progress.fill, progress.rebus, progress.link]);

  function closeHowTo() {
    markHowToSeen();
    showHowTo = false;
  }

  function useHint() {
    if (phase !== 'playing' || hintsUsed >= MAX_HINTS) return;
    hintsUsed += 1;
    const id = HINT_REVEAL_ORDER[hintsUsed - 1];
    const group = GROUPS.find((g) => g.id === id);
    feedback = group?.kind === 'rebus' ? 'Rebus revealed' : 'Link revealed';
  }

  onMount(() => {
    if (!archive && hasPlayedThisWeek()) {
      blocked = true;
      goto('/result');
      return;
    }

    if (!hasSeenHowTo()) {
      showHowTo = true;
    }

    gameStartMs = Date.now();

    const onMove = (e: PointerEvent) => onBoardPointerMove(e);
    const onUp = (e: PointerEvent) => onBoardPointerUp(e);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  });

  $effect(() => {
    if (phase !== 'playing' || !gameStartMs) return;
    const id = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - gameStartMs) / 1000);
    }, 250);
    return () => clearInterval(id);
  });

  function cellById(id: string) {
    return BOARD.find((c) => c.id === id)!;
  }

  function displayWord(cellId: string): string | null {
    if (remnants[cellId]) return remnants[cellId];
    if (vacant.includes(cellId)) return null;
    const cell = cellById(cellId);
    if (cell.type === 'fixed') return cell.word ?? null;
    return fillAnswers[cellId] ?? null;
  }

  function currentBoardWords() {
    /** @type {Record<string, string | null>} */
    const out: Record<string, string | null> = {};
    for (const cell of BOARD) out[cell.id] = displayWord(cell.id);
    return out;
  }

  /** Cleared cells can be crossed while swiping; result tiles stay in play. */
  function isVacant(cellId: string) {
    return vacant.includes(cellId) && !remnants[cellId];
  }

  function isFillChoice(cellId: string) {
    const cell = cellById(cellId);
    return cell.type === 'fill' && !isVacant(cellId) && !remnants[cellId];
  }

  /** True if this cell counts toward a soft clue (fill-ins must be the correct icon). */
  function countsForSoftClue(cellId: string) {
    if (remnants[cellId]) return true;
    const cell = cellById(cellId);
    if (cell.type === 'fill') return fillAnswers[cellId] === cell.correct;
    return true;
  }

  /** After submit: which unsolved group has the most overlap with the attempt (need ≥2). */
  function findPartialAttemptHint(selection: string[]) {
    let best: { groupId: string; cellIds: string[] } | null = null;
    for (const group of GROUPS) {
      if (solvedOrder.includes(group.id)) continue;
      const overlap = selection.filter(
        (id) => group.cells.includes(id) && countsForSoftClue(id)
      );
      if (overlap.length < 2) continue;
      if (!best || overlap.length > best.cellIds.length) {
        best = { groupId: group.id, cellIds: overlap };
      }
    }
    if (
      GROUPS.every((g) => solvedOrder.includes(g.id)) &&
      !solvedOrder.includes(THEME_GROUP.id)
    ) {
      const words = currentBoardWords();
      const overlap = selection.filter((id) => {
        const word = words[id];
        return !!word && THEME.icons.includes(word);
      });
      if (overlap.length >= 2 && (!best || overlap.length > best.cellIds.length)) {
        best = { groupId: THEME_GROUP.id, cellIds: overlap };
      }
    }
    return best;
  }

  function clearAttemptHint() {
    attemptHint = null;
  }

  function tileIdFromPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const tile = el?.closest?.('[data-cell-id]') as HTMLElement | null;
    return tile?.dataset?.cellId ?? null;
  }

  /** Column/row for cell ids like "a1" (col 0–2, row 0–2). */
  function cellCoords(id: string) {
    return {
      col: id.charCodeAt(0) - 97,
      row: Number(id[1]) - 1,
    };
  }

  /** True if two cells share an edge (no diagonals). Corners/edges of the board are fine. */
  function isOrthogonalNeighbors(a: string, b: string) {
    const A = cellCoords(a);
    const B = cellCoords(b);
    return Math.abs(A.col - B.col) + Math.abs(A.row - B.row) === 1;
  }

  /** Vacant tiles are empty for combining but can be crossed while swiping. */
  function canPathThrough(cellId: string) {
    return isVacant(cellId);
  }

  /**
   * Can we walk from → to using only orthogonal steps, optionally through solved tiles?
   * Blocks diagonal jumps even if the finger skips across a corner.
   */
  function canReachOrthogonally(fromId: string, toId: string) {
    if (fromId === toId) return true;
    if (isOrthogonalNeighbors(fromId, toId)) return true;

    const queue = [fromId];
    const seen = new Set([fromId]);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const cell of BOARD) {
        const id = cell.id;
        if (seen.has(id) || !isOrthogonalNeighbors(cur, id)) continue;
        if (id === toId) return true;
        if (!canPathThrough(id)) continue;
        seen.add(id);
        queue.push(id);
      }
    }
    return false;
  }

  function isOrthogonalSelection(path: string[]) {
    for (let i = 1; i < path.length; i++) {
      if (!canReachOrthogonally(path[i - 1], path[i])) return false;
    }
    return true;
  }

  function tryAddToSwipe(cellId: string) {
    if (!cellId || isVacant(cellId)) return;
    if (!displayWord(cellId)) return;

    const existing = selected.indexOf(cellId);
    if (existing !== -1) {
      // Swipe back onto an earlier tile → drop everything after it
      if (existing < selected.length - 1) {
        selected = selected.slice(0, existing + 1);
      }
      return;
    }

    if (selected.length >= COMBINE_SIZE) return;

    // Must be edge-adjacent to the last selected tile (or via vacant path-through).
    const last = selected[selected.length - 1];
    if (last && !canReachOrthogonally(last, cellId)) return;

    selected = [...selected, cellId];
  }

  function fillOptionFromTarget(target: EventTarget | null) {
    const el = (target as HTMLElement | null)?.closest?.('[data-fill-option]') as HTMLElement | null;
    return el?.dataset?.fillOption ?? null;
  }

  /** Which fill-in option sits under a point on a Y-split tile. */
  function fillOptionAtPoint(cellId: string, clientX: number, clientY: number) {
    const cell = cellById(cellId);
    const options = cell.options ?? [];
    if (cell.type !== 'fill' || options.length < 3) return null;
    const el = document.querySelector(`[data-cell-id="${cellId}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const px = (clientX - r.left) / r.width;
    const py = (clientY - r.top) / r.height;
    if (px < 0 || px > 1 || py < 0 || py > 1) return null;
    if (py <= px && py <= 1 - px) return options[0];
    return px < 0.5 ? options[1] : options[2];
  }

  function toggleFill(cellId: string, option: string) {
    const current = fillAnswers[cellId];
    if (current === option) {
      const next = { ...fillAnswers };
      delete next[cellId];
      fillAnswers = next;
      selected = selected.filter((id) => id !== cellId);
    } else {
      fillAnswers = { ...fillAnswers, [cellId]: option };
    }
    feedback = '';
  }

  function onTilePointerDown(event: PointerEvent, cellId: string) {
    if (phase !== 'playing' || isVacant(cellId)) return;
    clearAttemptHint();
    unlockAudio();

    swiping = true;
    swipeMoved = false;
    swipeStartId = cellId;
    swipeCursorId = cellId;
    activePointerId = event.pointerId;
    fillStartOption =
      isFillChoice(cellId) ? fillOptionAtPoint(cellId, event.clientX, event.clientY) : null;
    heldFill =
      isFillChoice(cellId) && fillStartOption
        ? { cellId, option: fillStartOption }
        : null;
    feedback = '';
    event.preventDefault();

    // Fill-in: tap a wedge to pick. Don't start a swipe path until
    // the pointer actually moves onto another tile.
    if (isFillChoice(cellId)) {
      selected = [];
      return;
    }

    if (!displayWord(cellId)) {
      endSwipeTracking();
      feedback = 'Fill this tile first.';
      return;
    }

    selected = [cellId];
  }

  function onBoardPointerMove(event: PointerEvent) {
    if (!swiping || event.pointerId !== activePointerId) return;

    const id = tileIdFromPoint(event.clientX, event.clientY);
    if (!id) return;

    if (id !== swipeStartId) {
      swipeMoved = true;
      heldFill = null;
    } else if (isFillChoice(id) && !swipeMoved) {
      const option = fillOptionAtPoint(id, event.clientX, event.clientY);
      heldFill = option ? { cellId: id, option } : null;
    }
    if (id === swipeCursorId) return;

    // Only step to an edge-neighbor of the current cursor (no diagonals / corner cuts)
    if (swipeCursorId && !isOrthogonalNeighbors(swipeCursorId, id)) return;

    // Started on a filled fill-in: begin the swipe once we leave that tile
    if (
      selected.length === 0 &&
      swipeStartId &&
      id !== swipeStartId &&
      displayWord(swipeStartId) &&
      isFillChoice(swipeStartId)
    ) {
      selected = [swipeStartId];
    }

    // Also block selecting a tile that would make the chosen path diagonal
    if (
      selected.length > 0 &&
      !canPathThrough(id) &&
      !canReachOrthogonally(selected[selected.length - 1], id)
    ) {
      return;
    }

    swipeCursorId = id;

    // Cross vacant tiles without selecting them
    if (canPathThrough(id)) return;

    // Don't path through unfilled fill-ins
    if (!displayWord(id)) return;

    tryAddToSwipe(id);
  }

  function endSwipeTracking() {
    swiping = false;
    swipeMoved = false;
    swipeStartId = null;
    swipeCursorId = null;
    activePointerId = null;
    fillStartOption = null;
    heldFill = null;
  }

  function onBoardPointerUp(event: PointerEvent) {
    if (!swiping) return;
    // iOS can recycle pointer ids / cancel mid-gesture — still finish the swipe.
    if (
      activePointerId != null &&
      event.pointerId !== activePointerId &&
      event.type !== 'pointercancel'
    ) {
      return;
    }

    const startId = swipeStartId;
    const moved = swipeMoved;
    const path = [...selected];
    const startOption = fillStartOption;

    endSwipeTracking();

    // Click/tap a fill-in wedge (didn't swipe onto other tiles) → toggle that icon.
    if (startId && path.length <= 1) {
      if (isFillChoice(startId)) {
        const option =
          startOption ||
          fillOptionAtPoint(startId, event.clientX, event.clientY) ||
          fillOptionFromTarget(event.target);
        if (option) toggleFill(startId, option);
        return;
      }
    }

    if (path.length === COMBINE_SIZE && isOrthogonalSelection(path)) {
      selected = path;
      checkSelection();
    } else {
      // Fewer than 3, or a diagonal/disconnected path — clear quietly
      selected = [];
      if (moved && path.length > 0) feedback = '';
    }
  }

  function applyCombine(group: (typeof GROUPS)[number] | typeof THEME_GROUP, attempt: string[]) {
    if (group.id === THEME_GROUP.id) {
      const nextVacant = [...vacant];
      const nextRemnants = { ...remnants };
      for (const id of attempt) {
        delete nextRemnants[id];
        if (!nextVacant.includes(id)) nextVacant.push(id);
      }
      remnants = nextRemnants;
      vacant = nextVacant;
      poppingCell = null;
      playPop('clear');
      return;
    }

    const landing = resultCellForGroup(group);
    const nextVacant = vacant.filter((id) => !group.cells.includes(id));
    const nextRemnants = { ...remnants };
    for (const id of group.cells) {
      delete nextRemnants[id];
      if (id === landing) continue;
      nextVacant.push(id);
    }
    nextRemnants[landing] = group.word;
    remnants = nextRemnants;
    vacant = nextVacant;
    poppingCell = landing;
    playPop('result');
    setTimeout(() => {
      if (poppingCell === landing) poppingCell = null;
    }, 520);
  }

  function checkSelection() {
    const attempt = [...selected];
    if (!puzzle) return;
    const group = matchGroup(puzzle, attempt, solvedOrder, fillAnswers, currentBoardWords());

    if (!group) {
      const maybe = GROUPS.find(
        (g) => !solvedOrder.includes(g.id) && sameCellSet(attempt, g.cells)
      );
      lives -= 1;
      // Post-submit clue: tint the tiles that were partly right for a group
      attemptHint = findPartialAttemptHint(attempt);
      feedback = maybe
        ? 'Check your fill-ins.'
        : attemptHint
          ? 'Close — those tiles share a link or rebus.'
          : 'Not a match.';
      selected = [];
      if (lives <= 0) endGame(false);
      return;
    }

    const nextOrder = [...solvedOrder, group.id];
    if (!isSequenceStillValid(puzzle, nextOrder)) {
      lives -= 1;
      attemptHint = findPartialAttemptHint(attempt);
      feedback = attemptHint
        ? 'Close — those tiles share a link or rebus.'
        : 'Not a match.';
      selected = [];
      if (lives <= 0) endGame(false);
      return;
    }

    clearAttemptHint();

    if (hintedIds.includes(group.id) && !solvedWithHint.includes(group.id)) {
      solvedWithHint = [...solvedWithHint, group.id];
    }

    applyCombine(group, attempt);
    solvedOrder = nextOrder;
    selected = [];
    feedback = group.id === THEME_GROUP.id ? 'Board clear!' : 'Nice!';

    if (solvedOrder.length === TOTAL_MOVES) {
      setTimeout(() => endGame(true), 650);
    }
  }

  async function endGame(won: boolean) {
    if (phase === 'finished' || !puzzle) return;
    phase = 'finished';
    const elapsed = Math.floor((Date.now() - gameStartMs) / 1000);
    elapsedSeconds = elapsed;

    let username = ensureUsername();
    const livesLost = Math.max(0, MAX_LIVES - lives);
    const points = computePoints({
      solvedGroupIds: solvedOrder,
      hintedGroupIds: solvedWithHint,
      livesLost,
    });
    const collectible = won ? COLLECTIBLE : null;
    const week = weekKey();
    const answers = answerKey(puzzle);
    const fills = correctFillAnswers(puzzle);

    if (archive) {
      markPlayedArchive(puzzle.id, { won });
    } else {
      markPlayedThisWeek();
    }
    if (collectible) addLocalCollectible(collectible);

    // Save result first so /result always has the card + answer key,
    // even if the scoreboard request is slow or fails.
    saveResult({
      won,
      elapsedSeconds: elapsed,
      points,
      username,
      weekKey: week,
      puzzleId: puzzle.id,
      archive,
      scoreSaved: archive ? true : false,
      answers,
      fillAnswers: fills,
      collectible,
    });

    goto(archive ? `/result?id=${encodeURIComponent(puzzle.id)}` : '/result');

    if (archive) return;

    // Persist points + collectible to Supabase in the background.
    try {
      const res = await fetch('/api/scoreboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, points, weekKey: week, collectible }),
      });
      if (res.ok) {
        saveResult({
          won,
          elapsedSeconds: elapsed,
          points,
          username,
          weekKey: week,
          puzzleId: puzzle.id,
          archive: false,
          scoreSaved: true,
          answers,
          fillAnswers: fills,
          collectible,
        });
      }
    } catch (err) {
      console.warn('Score save failed', err);
    }
  }
</script>

{#if blocked}
  <main class="page page-center">
    <p class="feedback muted">Redirecting…</p>
  </main>
{:else if !puzzle}
  <main class="page page-center">
    <div class="puzzle-container">
      <p class="feedback">That puzzle is not in the archive.</p>
      <div class="actions">
        <button type="button" class="btn-secondary" {...tap(() => goto('/archive'))}>Archive</button>
        <button type="button" class="btn-secondary" {...tap(() => goto('/'))}>Home</button>
      </div>
    </div>
  </main>
{:else}
<main class="page">
  <div class="puzzle-container">
    <header class="header">
      <div class="title-row">
        <h1>{archive ? 'archive' : 'gist'}</h1>
        <button
          type="button"
          class="help-btn"
          aria-label="How to play"
          {...tap(() => {
            showHowTo = true;
          })}
        >ⓘ</button>
      </div>
    </header>

    <div class="stats-row" aria-label="Puzzle status">
      <p class="stat-moves">
        <span class="stat-num">{movesLeft}</span>
        <span class="stat-label">{movesLeft === 1 ? 'move' : 'moves'}</span>
      </p>
      <p class="stat-combine">Combine {COMBINE_SIZE}</p>
    </div>

    <div class="hint-row">
      <div class="lives-row" aria-label="Lives remaining">
        {#each Array(MAX_LIVES) as _, i}
          <span class="life" class:lost={i >= lives} aria-hidden="true">♥</span>
        {/each}
      </div>
      <div class="hint-cluster">
        {#if peekHints.length}
          <div class="hint-peeks" aria-label="Revealed hints">
            {#each peekHints as peek}
              <span class="hint-peek">
                <Icon word={peek.word} size={28} label={false} />
              </span>
            {/each}
          </div>
        {/if}
        <button
          type="button"
          class="hint-btn"
          disabled={phase !== 'playing' || hintsLeft <= 0}
          aria-label={hintsLeft > 0 ? `Use hint, ${hintsLeft} left` : 'No hints left'}
          {...(phase === 'playing' && hintsLeft > 0 ? tap(useHint) : {})}
        >
          <span class="hint-label">Hint</span>
          <span class="hint-dots" aria-hidden="true">
            {#each Array(MAX_HINTS) as _, i}
              <span class="hint-dot" class:used={i < hintsUsed}></span>
            {/each}
          </span>
        </button>
      </div>
    </div>

    <ul class="checklist" aria-label="Pieces solved">
      {#each checklist as item}
        {@const complete = item.done >= item.total && item.total > 0}
        <li
          class="check-item"
          class:complete
          aria-label={`${item.label} ${item.done} of ${item.total}${complete ? ', complete' : ''}`}
        >
          <span class="check-mark" aria-hidden="true">{complete ? '✓' : ''}</span>
          {item.label}: {item.done}/{item.total}
        </li>
      {/each}
    </ul>

    <!-- 3×3 board — icons only -->
    <div
      class="board"
      class:swiping
      class:dragging={swiping && swipeMoved}
      role="grid"
      aria-label="Puzzle board"
    >
      {#each BOARD as cell}
        {@const word = displayWord(cell.id)}
        {@const fillChoice = isFillChoice(cell.id)}
        {@const isFill = cell.type === 'fill'}
        {@const isSelected = selected.includes(cell.id)}
        {@const vacantTile = isVacant(cell.id)}
        {@const popping = poppingCell === cell.id}
        {@const inAttemptHint = !!attemptHint?.cellIds.includes(cell.id)}
        {@const attemptTint =
          inAttemptHint && attemptHint && puzzle
            ? colorForGroup(puzzle, attemptHint.groupId)
            : ''}
        {@const selectIndex = selected.indexOf(cell.id)}
        <div
          class="tile"
          class:selected={isSelected}
          class:vacant={vacantTile}
          class:popping
          class:empty-fill={!word && isFill && fillChoice}
          class:filled-fill={!!word && isFill && fillChoice}
          class:fill-choice={fillChoice}
          class:has-pick={fillChoice && !!word}
          class:attempt-hint={inAttemptHint}
          style={attemptTint ? `--group-tint: ${attemptTint}` : ''}
          data-cell-id={cell.id}
          role="gridcell"
          aria-label={
            word
              ? word
              : vacantTile
                ? 'Empty tile'
                : fillChoice
                  ? `Fill-in, choose ${cell.options?.join(', ') ?? 'an icon'}`
                  : `Empty ${cell.id}`
          }
          onpointerdown={(e) => onTilePointerDown(e, cell.id)}
        >
          {#if isSelected}
            <span class="swipe-order">{selectIndex + 1}</span>
          {/if}
          {#if fillChoice}
            <div class="fill-split">
              {#each cell.options ?? [] as option, i}
                <span
                  class="fill-wedge"
                  class:wedge-0={i === 0}
                  class:wedge-1={i === 1}
                  class:wedge-2={i === 2}
                  class:picked={word === option}
                  class:show-tip={heldFill?.cellId === cell.id && heldFill?.option === option}
                  data-fill-option={option}
                >
                  <span class="fill-body">
                    <span class="fill-chip">
                      <Icon word={option} size={44} label={false} tip={false} />
                    </span>
                  </span>
                  <span class="fill-tip">{iconLabel(option)}</span>
                </span>
              {/each}
              <svg class="fill-lines" viewBox="0 0 100 100" aria-hidden="true">
                <line x1="50" y1="50" x2="0" y2="0" />
                <line x1="50" y1="50" x2="100" y2="0" />
                <line x1="50" y1="50" x2="50" y2="100" />
              </svg>
            </div>
          {:else if word}
            <Icon {word} size={64} label={false} tint={attemptTint || ''} />
          {:else}
            <span class="blank-frame" aria-hidden="true"></span>
          {/if}
        </div>
      {/each}
    </div>

    {#if feedback}
      <p class="feedback">{feedback}</p>
    {:else}
      <p class="feedback muted">&nbsp;</p>
    {/if}

    <div class="actions">
      <button
        type="button"
        class="btn-secondary"
        disabled={selected.length === 0 && !attemptHint}
        {...(selected.length === 0 && !attemptHint
          ? {}
          : tap(() => {
              selected = [];
              clearAttemptHint();
              feedback = '';
            }))}
      >Clear</button>
      <button type="button" class="btn-secondary" {...tap(() => goto(archive ? '/archive' : '/'))}>
        {archive ? 'Archive' : 'Home'}
      </button>
    </div>
  </div>

  {#if showHowTo}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-backdrop howto-backdrop"
      role="presentation"
      {...tap(() => {
        closeHowTo();
      })}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="modal howto-modal"
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        ontouchend={(e) => e.stopPropagation()}
      >
        <HowToPlay onClose={closeHowTo} />
      </div>
    </div>
  {/if}
</main>
{/if}

<style>
  .puzzle-container {
    max-width: 480px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 3.4rem 1rem 0;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .header h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: var(--gist-text);
  }

  .help-btn {
    background: var(--gist-bg);
    color: var(--gist-icon-btn-fg);
    border: 1px solid var(--gist-border);
    border-radius: 10px;
    font-size: 1.35rem;
    line-height: 1;
    min-width: 3rem;
    min-height: 3rem;
    cursor: pointer;
  }

  @media (hover: hover) and (pointer: fine) {
    .help-btn:hover {
      background: var(--gist-icon-btn-hover);
    }
  }

  .stats-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0 0 0.85rem;
    padding: 0 0.1rem;
  }

  .stat-moves,
  .stat-combine {
    margin: 0;
    color: var(--gist-text-muted);
    font-weight: 650;
    letter-spacing: 0.02em;
  }

  .stat-num {
    display: inline-block;
    color: var(--gist-text);
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1;
    border-bottom: 2px solid var(--gist-text);
    padding: 0 0.05rem 0.05rem;
    margin-right: 0.35rem;
  }

  .stat-label,
  .stat-combine {
    font-size: 1.05rem;
  }

  .hint-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0 0 0.65rem;
  }

  .hint-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hint-peeks {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .hint-peek {
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
    border: 1.5px dashed var(--gist-border-strong);
    background: var(--gist-surface-alt);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  .hint-peek:hover {
    z-index: 4;
  }

  .checklist {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.35rem 1.15rem;
    list-style: none;
    margin: 0 0 0.75rem;
    padding: 0.15rem 0.1rem 0;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.82rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    color: var(--gist-text-muted);
    white-space: nowrap;
  }

  .check-item.complete {
    color: var(--gist-text);
  }

  .check-mark {
    width: 1.05rem;
    height: 1.05rem;
    border: 1.5px solid var(--gist-border-strong);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1;
    flex-shrink: 0;
    background: var(--gist-surface);
  }

  .check-item.complete .check-mark {
    background: var(--gist-primary);
    border-color: var(--gist-primary);
    color: var(--gist-on-primary);
  }

  .lives-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 2.5rem;
  }

  .life {
    color: #c45b5b;
    font-size: 1.85rem;
    line-height: 1;
  }

  .life.lost {
    opacity: 0.22;
  }

  .hint-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    flex-shrink: 0;
    min-height: 52px;
    padding: 0.55rem 1.1rem;
    border-radius: 999px;
    border: 2px solid var(--gist-border-strong);
    background: var(--gist-surface);
    color: var(--gist-text);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
  }

  @media (hover: hover) and (pointer: fine) {
    .hint-btn:hover:not(:disabled) {
      background: var(--gist-bg);
    }
  }

  .hint-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .hint-dots {
    display: inline-flex;
    gap: 0.35rem;
  }

  .hint-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    border: 2px solid var(--gist-primary);
    background: transparent;
  }

  .hint-dot.used {
    background: var(--gist-primary);
  }

  .board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin: 0 auto 0.5rem;
    touch-action: none;
    user-select: none;
  }

  .board.swiping {
    cursor: grabbing;
  }

  .tile {
    aspect-ratio: 1;
    border: 1.5px solid var(--gist-tile-border);
    border-radius: 12px;
    background: var(--gist-tile);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
    position: relative;
    touch-action: none;
    transition: box-shadow 0.12s ease, background 0.12s ease, opacity 0.12s ease;
  }

  .tile:hover,
  .tile:active {
    z-index: 3;
  }

  .board.dragging :global(.tip-bubble),
  .board.dragging .fill-tip {
    opacity: 0 !important;
    visibility: hidden !important;
  }

  .tile.empty-fill,
  .tile.filled-fill {
    cursor: pointer;
  }

  .tile.empty-fill {
    background: var(--gist-tile-muted);
    border-style: dashed;
    border-color: var(--gist-muted-line);
  }

  .blank-frame {
    width: 42%;
    height: 42%;
    border: 1.5px dashed var(--gist-muted-line);
    border-radius: 4px;
  }

  .tile.fill-choice {
    padding: 0;
    overflow: hidden;
    background: var(--gist-tile);
    border-style: solid;
    border-color: var(--gist-tile-border);
  }

  .fill-split {
    position: absolute;
    inset: 0;
  }

  .fill-wedge {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .fill-body {
    position: absolute;
    inset: 0;
    display: flex;
    pointer-events: auto;
  }

  .fill-wedge.wedge-0 .fill-body {
    clip-path: polygon(0 0, 100% 0, 50% 50%);
    align-items: flex-start;
    justify-content: center;
    padding-top: 3%;
  }

  .fill-wedge.wedge-0 .fill-chip {
    transform: translateY(-6%);
  }

  .fill-wedge.wedge-1 .fill-body {
    clip-path: polygon(0 0, 50% 50%, 50% 100%, 0 100%);
    align-items: center;
    justify-content: flex-start;
    padding-left: 4%;
    padding-top: 16%;
  }

  .fill-wedge.wedge-1 .fill-chip {
    transform: translateX(-10%);
  }

  .fill-wedge.wedge-2 .fill-body {
    clip-path: polygon(100% 0, 100% 100%, 50% 100%, 50% 50%);
    align-items: center;
    justify-content: flex-end;
    padding-right: 4%;
    padding-top: 16%;
  }

  .fill-wedge.wedge-2 .fill-chip {
    transform: translateX(10%);
  }

  .fill-chip {
    width: 49%;
    max-width: 62px;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .fill-chip :global(.icon),
  .fill-chip :global(.art),
  .fill-chip :global(.emoji) {
    width: 100%;
    height: 100%;
  }

  .fill-wedge.picked .fill-body {
    background: var(--gist-fill-pick);
  }

  .tile.has-pick .fill-wedge:not(.picked) {
    opacity: 0.42;
  }

  .fill-tip {
    position: absolute;
    z-index: 5;
    background: var(--gist-ink);
    color: var(--gist-on-ink);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: lowercase;
    line-height: 1.2;
    white-space: nowrap;
    padding: 0.16rem 0.4rem;
    border-radius: 6px;
    box-shadow: 0 2px 10px var(--gist-shadow);
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.12s ease, visibility 0.12s ease;
  }

  .fill-wedge.wedge-0 .fill-tip {
    top: 5px;
    left: 50%;
    transform: translateX(-50%);
  }

  .fill-wedge.wedge-1 .fill-tip {
    left: 5px;
    top: 54%;
  }

  .fill-wedge.wedge-2 .fill-tip {
    right: 5px;
    top: 54%;
  }

  .fill-wedge.show-tip,
  .fill-wedge:active {
    z-index: 4;
    opacity: 1;
  }

  .fill-wedge.show-tip .fill-tip,
  .fill-wedge:active .fill-tip {
    opacity: 1;
    visibility: visible;
  }

  @media (hover: hover) and (pointer: fine) {
    .fill-wedge:hover {
      z-index: 4;
      opacity: 1;
    }

    .fill-wedge:hover .fill-tip {
      opacity: 1;
      visibility: visible;
    }
  }

  .fill-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    z-index: 1;
  }

  .fill-lines line {
    stroke: var(--gist-tile-border);
    stroke-width: 1;
    stroke-linecap: square;
  }

  .tile.selected {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--gist-ink) 20%, transparent);
    background: var(--gist-tile-selected);
  }

  .swipe-order {
    position: absolute;
    top: 0.35rem;
    right: 0.4rem;
    z-index: 2;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 50%;
    background: var(--gist-ink);
    color: var(--gist-on-ink);
    font-size: 0.7rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tile.vacant {
    background: var(--gist-tile-muted);
    border-style: dashed;
    border-color: var(--gist-muted-line);
    opacity: 0.55;
  }

  .tile.popping :global(.icon) {
    animation: tile-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  @keyframes tile-pop {
    0% {
      transform: scale(0.2);
      opacity: 0;
    }
    70% {
      transform: scale(1.12);
      opacity: 1;
    }
    100% {
      transform: scale(1);
    }
  }

  .tile.attempt-hint {
    border-color: var(--group-tint, var(--gist-tile-border));
    background: color-mix(in srgb, var(--group-tint, var(--gist-tile)) 18%, var(--gist-tile));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--group-tint, transparent) 40%, var(--gist-tile));
  }

  .feedback {
    text-align: center;
    font-weight: 650;
    color: var(--gist-primary-dark);
    min-height: 1.4em;
    margin: 0 0 0.75rem;
  }

  .feedback.muted {
    opacity: 0;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--gist-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 50;
  }

  .howto-backdrop {
    align-items: flex-start;
    overflow-y: auto;
    padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
    z-index: 60;
  }

  .modal {
    background: var(--gist-surface);
    border-radius: 16px;
    padding: 1.5rem;
    width: min(400px, 100%);
    text-align: center;
    box-shadow: 0 12px 40px var(--gist-shadow);
  }

  .howto-modal {
    width: min(480px, 100%);
    text-align: left;
    margin: 1rem 0;
    padding: 1.25rem 1.25rem 1.5rem;
  }

  .modal h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: var(--gist-text);
  }

  @media (max-width: 420px) {
    .header h1 {
      font-size: 1.4rem;
    }
  }
</style>
