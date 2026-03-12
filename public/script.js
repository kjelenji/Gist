// ── Game State ────────────────────────────────────────────────────────────────
let gameData = {
  totalRiddles: 0,
  totalPairs: 0,
  currentPair: 0,
  panelADone: false,
  panelBDone: false,
  attemptsA: 3,
  attemptsB: 3
};

let originalImg = null; // pre-loaded Image object for canvas cropping

// ── DOM References ─────────────────────────────────────────────────────────────
const welcomeScreen  = document.getElementById('welcome-screen');
const gameScreen     = document.getElementById('game-screen');
const victoryScreen  = document.getElementById('victory-screen');

const startBtn    = document.getElementById('start-btn');
const imageInput  = document.getElementById('image-input');
const loadingMsg  = document.getElementById('loading');

const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');
const pairStatus   = document.getElementById('pair-status');
const nextPairBtn  = document.getElementById('next-pair-btn');

const storyText    = document.getElementById('story-text');
const victoryImage = document.getElementById('victory-image');
const restartBtn   = document.getElementById('restart-btn');

// ── Event Listeners ────────────────────────────────────────────────────────────
startBtn.addEventListener('click', startGame);
document.getElementById('submit-a').addEventListener('click', () => submitAnswer('a'));
document.getElementById('submit-b').addEventListener('click', () => submitAnswer('b'));
document.getElementById('answer-a').addEventListener('keypress', e => { if (e.key === 'Enter') submitAnswer('a'); });
document.getElementById('answer-b').addEventListener('keypress', e => { if (e.key === 'Enter') submitAnswer('b'); });
nextPairBtn.addEventListener('click', advancePair);
restartBtn.addEventListener('click', restartGame);

// ── Start Game ─────────────────────────────────────────────────────────────────
async function startGame() {
  const imagePath = imageInput.value.trim() || 'your_initial_puzzle_image.jpg';
  startBtn.disabled = true;
  loadingMsg.classList.remove('hidden');

  try {
    const response = await fetch('/api/start-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath })
    });
    const data = await response.json();

    if (!data.success) {
      alert('Error: ' + (data.error || 'Could not start game'));
      startBtn.disabled = false;
      loadingMsg.classList.add('hidden');
      return;
    }

    gameData.totalRiddles = data.totalRiddles;
    gameData.totalPairs   = Math.ceil(data.totalRiddles / 2);
    gameData.currentPair  = 0;

    // Pre-load the original image for canvas cropping
    originalImg = new Image();
    originalImg.src = '/api/image';
    await new Promise(resolve => {
      originalImg.onload  = resolve;
      originalImg.onerror = resolve; // continue even if image fails to load
    });

    welcomeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    loadPair(0);

  } catch (err) {
    console.error('Error starting game:', err);
    alert('Error starting game. Make sure the server is running.');
    startBtn.disabled = false;
    loadingMsg.classList.add('hidden');
  }
}

// ── Load a Pair of Riddles ─────────────────────────────────────────────────────
async function loadPair(pairIndex) {
  // Reset state
  gameData.panelADone = false;
  gameData.panelBDone = false;
  gameData.attemptsA  = 3;
  gameData.attemptsB  = 3;

  resetPanel('a');
  resetPanel('b');
  nextPairBtn.classList.add('hidden');
  pairStatus.textContent = 'Answer the riddles to continue…';

  try {
    const response = await fetch(`/api/riddle-pair/${pairIndex}`);
    const data = await response.json();

    // Update progress bar
    progressText.textContent = data.progress;
    const pct = ((pairIndex + 1) / gameData.totalPairs) * 100;
    progressFill.style.width = pct + '%';

    // Panel A — always present
    document.getElementById('panel-a').dataset.index = data.first.index;
    document.getElementById('riddle-a').textContent = data.first.riddle;
    drawCrop('a', data.first.bbox);
    document.getElementById('panel-a').classList.remove('hidden');
    document.getElementById('answer-a').focus();

    // Panel B — only if a second riddle exists in the pair
    const panelB = document.getElementById('panel-b');
    if (data.second) {
      panelB.dataset.index = data.second.index;
      document.getElementById('riddle-b').textContent = data.second.riddle;
      drawCrop('b', data.second.bbox);
      panelB.classList.remove('hidden');
    } else {
      panelB.classList.add('hidden');
      gameData.panelBDone = true; // odd riddle count — no second panel needed
    }

  } catch (err) {
    console.error('Error loading pair:', err);
    pairStatus.textContent = 'Error loading riddles.';
  }
}

function resetPanel(panel) {
  document.getElementById(`answer-${panel}`).value = '';
  document.getElementById(`submit-${panel}`).disabled = false;
  const fb = document.getElementById(`feedback-${panel}`);
  fb.textContent = '';
  fb.className = 'feedback';
  document.getElementById(`reveal-${panel}`).classList.add('hidden');
  document.getElementById(`attempts-${panel}`).textContent = '3 attempts left';
  document.getElementById(`crop-${panel}`).style.display = 'none';
}

// ── Canvas Crop ────────────────────────────────────────────────────────────────
function drawCrop(panel, bbox) {
  const canvas = document.getElementById(`crop-${panel}`);
  const ctx    = canvas.getContext('2d');
  canvas.width  = 300;
  canvas.height = 200;

  if (!originalImg || !originalImg.naturalWidth || !bbox || !Array.isArray(bbox) || bbox.length < 4) {
    // Placeholder when no bbox data
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#adb5bd';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', canvas.width / 2, canvas.height / 2);
    return;
  }

  // bbox values are Gemini's 0-1000 normalised coordinates [ymin, xmin, ymax, xmax]
  const [ymin, xmin, ymax, xmax] = bbox;
  const iw = originalImg.naturalWidth;
  const ih = originalImg.naturalHeight;

  const sx = (xmin / 1000) * iw;
  const sy = (ymin / 1000) * ih;
  const sw = ((xmax - xmin) / 1000) * iw;
  const sh = ((ymax - ymin) / 1000) * ih;

  ctx.drawImage(originalImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

// ── Submit Answer ──────────────────────────────────────────────────────────────
async function submitAnswer(panel) {
  const inputEl   = document.getElementById(`answer-${panel}`);
  const answer    = inputEl.value.trim();
  if (!answer) return;

  const panelEl   = document.getElementById(`panel-${panel}`);
  const index     = parseInt(panelEl.dataset.index);
  const feedbackEl = document.getElementById(`feedback-${panel}`);
  const revealEl  = document.getElementById(`reveal-${panel}`);
  const submitEl  = document.getElementById(`submit-${panel}`);
  const attemptsEl = document.getElementById(`attempts-${panel}`);
  const attemptsKey = panel === 'a' ? 'attemptsA' : 'attemptsB';

  try {
    const res  = await fetch('/api/check-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, answer })
    });
    const data = await res.json();

    if (data.isCorrect) {
      feedbackEl.textContent = `✅ Correct! "${data.answer}"`;
      feedbackEl.className = 'feedback correct';
      document.getElementById(`correct-${panel}`).textContent = data.answer;
      revealEl.classList.remove('hidden');
      submitEl.disabled = true;
      attemptsEl.textContent = '';
      document.getElementById(`crop-${panel}`).style.display = 'block';
      markPanelDone(panel);
    } else {
      gameData[attemptsKey]--;
      const left = gameData[attemptsKey];
      if (left > 0) {
        feedbackEl.textContent = `❌ Try again! (${left} attempt${left === 1 ? '' : 's'} left)`;
        feedbackEl.className = 'feedback incorrect';
        attemptsEl.textContent = `${left} attempt${left === 1 ? '' : 's'} left`;
      } else {
        feedbackEl.textContent = `❌ Out of attempts!`;
        feedbackEl.className = 'feedback incorrect';
        document.getElementById(`correct-${panel}`).textContent = data.answer;
        revealEl.classList.remove('hidden');
        submitEl.disabled = true;
        attemptsEl.textContent = '';
        document.getElementById(`crop-${panel}`).style.display = 'block';
        markPanelDone(panel);
      }
    }
  } catch (err) {
    console.error('Error checking answer:', err);
    feedbackEl.textContent = 'Error — please try again.';
    feedbackEl.className = 'feedback incorrect';
  }
}

function markPanelDone(panel) {
  if (panel === 'a') gameData.panelADone = true;
  else               gameData.panelBDone = true;
  checkBothDone();
}

function checkBothDone() {
  if (!gameData.panelADone || !gameData.panelBDone) return;

  const isLastPair = (gameData.currentPair + 1) >= gameData.totalPairs;
  if (isLastPair) {
    pairStatus.textContent = '🎉 All riddles solved!';
    nextPairBtn.textContent = 'See The Reveal →';
    nextPairBtn.classList.remove('hidden');
    nextPairBtn.onclick = endGame;
  } else {
    pairStatus.textContent = 'Round complete!';
    nextPairBtn.textContent = 'Next Round →';
    nextPairBtn.classList.remove('hidden');
    nextPairBtn.onclick = advancePair;
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function advancePair() {
  gameData.currentPair++;
  loadPair(gameData.currentPair);
}

async function endGame() {
  gameScreen.classList.add('hidden');
  victoryScreen.classList.remove('hidden');

  // Show the original puzzle image on the victory screen
  victoryImage.src = '/api/image';

  try {
    const res  = await fetch('/api/story');
    const data = await res.json();
    storyText.textContent = data.success ? data.story : 'Could not load story.';
  } catch (err) {
    storyText.textContent = 'Error loading story.';
  }
}

function restartGame() {
  victoryScreen.classList.add('hidden');
  welcomeScreen.classList.remove('hidden');
  startBtn.disabled = false;
  loadingMsg.classList.add('hidden');
  imageInput.value = '';
  originalImg = null;
  gameData = {
    totalRiddles: 0, totalPairs: 0, currentPair: 0,
    panelADone: false, panelBDone: false,
    attemptsA: 3, attemptsB: 3
  };
}
