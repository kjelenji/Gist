/**
 * solver.js — helpers for checking puzzle answers.
 * Board-specific data lives in puzzles.js; matching lives in puzzleBoard.js.
 *
 * Puzzle kinds:
 *   rebus  — icons combine into a phrase/word
 *   links  — related icons form a category
 *   fill   — blank tile; player picks from 3 options
 */
export { matchGroup, sameCellSet, isSequenceStillValid } from './puzzleBoard.js';
export { getCurrentPuzzle } from './puzzles.js';
