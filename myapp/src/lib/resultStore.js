/**
 * Save / load the end-of-game result for the /result page.
 * Weekly and archive results are stored separately so playing a past
 * board cannot replace this week's result (home Result button).
 */

import { weekKey } from './player.js';

const WEEK_RESULT_KEY = 'gist_week_result';
const ARCHIVE_RESULTS_KEY = 'gist_archive_results';
const LEGACY_KEY = 'gist_last_result';

function readJson(key) {
  if (typeof window === 'undefined') return null;
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* quota / private mode / bad JSON */
    }
  }
  return null;
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(value);
  try {
    localStorage.setItem(key, payload);
  } catch {
    /* quota / private mode */
  }
  try {
    sessionStorage.setItem(key, payload);
  } catch {
    /* ignore */
  }
}

function normalizeLoaded(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.answers)) parsed.answers = [];
  return parsed;
}

function saveArchiveResult(result) {
  const map = readJson(ARCHIVE_RESULTS_KEY) || {};
  map[result.puzzleId] = result;
  writeJson(ARCHIVE_RESULTS_KEY, map);
}

/**
 * @param {{
 *   won: boolean;
 *   elapsedSeconds: number;
 *   points?: number;
 *   username?: string;
 *   weekKey?: string;
 *   puzzleId?: string;
 *   archive?: boolean;
 *   scoreSaved?: boolean;
 *   answers: { word: string; cells: string[]; icons: string[] }[];
 *   fillAnswers?: Record<string, string>;
 *   collectible?: { number: string; word: string } | null;
 * }} result
 */
export function saveResult(result) {
  if (typeof window === 'undefined' || !result) return;
  if (result.archive && result.puzzleId) {
    saveArchiveResult(result);
    return;
  }
  writeJson(WEEK_RESULT_KEY, result);
}

/** This week's live puzzle result (never an archive play). */
export function loadWeekResult() {
  const currentWeek = weekKey();
  for (const parsed of [readJson(WEEK_RESULT_KEY), readJson(LEGACY_KEY)]) {
    const week = normalizeLoaded(parsed);
    if (!week || week.archive) continue;
    if (week.weekKey && week.weekKey !== currentWeek) continue;
    return week;
  }
  return null;
}

/** @param {string} puzzleId */
export function loadArchiveResult(puzzleId) {
  if (!puzzleId) return null;
  const map = readJson(ARCHIVE_RESULTS_KEY);
  if (map?.[puzzleId]) return normalizeLoaded(map[puzzleId]);
  const legacy = normalizeLoaded(readJson(LEGACY_KEY));
  if (legacy?.puzzleId === puzzleId && legacy.archive) return legacy;
  return null;
}

/** @deprecated prefer loadWeekResult / loadArchiveResult */
export function loadResult() {
  return loadWeekResult();
}

export function formatTime(seconds) {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}
