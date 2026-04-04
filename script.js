const board = document.getElementById('board');
const resetBtn = document.getElementById('resetBtn');
const difficultySelect = document.getElementById('difficulty');
const customInputs = document.getElementById('customInputs');
const customSizeInput = document.getElementById('customSize');
const customMinesInput = document.getElementById('customMines');
const applyBtn = document.getElementById('applyBtn');
const timerEl = document.getElementById('timer');
const mineCounterEl = document.getElementById('mineCounter');
const bestTimeEl = document.getElementById('bestTime');
const popup = document.getElementById('popup');
const popupMessage = document.getElementById('popup-message');
const popupCloseBtn = document.getElementById('popup-restart');
const popupResetBtn = document.getElementById('popupResetBtn');
const debugMenu = document.getElementById('debug-menu');
const leaderboardEl = document.getElementById('leaderboard');
const leaderboardContainer = document.getElementById('leaderboardContainer');

const DIFFICULTY_CONFIG = {
  '8x10': { boardSize: 8, mineCount: 10 },
  '14x36': { boardSize: 14, mineCount: 36 },
  '20x70': { boardSize: 20, mineCount: 70 },
};

const MAX_BOARD_SIZE = 24;
const MIN_BOARD_SIZE = 2;
const LEADERBOARD_ENDPOINT = 'http://mpmc.ddns.net:3000/scores';
const LONG_PRESS_MS = 500;

let boardSize = DIFFICULTY_CONFIG['8x10'].boardSize;
let mineCount = DIFFICULTY_CONFIG['8x10'].mineCount;
let cells = [];
let timerInterval = null;
let time = 0;
let firstClickDone = false;
let gameOver = false;

resetBtn.addEventListener('click', init);
popupResetBtn.addEventListener('click', init);
popupCloseBtn.addEventListener('click', hidePopup);
applyBtn.addEventListener('click', () => init(true));
customSizeInput.addEventListener('input', updateCustomMineLimit);

difficultySelect.addEventListener('change', () => {
  updateCustomInputsVisibility();
  updateCustomMineLimit();
  init();
  void displayLeaderboard();
});

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'd') {
    debugMenu.classList.toggle('hidden');
  }
});

window.addEventListener('load', () => {
  updateCustomInputsVisibility();
  init();
  void displayLeaderboard();
});

window.addEventListener('beforeunload', stopTimer);

function getDifficultySettings() {
  if (difficultySelect.value !== 'custom') {
    return DIFFICULTY_CONFIG[difficultySelect.value];
  }

  const rawBoardSize = Number.parseInt(customSizeInput.value, 10);
  const rawMineCount = Number.parseInt(customMinesInput.value, 10);

  const safeBoardSize = clamp(
    Number.isNaN(rawBoardSize) ? DIFFICULTY_CONFIG['8x10'].boardSize : rawBoardSize,
    MIN_BOARD_SIZE,
    MAX_BOARD_SIZE
  );
  const maxMineCount = Math.max(1, safeBoardSize * safeBoardSize - 1);
  const safeMineCount = clamp(
    Number.isNaN(rawMineCount) ? Math.min(10, maxMineCount) : rawMineCount,
    1,
    maxMineCount
  );

  customSizeInput.value = String(safeBoardSize);
  customMinesInput.value = String(safeMineCount);

  return {
    boardSize: safeBoardSize,
    mineCount: safeMineCount,
  };
}

function updateCustomInputsVisibility() {
  const isCustom = difficultySelect.value === 'custom';
  customInputs.hidden = !isCustom;
}

function updateCustomMineLimit() {
  const parsedSize = Number.parseInt(customSizeInput.value, 10);
  const safeBoardSize = clamp(
    Number.isNaN(parsedSize) ? DIFFICULTY_CONFIG['8x10'].boardSize : parsedSize,
    MIN_BOARD_SIZE,
    MAX_BOARD_SIZE
  );
  const maxMineCount = Math.max(1, safeBoardSize * safeBoardSize - 1);
  customMinesInput.max = String(maxMineCount);

  const parsedMineCount = Number.parseInt(customMinesInput.value, 10);
  if (!Number.isNaN(parsedMineCount) && parsedMineCount > maxMineCount) {
    customMinesInput.value = String(maxMineCount);
  }
}

function init(forceCustomValidation = false) {
  const settings = getDifficultySettings();
  updateCustomMineLimit();

  if (difficultySelect.value === 'custom' && forceCustomValidation) {
    const maxMineCount = settings.boardSize * settings.boardSize - 1;
    customSizeInput.max = String(MAX_BOARD_SIZE);
    customMinesInput.max = String(maxMineCount);
  }

  boardSize = settings.boardSize;
  mineCount = settings.mineCount;
  cells = [];
  firstClickDone = false;
  gameOver = false;
  time = 0;

  stopTimer();
  hidePopup();

  timerEl.textContent = '0';
  mineCounterEl.textContent = String(mineCount);
  board.style.setProperty('--cols', String(boardSize));
  board.innerHTML = '';

  loadBestTime();

  const totalCells = boardSize * boardSize;
  for (let index = 0; index < totalCells; index += 1) {
    const cellButton = document.createElement('button');
    cellButton.type = 'button';
    cellButton.className = 'cell';
    cellButton.dataset.index = String(index);
    cellButton.setAttribute('aria-label', `Hidden cell ${index + 1}`);
    board.appendChild(cellButton);

    const cellState = {
      element: cellButton,
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
      pressTimer: null,
      longPressTriggered: false,
    };

    cellButton.addEventListener('click', () => handleReveal(index));
    cellButton.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      toggleFlag(index);
    });

    cellButton.addEventListener('touchstart', () => {
      if (gameOver || cellState.revealed) {
        return;
      }

      cellState.longPressTriggered = false;
      cellState.pressTimer = window.setTimeout(() => {
        cellState.longPressTriggered = true;
        toggleFlag(index);
      }, LONG_PRESS_MS);
    }, { passive: true });

    cellButton.addEventListener('touchend', (event) => {
      if (cellState.pressTimer) {
        window.clearTimeout(cellState.pressTimer);
        cellState.pressTimer = null;
      }

      if (cellState.longPressTriggered) {
        event.preventDefault();
      }

      cellState.longPressTriggered = false;
    });

    cellButton.addEventListener('touchcancel', () => {
      if (cellState.pressTimer) {
        window.clearTimeout(cellState.pressTimer);
        cellState.pressTimer = null;
      }
      cellState.longPressTriggered = false;
    });

    cells.push(cellState);
  }

  updateCellAria();
}

function handleReveal(index) {
  if (gameOver) {
    return;
  }

  const cell = cells[index];
  if (!cell || cell.revealed || cell.flagged) {
    return;
  }

  if (!firstClickDone) {
    placeMines(index);
    firstClickDone = true;
    startTimer();
  }

  if (cell.mine) {
    revealMine(cell, true);
    revealAll();
    endGame('Game Over!');
    return;
  }

  revealSafeArea(index);
  checkWin();
}

function placeMines(firstIndex) {
  const totalCells = boardSize * boardSize;
  const safeRadius = boardSize >= 8 ? 1 : 0;
  const safeCells = new Set();
  const startX = firstIndex % boardSize;
  const startY = Math.floor(firstIndex / boardSize);

  for (let y = startY - safeRadius; y <= startY + safeRadius; y += 1) {
    for (let x = startX - safeRadius; x <= startX + safeRadius; x += 1) {
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        safeCells.add(y * boardSize + x);
      }
    }
  }

  const candidates = [];
  for (let index = 0; index < totalCells; index += 1) {
    if (!safeCells.has(index)) {
      candidates.push(index);
    }
  }

  if (candidates.length < mineCount) {
    safeCells.clear();
    safeCells.add(firstIndex);
    candidates.length = 0;
    for (let index = 0; index < totalCells; index += 1) {
      if (!safeCells.has(index)) {
        candidates.push(index);
      }
    }
  }

  shuffle(candidates);
  for (let index = 0; index < mineCount; index += 1) {
    cells[candidates[index]].mine = true;
  }

  calculateAdjacents();
}

function calculateAdjacents() {
  cells.forEach((cell, index) => {
    if (cell.mine) {
      cell.adjacent = 0;
      return;
    }

    const neighbors = getNeighbors(index);
    cell.adjacent = neighbors.filter((neighborIndex) => cells[neighborIndex].mine).length;
  });
}

function getNeighbors(index) {
  const x = index % boardSize;
  const y = Math.floor(index / boardSize);
  const neighbors = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX >= 0 && nextX < boardSize && nextY >= 0 && nextY < boardSize) {
        neighbors.push(nextY * boardSize + nextX);
      }
    }
  }

  return neighbors;
}

function revealSafeArea(startIndex) {
  const queue = [startIndex];

  while (queue.length > 0) {
    const index = queue.shift();
    const cell = cells[index];

    if (!cell || cell.revealed || cell.flagged) {
      continue;
    }

    revealSafeCell(cell, index);

    if (cell.adjacent === 0) {
      getNeighbors(index).forEach((neighborIndex) => {
        const neighbor = cells[neighborIndex];
        if (neighbor && !neighbor.revealed && !neighbor.flagged && !neighbor.mine) {
          queue.push(neighborIndex);
        }
      });
    }
  }
}

function revealSafeCell(cell, index) {
  cell.revealed = true;
  cell.element.classList.add('revealed');
  cell.element.disabled = true;
  cell.element.textContent = cell.adjacent > 0 ? String(cell.adjacent) : '';
  cell.element.setAttribute(
    'aria-label',
    cell.adjacent > 0 ? `Revealed cell with ${cell.adjacent} adjacent mines` : 'Revealed empty cell'
  );
  cell.element.classList.remove('flagged');
  updateCellAria(index);
}

function revealMine(cell, exploded = false) {
  cell.revealed = true;
  cell.element.classList.add('revealed', 'mine');
  if (exploded) {
    cell.element.classList.add('exploded');
  }
  cell.element.disabled = true;
  cell.element.innerHTML = '';

  const img = document.createElement('img');
  img.src = 'images/mine-nbg-w.png';
  img.alt = 'Mine';
  img.className = 'mine-img';
  cell.element.appendChild(img);
  cell.element.setAttribute('aria-label', exploded ? 'Exploded mine' : 'Revealed mine');
}

function toggleFlag(index) {
  if (gameOver) {
    return;
  }

  const cell = cells[index];
  if (!cell || cell.revealed) {
    return;
  }

  cell.flagged = !cell.flagged;
  cell.element.classList.toggle('flagged', cell.flagged);
  cell.element.innerHTML = '';

  if (cell.flagged) {
    const img = document.createElement('img');
    img.src = 'images/flag-nbg.png';
    img.alt = 'Flag';
    img.className = 'flag-img';
    cell.element.appendChild(img);

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  const flaggedCount = cells.filter((candidate) => candidate.flagged).length;
  mineCounterEl.textContent = String(Math.max(0, mineCount - flaggedCount));
  updateCellAria(index);
  checkWin();
}

function revealAll() {
  cells.forEach((cell, index) => {
    if (cell.mine) {
      revealMine(cell, cell.element.classList.contains('exploded'));
      return;
    }

    if (!cell.revealed) {
      revealSafeCell(cell, index);
    }
  });
}

function checkWin() {
  if (gameOver || !firstClickDone) {
    return;
  }

  const revealedSafeCells = cells.filter((cell) => cell.revealed && !cell.mine).length;
  const safeCellCount = cells.length - mineCount;
  if (revealedSafeCells !== safeCellCount) {
    return;
  }

  cells.forEach((cell) => {
    if (cell.mine && !cell.flagged) {
      cell.flagged = true;
      cell.element.classList.add('flagged');
      cell.element.innerHTML = '';

      const img = document.createElement('img');
      img.src = 'images/flag-nbg.png';
      img.alt = 'Flag';
      img.className = 'flag-img';
      cell.element.appendChild(img);
    }
  });

  mineCounterEl.textContent = '0';
  updateBestTime();
  endGame('You Win!');
}

function startTimer() {
  stopTimer();
  timerInterval = window.setInterval(() => {
    time += 1;
    timerEl.textContent = String(time);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function endGame(message) {
  gameOver = true;
  stopTimer();
  showPopup(message);
  updateCellAria();
}

function showPopup(message) {
  popupMessage.textContent = message;
  popup.classList.remove('hidden');

  if (message.toLowerCase().includes('win')) {
    startConfetti();
    board.classList.add('board-win-pulse');
  } else {
    board.classList.remove('board-win-pulse');
  }
}

function hidePopup() {
  popup.classList.add('hidden');
  board.classList.remove('board-win-pulse');
  popupMessage.textContent = '';
}

function updateBestTime() {
  const storageKey = getBestTimeKey();
  const currentBest = readLocalStorage(storageKey);
  const currentBestNumber = currentBest ? Number.parseInt(currentBest, 10) : null;

  if (!currentBestNumber || time < currentBestNumber) {
    writeLocalStorage(storageKey, String(time));
    bestTimeEl.textContent = String(time);
    return;
  }

  bestTimeEl.textContent = String(currentBestNumber);
}

function loadBestTime() {
  const currentBest = readLocalStorage(getBestTimeKey());
  bestTimeEl.textContent = currentBest || '--';
}

function getBestTimeKey() {
  return `minesweeperBestTime_${difficultySelect.value}_${boardSize}x${mineCount}`;
}

async function submitScoreOnline(name, difficulty, scoreTime) {
  if (window.location.protocol === 'https:' && LEADERBOARD_ENDPOINT.startsWith('http://')) {
    console.warn('Skipping score submission because the configured leaderboard endpoint is not HTTPS.');
    return;
  }

  try {
    writeLocalStorage('lastPlayerName', name);
    writeLocalStorage('lastTime', String(scoreTime));

    const response = await fetch(LEADERBOARD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, difficulty, time: scoreTime }),
    });

    if (!response.ok) {
      throw new Error(`Score submission failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn('Unable to submit score online.', error);
  }
}

async function displayLeaderboard() {
  if (!leaderboardEl || !leaderboardContainer) {
    return;
  }

  if (window.location.protocol === 'https:' && LEADERBOARD_ENDPOINT.startsWith('http://')) {
    leaderboardEl.textContent = 'Leaderboard unavailable on HTTPS.';
    return;
  }

  const difficulty = difficultySelect.value;
  leaderboardEl.textContent = 'Loading...';

  try {
    const response = await fetch(`${LEADERBOARD_ENDPOINT}?difficulty=${encodeURIComponent(difficulty)}`);
    if (!response.ok) {
      throw new Error(`Leaderboard request failed with status ${response.status}`);
    }

    const leaderboard = await response.json();
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      leaderboardEl.textContent = 'No scores yet!';
      return;
    }

    leaderboardEl.innerHTML = '';
    leaderboard
      .slice()
      .sort((left, right) => left.time - right.time)
      .slice(0, 5)
      .forEach((entry, index) => {
        const row = document.createElement('div');
        row.textContent = `${index + 1}. ${entry.name} - ${entry.time}s`;
        leaderboardEl.appendChild(row);
      });
  } catch (error) {
    leaderboardEl.textContent = 'Leaderboard unavailable.';
    console.warn('Unable to load leaderboard.', error);
  }
}

function startConfetti() {
  for (let index = 0; index < 80; index += 1) {
    const confetto = document.createElement('div');
    confetto.className = 'confetto';
    confetto.style.left = `${Math.random() * 100}%`;
    confetto.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
    confetto.style.animationDelay = `${Math.random() * 400}ms`;
    document.body.appendChild(confetto);
    window.setTimeout(() => confetto.remove(), 4500);
  }
}

function updateCellAria(index) {
  if (typeof index === 'number') {
    updateSingleCellAria(index);
    return;
  }

  cells.forEach((_, cellIndex) => updateSingleCellAria(cellIndex));
}

function updateSingleCellAria(index) {
  const cell = cells[index];
  if (!cell) {
    return;
  }

  if (gameOver && cell.mine) {
    cell.element.setAttribute('aria-label', cell.element.classList.contains('exploded') ? 'Exploded mine' : 'Mine');
    return;
  }

  if (cell.revealed) {
    cell.element.setAttribute(
      'aria-label',
      cell.adjacent > 0 ? `Revealed cell with ${cell.adjacent} adjacent mines` : 'Revealed empty cell'
    );
    return;
  }

  if (cell.flagged) {
    cell.element.setAttribute('aria-label', 'Flagged hidden cell');
    return;
  }

  cell.element.setAttribute('aria-label', `Hidden cell ${index + 1}`);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('Local storage read failed.', error);
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Local storage write failed.', error);
  }
}

function debugWin() {
  if (gameOver) {
    init();
  }

  if (!firstClickDone) {
    handleReveal(0);
  }

  cells.forEach((cell, index) => {
    if (!cell.mine) {
      revealSafeArea(index);
    }
  });
  checkWin();
}

function debugLose() {
  if (gameOver) {
    init();
  }

  if (!firstClickDone) {
    placeMines(0);
    firstClickDone = true;
  }

  const mineCell = cells.find((cell) => cell.mine);
  if (mineCell) {
    revealMine(mineCell, true);
    revealAll();
    endGame('Game Over!');
  }
}

function renderGameToText() {
  const payload = {
    difficulty: difficultySelect.value,
    boardSize,
    mineCount,
    minesLeft: Number.parseInt(mineCounterEl.textContent, 10),
    time,
    firstClickDone,
    gameOver,
    popupVisible: !popup.classList.contains('hidden'),
    popupMessage: popup.classList.contains('hidden') ? '' : popupMessage.textContent,
    coordinateSystem: 'index is row-major from top-left; x grows right, y grows down',
    cells: cells.map((cell, index) => ({
      index,
      x: index % boardSize,
      y: Math.floor(index / boardSize),
      revealed: cell.revealed,
      flagged: cell.flagged,
      adjacent: cell.revealed ? cell.adjacent : null,
      mineVisible: gameOver && cell.mine,
    })),
  };

  return JSON.stringify(payload);
}

window.debugWin = debugWin;
window.debugLose = debugLose;
window.resetGame = init;
window.confettiEffect = startConfetti;
window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  if (!firstClickDone || gameOver || ms <= 0) {
    return;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds <= 0) {
    return;
  }

  time += seconds;
  timerEl.textContent = String(time);
};

void submitScoreOnline;
