/**
 * Save / load the end-of-game result for the /result page.
 * Uses localStorage so the answer key + card survive refresh and
 * returning from the scoreboard in the same browser.
 */

const RESULT_KEY = 'gist_last_result';

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
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(result);
  try {
    localStorage.setItem(RESULT_KEY, payload);
  } catch {
    /* quota / private mode */
  }
  try {
    sessionStorage.setItem(RESULT_KEY, payload);
  } catch {
    /* ignore */
  }
}

export function loadResult() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RESULT_KEY) || localStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.answers)) parsed.answers = [];
    return parsed;
  } catch {
    return null;
  }
}

export function formatTime(seconds) {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}
