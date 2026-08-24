/**
 * player.js — browser identity + weekly play lock (localStorage).
 * Server also enforces one play per username per week.
 */

const USERNAME_KEY = 'gist_username';
const HISTORY_KEY = 'gist_history';
const COLLECTIBLES_KEY = 'gist_collectibles';
const HOWTO_SEEN_KEY = 'gist_howto_seen_v2';

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** Monday (local) of the current week as "YYYY-MM-DD". */
export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

export function getUsername() {
  if (!hasStorage()) return '';
  return window.localStorage.getItem(USERNAME_KEY) || '';
}

/** Save username (overwrites). */
export function setUsername(name) {
  if (!hasStorage()) return '';
  const trimmed = (name || '').trim().slice(0, 20);
  if (!trimmed) return '';
  window.localStorage.setItem(USERNAME_KEY, trimmed);
  return trimmed;
}

/** Random display name like "Gist_a7k2". */
export function generateUsername() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `Gist_${suffix}`;
}

/** Ensure a username exists; create a random one if needed. */
export function ensureUsername() {
  const existing = getUsername();
  if (existing) return existing;
  return setUsername(generateUsername());
}

function getHistory() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** True if this browser already finished this week's puzzle. */
export function hasPlayedThisWeek() {
  const week = weekKey();
  return getHistory().some((entry) => entry.weekKey === week || entry.date === week);
}

/** True if the player has already seen the how-to instructions. */
export function hasSeenHowTo() {
  if (!hasStorage()) return false;
  return window.localStorage.getItem(HOWTO_SEEN_KEY) === '1';
}

/** Mark how-to instructions as seen (first-visit popup won't show again). */
export function markHowToSeen() {
  if (!hasStorage()) return;
  window.localStorage.setItem(HOWTO_SEEN_KEY, '1');
}

/** Mark this week's puzzle as finished for this browser. */
export function markPlayedThisWeek() {
  if (!hasStorage()) return;
  const history = getHistory().filter((e) => e.weekKey !== weekKey());
  history.unshift({
    weekKey: weekKey(),
    playedAt: Date.now(),
  });
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}

/** @deprecated use hasPlayedThisWeek */
export function hasPlayedToday() {
  return hasPlayedThisWeek();
}

/** @deprecated use markPlayedThisWeek */
export function markPlayedToday() {
  markPlayedThisWeek();
}

export function getLocalCollectibles() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(COLLECTIBLES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save a collectible locally (and keep unique by number). */
export function addLocalCollectible(collectible) {
  if (!hasStorage() || !collectible?.number) return;
  const list = getLocalCollectibles().filter((c) => c.number !== collectible.number);
  list.unshift({
    number: collectible.number,
    word: collectible.word,
    weekKey: weekKey(),
    earnedAt: Date.now(),
  });
  window.localStorage.setItem(COLLECTIBLES_KEY, JSON.stringify(list.slice(0, 50)));
}

/** Validate username for scoreboard (2–20, safe chars). */
export function validateUsername(name) {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
    return { ok: false, error: 'Username must be 2–20 characters' };
  }
  if (!/^[a-zA-Z0-9_\- ]+$/.test(trimmed)) {
    return {
      ok: false,
      error: 'Use letters, numbers, spaces, _ or - only',
    };
  }
  return { ok: true, username: trimmed };
}

/**
 * Points for the weekly scoreboard (0–100).
 * No time penalty. Based on groups solved clean vs with a hint, minus lives lost.
 *
 * Four combines (3 board groups + leftover theme). Perfect run = 100.
 * - Clean group (solved before that answer was hinted): 25
 * - Hinted group (hint revealed it first): 12
 * - Each life lost: −8
 */
export function computePoints({
  solvedGroupIds = [],
  hintedGroupIds = [],
  livesLost = 0,
} = {}) {
  const hinted = new Set(hintedGroupIds || []);
  let points = 0;

  for (const id of solvedGroupIds || []) {
    points += hinted.has(id) ? 12 : 25;
  }

  points -= Math.max(0, livesLost) * 8;
  return Math.max(0, Math.min(100, points));
}
