/**
 * Icon URLs — PNG art in /static/icons/ plus emoji glyphs.
 * Files live in /static/icons/ (served as /icons/...).
 */

/** Bump when icon binaries change so production/CDN caches refresh. */
const ICON_CACHE = 'v23';

/** Emoji glyphs keyed by normalized icon id. */
const EMOJI_ICONS = {
  // Puzzle 1 — mythology theme
  mythology: '🏛️',
  // Puzzle 3 — central park board
  roll: '🧻',
  dollar: '$',
  divide: '÷',
  multiply: 'x',
  addition: '+',
  hundred: '💯',
  tree: '🌳',
  slide: '🛝',
  // Puzzle 5 — fall board
  temp: '🌡️',
  honey: '🍯',
  day: '☀️',
  air: '💨',
  water: '💧',
  fire: '🔥',
  aight: '👍',
  lie: '🤥',
  leaves: '🍃',
  daylight: '🌞',
  temperature: '🥵',
  fall: '🍂',
};

/** PNG filename overrides keyed by normalized icon id. */
const FILE_ALIASES = {
  carnival: 'ferris-wheel',
  picnic: 'central-park',
  'queen-ant': 'queen',
};

/** @param {string} word */
function iconKey(word) {
  return (word || '').toLowerCase().trim().replace(/\s+/g, '-');
}

/** @param {string} word */
export function iconEmoji(word) {
  return EMOJI_ICONS[iconKey(word)] ?? null;
}

/** @param {string} word */
export function iconSrc(word) {
  if (iconEmoji(word)) return '';
  const key = iconKey(word);
  if (!key) return '';
  const file = FILE_ALIASES[key] || key;
  return `/icons/${file}.png?${ICON_CACHE}`;
}

/** Display label for an icon id. */
export function iconLabel(word) {
  const key = iconKey(word);
  if (key === 'ant-colony') return 'ant colony';
  if (key === 'owl-home') return 'owl home';
  if (key === 'queen' || key === 'queen-ant') return 'queen ant';
  if (key === 'himantes1' || key === 'himantes2') return 'himantes';
  if (key === 'ferris-wheel') return 'ferris wheel';
  if (key === 'rolled-cash') return 'rolled cash';
  if (key === 'rolls-royce') return 'rolls-royce';
  if (key === 'kaiser-roll') return 'kaiser roll';
  if (key === 'central-park' || key === 'picnic') return 'central park';
  if (key === 'bullseye-target') return 'bullseye';
  if (key === 'bumper-car') return 'bumper car';
  if (key === 'clown-car') return 'clown car';
  if (key === 'roller-coaster') return 'roller coaster';
  if (key === 'red-cape') return 'red cape';
  if (key === 'eye-chart') return 'eye chart';
  if (key === 'x-ray') return 'x-ray';
  return word || '';
}

/** @deprecated kept so old imports don't break; prefer iconSrc */
export function getIconSvg() {
  return '';
}
