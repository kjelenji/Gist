/**
 * solver.js — helpers for checking puzzle answers.
 * Board-specific data lives in puzzleBoard.js.
 *
 * Puzzle kinds (for future boards):
 *   rebus  — icons combine into a phrase/word
 *   links  — related icons form a category
 *   fill   — blank tile; player picks from 3 options
 */
export { matchGroup, sameCellSet, isSequenceStillValid, THEME_GROUP } from './puzzleBoard.js';
