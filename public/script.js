// ── Level Data — populated dynamically by /api/generate-mystery ──────────────
let levelData = null;
let gameImage  = null;   // HTMLImageElement loaded from /api/image after mystery is built

// ── Game State ────────────────────────────────────────────────────────────────
let state = {
  selectedCardIds:  [],   // what the player has clicked on the deck screen
  solvedRiddleIds:  new Set(), // riddle ids already solved
  revealedCardIds:  new Set(), // card ids whose overlay has been lifted
  currentRiddle:    null,      // riddle currently on the riddle screen
  locked:           false
};

// ── DOM References ─────────────────────────────────────────────────────────────
const welcomeScreen  = document.getElementById('welcome-screen');
const deckScreen     = document.getElementById('deck-screen');
const riddleScreen   = document.getElementById('riddle-screen');
const victoryScreen  = document.getElementById('victory-screen');

const startBtn       = document.getElementById('start-btn');
const loadingMsg     = document.getElementById('loading');
const progressText   = document.getElementById('progress-text');
const progressFill   = document.getElementById('progress-fill');
const deckInstruction = document.getElementById('deck-instruction');
const deckFeedback   = document.getElementById('deck-feedback');
const cardGrid       = document.getElementById('card-grid');
const solveBtn       = document.getElementById('solve-btn');

const backBtn        = document.getElementById('back-btn');
const riddleProgress = document.getElementById('riddle-progress');
const riddleCards    = document.getElementById('riddle-cards');
const riddleText     = document.getElementById('riddle-text');
const answerPanel    = document.getElementById('answer-panel');
const answerOptions  = document.getElementById('answer-options');
const feedbackBar    = document.getElementById('feedback-bar');
const nextRiddleBtn  = document.getElementById('next-riddle-btn');

const storyText      = document.getElementById('story-text');
const victoryImage   = document.getElementById('victory-image');
const restartBtn     = document.getElementById('restart-btn');
const aiImageBtn     = document.getElementById('ai-image-btn');
const aiPreviewWrap  = document.getElementById('ai-preview-wrap');
const aiPreview      = document.getElementById('ai-preview');
const alchemistOrb   = document.getElementById('alchemist-orb');
let useAiImage = false;  // true when player chose AI-generated image

// ── Speech Synthesis ─────────────────────────────────────────────────────────
let _voices = [];
function _loadVoices() { _voices = window.speechSynthesis?.getVoices() || []; }
if (window.speechSynthesis) {
  _loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', _loadVoices);
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = _voices.find(v => v.name.includes('Google UK English Male'))
    || _voices.find(v => v.lang === 'en-GB')
    || _voices.find(v => v.lang.startsWith('en'))
    || _voices[0];
  if (voice) utterance.voice = voice;
  utterance.pitch = 0.8;
  utterance.rate  = 0.9;
  utterance.onstart = () => alchemistOrb?.classList.add('speaking');
  utterance.onend   = () => alchemistOrb?.classList.remove('speaking');
  utterance.onerror = () => alchemistOrb?.classList.remove('speaking');
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  window.speechSynthesis?.cancel();
  alchemistOrb?.classList.remove('speaking');
}

// ── Event Listeners ────────────────────────────────────────────────────────────
startBtn.addEventListener('click', startGame);
aiImageBtn.addEventListener('click', generateAiImage);
solveBtn.addEventListener('click', goToRiddleScreen);
backBtn.addEventListener('click', goToDeckScreen);
nextRiddleBtn.addEventListener('click', onNextRiddle);
restartBtn.addEventListener('click', restartGame);

// ── Generate AI Image ─────────────────────────────────────────────────────────
async function generateAiImage() {
  aiImageBtn.disabled = true;
  aiImageBtn.textContent = 'Generating…';
  document.getElementById('image-input').value = '';
  try {
    const res  = await fetch('/api/generate-ai-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to generate image');
    useAiImage = true;
    aiPreview.src = `data:image/jpeg;base64,${data.imageBase64}`;
    aiPreviewWrap.classList.remove('hidden');
    aiImageBtn.textContent = 'Regenerate AI Image';
  } catch (err) {
    alert('Could not generate AI image: ' + err.message);
    aiImageBtn.textContent = 'Generate AI Image';
  }
  aiImageBtn.disabled = false;
}

// ── Start Game ─────────────────────────────────────────────────────────────────
async function startGame() {
  const fileInput = document.getElementById('image-input');
  const file = fileInput.files[0];

  if (!file && !useAiImage) { alert('Please upload an image or generate an AI image first.'); return; }

  startBtn.disabled = true;
  loadingMsg.classList.remove('hidden');

  try {
    let imageBase64, mimeType;
    if (useAiImage) {
      // Image already sent to server during generateAiImage(); just call generate-mystery with it
      imageBase64 = aiPreview.src.split(',')[1];
      mimeType    = 'image/jpeg';
    } else {
      imageBase64 = await readFileAsBase64(file);
      mimeType    = file.type || 'image/jpeg';
    }

    const res  = await fetch('/api/generate-mystery', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ imageBase64, mimeType })
    });
    const data = await res.json();

    if (!data.success) {
      alert('Error: ' + (data.error || 'Could not generate mystery'));
      startBtn.disabled = false;
      loadingMsg.classList.add('hidden');
      return;
    }

    levelData = data.levelData;
    gameImage = await loadImageFromUrl('/api/image');

    const themeEl = document.getElementById('game-theme');
    if (themeEl) themeEl.textContent = levelData.theme;

    state.selectedCardIds  = [];
    state.solvedRiddleIds  = new Set();
    state.revealedCardIds  = new Set();
    state.currentRiddle    = null;
    state.locked           = false;

    welcomeScreen.classList.add('hidden');
    loadingMsg.classList.add('hidden');

    showDeckScreen();
  } catch (err) {
    console.error('Error generating mystery:', err);
    alert('Error generating mystery. Make sure the server is running.');
    startBtn.disabled = false;
    loadingMsg.classList.add('hidden');
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── Screen Transitions ─────────────────────────────────────────────────────────
function showDeckScreen() {
  riddleScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  deckScreen.classList.remove('hidden');

  state.selectedCardIds = [];
  state.locked          = false;

  updateProgress();
  renderCards();
  updateSolveButton();
  hideDeckFeedback();
  deckInstruction.textContent = 'Choose a card to reveal its riddle.';
}

function goToDeckScreen() {
  stopSpeaking();
  showDeckScreen();
}

function goToRiddleScreen() {
  if (state.selectedCardIds.length === 0) return;

  // Find which riddle matches this exact selection
  const selected = [...state.selectedCardIds].sort((a, b) => a - b);
  const riddle = levelData.riddles.find(r => {
    const correct = [...r.correct_card_ids].sort((a, b) => a - b);
    return correct.length === selected.length &&
           correct.every((v, i) => v === selected[i]);
  });

  if (!riddle) return; // shouldn't happen

  state.currentRiddle = riddle;
  state.locked        = false;

  deckScreen.classList.add('hidden');
  riddleScreen.classList.remove('hidden');

  // Progress info at top of riddle screen
  const solved = state.solvedRiddleIds.size;
  const total  = levelData.riddles.length;
  riddleProgress.textContent = `Riddle ${solved + 1} of ${total}`;

  // Render the selected cards large at top
  renderRiddleCards(state.selectedCardIds);

  // Show riddle text
  riddleText.textContent = riddle.text;
  speak(riddle.text);

  // Populate answer options
  renderAnswerOptions(riddle);

  feedbackBar.className = 'feedback-bar hidden';
  nextRiddleBtn.classList.add('hidden');
}

// ── Deck Screen ────────────────────────────────────────────────────────────────
function updateProgress() {
  const solved = state.solvedRiddleIds.size;
  const total  = levelData.riddles.length;
  progressText.textContent = `${solved} of ${total} riddles solved`;
  progressFill.style.width = `${(solved / total) * 100}%`;
}

function renderCards() {
  cardGrid.innerHTML = '';
  levelData.cards.forEach(card => {
    const div = document.createElement('div');
    div.className  = 'mystery-card';
    div.dataset.id = card.id;

    if (state.revealedCardIds.has(card.id)) div.classList.add('revealed-card');

    // Solved: greyed out
    const cardRiddle = levelData.riddles.find(r => r.correct_card_ids.includes(card.id));
    if (cardRiddle && state.solvedRiddleIds.has(cardRiddle.id)) {
      div.classList.add('solved');
    }

    // Selected highlight
    if (state.selectedCardIds.includes(card.id)) div.classList.add('selected');

    // ── Crop wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'card-crop-wrapper';

    const img = document.createElement('img');
    img.className = 'card-canvas';
    img.alt = card.name;
    img.src = `/api/card-image/${card.id}`;
    img.onerror = () => {
      const c = document.createElement('canvas');
      c.className = 'card-canvas';
      c.width  = 300;
      c.height = 200;
      drawCardCrop(c, card);
      img.replaceWith(c);
    };

    wrapper.appendChild(img);

    const desc = document.createElement('p');
    desc.className   = 'card-desc';
    desc.textContent = card.visual_description;

    div.appendChild(wrapper);
    div.appendChild(desc);

    div.addEventListener('click', () => handleCardClick(card.id));
    cardGrid.appendChild(div);
  });
}

function drawCardCrop(canvas, card) {
  if (!gameImage) return;
  const ctx = canvas.getContext('2d');
  if (card.bbox) {
    const [ymin, xmin, ymax, xmax] = card.bbox;
    const iw = gameImage.naturalWidth;
    const ih = gameImage.naturalHeight;
    let sx = (xmin / 1000) * iw;
    let sy = (ymin / 1000) * ih;
    let sw = ((xmax - xmin) / 1000) * iw;
    let sh = ((ymax - ymin) / 1000) * ih;
    const padX = sw * 0.35;
    const padY = sh * 0.35;
    sx = Math.max(0, sx - padX);
    sy = Math.max(0, sy - padY);
    sw = Math.min(iw - sx, sw + 2 * padX);
    sh = Math.min(ih - sy, sh + 2 * padY);
    ctx.drawImage(gameImage, sx, sy, sw, sh, 0, 0, 300, 200);
  } else {
    ctx.drawImage(gameImage, 0, 0, 300, 200);
  }
}

function handleCardClick(cardId) {
  if (state.locked) return;

  const cardEl = document.querySelector(`.mystery-card[data-id="${cardId}"]`);
  if (!cardEl || cardEl.classList.contains('solved')) return;

  const selected = state.selectedCardIds;

  // Toggle off
  if (selected.includes(cardId)) {
    state.selectedCardIds = selected.filter(id => id !== cardId);
    cardEl.classList.remove('selected');
    hideDeckFeedback();
    updateSolveButton();
    return;
  }

  // Find the riddle this card belongs to
  const cardRiddle = levelData.riddles.find(r => r.correct_card_ids.includes(cardId));
  const isPairCard  = cardRiddle && cardRiddle.correct_card_ids.length === 2;

  if (selected.length === 0) {
    // Nothing selected yet — always valid
    state.selectedCardIds = [cardId];
    cardEl.classList.add('selected');
    hideDeckFeedback();
    deckInstruction.textContent = isPairCard
      ? 'This card connects with another — select its partner too.'
      : 'Good pick. Hit "Solve This Riddle" or choose a different card.';

  } else {
    const firstId     = selected[0];
    const firstRiddle = levelData.riddles.find(r => r.correct_card_ids.includes(firstId));
    const firstIsPair = firstRiddle && firstRiddle.correct_card_ids.length === 2;

    if (firstIsPair && isPairCard) {
      // Both are pair cards — only valid if they belong to the SAME pair riddle
      if (firstRiddle && firstRiddle.correct_card_ids.includes(cardId)) {
        state.selectedCardIds = [firstId, cardId];
        cardEl.classList.add('selected');
        hideDeckFeedback();
        deckInstruction.textContent = 'Pair found! Ready to solve together.';
      } else {
        showDeckFeedback('These two cards aren\'t connected to each other. Try a different combination.');
        cardEl.classList.add('wrong');
        setTimeout(() => cardEl.classList.remove('wrong'), 900);
      }
    } else {
      // One or both are solo cards — swap freely (deselect old, select new)
      document.querySelector(`.mystery-card[data-id="${firstId}"]`)?.classList.remove('selected');
      state.selectedCardIds = [cardId];
      cardEl.classList.add('selected');
      hideDeckFeedback();
      deckInstruction.textContent = isPairCard
        ? 'This card connects with another — select its partner too.'
        : 'Good pick. Hit "Solve This Riddle" or choose a different card.';
    }
  }

  updateSolveButton();
}

function updateSolveButton() {
  const sel = state.selectedCardIds;
  if (sel.length === 0) {
    solveBtn.classList.add('hidden');
    return;
  }
  // Check there's a matching riddle for this exact selection
  const sorted = [...sel].sort((a, b) => a - b);
  const riddle = levelData.riddles.find(r => {
    const correct = [...r.correct_card_ids].sort((a, b) => a - b);
    return correct.length === sorted.length &&
           correct.every((v, i) => v === sorted[i]);
  });

  if (riddle && !state.solvedRiddleIds.has(riddle.id)) {
    solveBtn.classList.remove('hidden');
  } else if (sel.length === 1) {
    // Single card that belongs to a 2-card riddle — don't show solve yet
    const cardRiddle = levelData.riddles.find(r => r.correct_card_ids.includes(sel[0]));
    if (cardRiddle && cardRiddle.correct_card_ids.length === 2) {
      solveBtn.classList.add('hidden');
    } else {
      solveBtn.classList.remove('hidden');
    }
  } else {
    solveBtn.classList.add('hidden');
  }
}

function showDeckFeedback(msg) {
  deckFeedback.textContent = msg;
  deckFeedback.className = 'feedback-bar wrong';
}

function hideDeckFeedback() {
  deckFeedback.className = 'feedback-bar hidden';
}

// ── Riddle Screen ──────────────────────────────────────────────────────────────
function renderRiddleCards(cardIds) {
  riddleCards.innerHTML = '';
  cardIds.forEach(cardId => {
    const card = levelData.cards.find(c => c.id === cardId);
    if (!card) return;

    const div = document.createElement('div');
    div.className = 'riddle-card-display';

    const img = document.createElement('img');
    img.className = 'riddle-card-canvas';
    img.alt = card.name;
    img.src = `/api/card-image/${card.id}`;
    img.onerror = () => {
      const c = document.createElement('canvas');
      c.className = 'riddle-card-canvas';
      c.width  = 300;
      c.height = 200;
      drawCardCrop(c, card);
      img.replaceWith(c);
    };

    const wrap = document.createElement('div');
    wrap.className = 'card-crop-wrapper';
    wrap.appendChild(img);

    const name = document.createElement('p');
    name.className   = 'riddle-card-name';
    name.textContent = card.name;

    div.appendChild(wrap);
    div.appendChild(name);
    riddleCards.appendChild(div);
  });
}

function renderAnswerOptions(riddle) {
  answerOptions.innerHTML = '';
  const opts = riddle.answer_options || [];
  opts.forEach(option => {
    const btn = document.createElement('button');
    btn.className   = 'answer-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => handleAnswerClick(option, riddle));
    answerOptions.appendChild(btn);
  });
}

function handleAnswerClick(chosenOption, riddle) {
  if (state.locked) return;

  const rightAnswer = chosenOption === riddle.correct_answer;

  if (rightAnswer) {
    state.locked = true;
    state.solvedRiddleIds.add(riddle.id);

    // Reveal overlay on chosen cards
    riddle.correct_card_ids.forEach(id => {
      state.revealedCardIds.add(id);
      const overlay = riddleCards.querySelector(`.card-crop-wrapper:nth-child(1) .card-hidden-overlay`);
      // Find the overlay in riddle-cards for this card
      const cardDiv = [...riddleCards.querySelectorAll('.riddle-card-display')]
        .find(d => {
          const parent = d.closest('[data-id]');
          return true; // we'll do it by node order
        });
    });
    // Reveal all overlays in the riddle card display
    riddleCards.querySelectorAll('.card-hidden-overlay').forEach(o => o.classList.add('revealed'));

    // Highlight correct button
    [...answerOptions.querySelectorAll('.answer-btn')]
      .find(b => b.textContent === chosenOption)
      ?.classList.add('correct');

    const explanation = riddle.answer_explanation || '';
    showFeedback(explanation ? `🎉 ${explanation}` : '🎉 Correct! The mystery deepens…', 'correct');

    const isLast = state.solvedRiddleIds.size >= levelData.riddles.length;
    if (isLast) {
      setTimeout(showVictory, 2300);
    } else {
      nextRiddleBtn.classList.remove('hidden');
    }

  } else {
    // Wrong answer — flash the clicked button
    const clickedBtn = [...answerOptions.querySelectorAll('.answer-btn')]
      .find(b => b.textContent === chosenOption);
    if (clickedBtn) {
      clickedBtn.classList.add('wrong');
      setTimeout(() => clickedBtn.classList.remove('wrong'), 1200);
    }
    showFeedback('🔍 Not quite — think again.', 'wrong');
    setTimeout(hideFeedback, 2000);
  }
}

function onNextRiddle() {
  // Return to deck so player picks the next card(s)
  showDeckScreen();
}

// ── Feedback ───────────────────────────────────────────────────────────────────
function showFeedback(message, type) {
  feedbackBar.textContent = message;
  feedbackBar.className   = `feedback-bar ${type}`;
}

function hideFeedback() {
  feedbackBar.className = 'feedback-bar hidden';
}

// ── Victory ────────────────────────────────────────────────────────────────────
function showVictory() {
  deckScreen.classList.add('hidden');
  riddleScreen.classList.add('hidden');
  victoryScreen.classList.remove('hidden');
  victoryImage.src           = '/api/image';
  victoryImage.style.display = 'block';
  const story = levelData.story ||
    `You unravelled every clue in "${levelData.theme}" and the mystery is finally revealed.`;
  storyText.textContent = story;
  setTimeout(() => speak(story), 600);
}

// ── Restart ────────────────────────────────────────────────────────────────────
function restartGame() {
  stopSpeaking();
  levelData  = null;
  gameImage  = null;
  useAiImage = false;
  state.selectedCardIds  = [];
  state.solvedRiddleIds  = new Set();
  state.revealedCardIds  = new Set();
  state.currentRiddle    = null;
  state.locked           = false;
  startBtn.disabled = false;
  loadingMsg.classList.add('hidden');
  document.getElementById('image-input').value = '';
  aiPreviewWrap.classList.add('hidden');
  aiPreview.src = '';
  aiImageBtn.textContent = 'Generate AI Image';
  victoryScreen.classList.add('hidden');
  deckScreen.classList.add('hidden');
  riddleScreen.classList.add('hidden');
  welcomeScreen.classList.remove('hidden');
}
