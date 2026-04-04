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
const popupSubtext = document.getElementById('popup-subtext');
const popupCloseBtn = document.getElementById('popup-restart');
const popupResetBtn = document.getElementById('popupResetBtn');
const scoreForm = document.getElementById('scoreForm');
const playerNameInput = document.getElementById('playerNameInput');
const debugMenu = document.getElementById('debug-menu');
const leaderboardEl = document.getElementById('leaderboard');
const leaderboardContainer = document.getElementById('leaderboardContainer');
const leaderboardSubtitleEl = document.getElementById('leaderboardSubtitle');
const leaderboardEmptyEl = document.getElementById('leaderboardEmpty');

const DIFFICULTY_CONFIG = {
  '8x10': { boardSize: 8, mineCount: 10 },
  '14x36': { boardSize: 14, mineCount: 36 },
  '20x70': { boardSize: 20, mineCount: 70 },
};

const MAX_BOARD_SIZE = 24;
const MIN_BOARD_SIZE = 2;
const MAX_LEADERBOARD_ENTRIES = 5;
const MAX_PLAYER_NAME_LENGTH = 20;
const LONG_PRESS_MS = 500;

let boardSize = DIFFICULTY_CONFIG['8x10'].boardSize;
let mineCount = DIFFICULTY_CONFIG['8x10'].mineCount;
let cells = [];
let timerInterval = null;
let time = 0;
let firstClickDone = false;
let gameOver = false;
let pendingLeaderboardEntry = null;

resetBtn.addEventListener('click', init);
popupResetBtn.addEventListener('click', init);
popupCloseBtn.addEventListener('click', hidePopup);
applyBtn.addEventListener('click', () => init(true));
customSizeInput.addEventListener('input', updateCustomMineLimit);
scoreForm.addEventListener('submit', handleScoreSubmit);

difficultySelect.addEventListener('change', () => {
  updateCustomInputsVisibility();
  updateCustomMineLimit();
  init();
});

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'd') {
    debugMenu.classList.toggle('hidden');
  }
});

window.addEventListener('load', () => {
  updateCustomInputsVisibility();
  init();
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
  pendingLeaderboardEntry = null;

  stopTimer();
  hidePopup();

  timerEl.textContent = '0';
  mineCounterEl.textContent = String(mineCount);
  board.style.setProperty('--cols', String(boardSize));
  board.innerHTML = '';

  loadBestTime();
  displayLeaderboard();

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
  pendingLeaderboardEntry = getLeaderboardQualification(time);
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
  popupSubtext.textContent = '';
  popupSubtext.classList.add('hidden');
  scoreForm.classList.add('hidden');

  if (message.toLowerCase().includes('win')) {
    startConfetti();
    board.classList.add('board-win-pulse');
    configureWinPopup();
  } else {
    board.classList.remove('board-win-pulse');
    pendingLeaderboardEntry = null;
  }
}

function hidePopup() {
  popup.classList.add('hidden');
  board.classList.remove('board-win-pulse');
  popupMessage.textContent = '';
  popupSubtext.textContent = '';
  popupSubtext.classList.add('hidden');
  scoreForm.classList.add('hidden');
  scoreForm.reset();
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
  const storedBest = readLocalStorage(getBestTimeKey());
  const parsedStoredBest = storedBest ? Number.parseInt(storedBest, 10) : null;
  const leaderboardBest = getLeaderboardEntries()[0]?.time ?? null;
  const bestCandidates = [parsedStoredBest, leaderboardBest].filter((candidate) => Number.isFinite(candidate));
  bestTimeEl.textContent = bestCandidates.length > 0 ? String(Math.min(...bestCandidates)) : '--';
}

function getBestTimeKey() {
  return `minesweeperBestTime_${difficultySelect.value}_${boardSize}x${mineCount}`;
}

function getLeaderboardKey() {
  return `minesweeperLeaderboard_${difficultySelect.value}_${boardSize}x${mineCount}`;
}

function getDifficultyLabel() {
  const selectedOption = difficultySelect.selectedOptions[0];
  const difficultyName = selectedOption ? selectedOption.textContent.trim() : 'Custom';
  return `${difficultyName} · ${boardSize}x${boardSize} board · ${mineCount} mines`;
}

function getLeaderboardEntries() {
  const rawValue = readLocalStorage(getLeaderboardKey());
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && typeof entry.name === 'string' && Number.isFinite(entry.time))
      .map((entry) => ({
        name: sanitizePlayerName(entry.name) || 'Anonymous',
        time: Math.max(0, Math.floor(entry.time)),
        recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : '',
      }))
      .sort((left, right) => left.time - right.time || left.recordedAt.localeCompare(right.recordedAt))
      .slice(0, MAX_LEADERBOARD_ENTRIES);
  } catch (error) {
    console.warn('Unable to parse leaderboard entries.', error);
    return [];
  }
}

function saveLeaderboardEntry(name, scoreTime) {
  const leaderboard = getLeaderboardEntries();
  const nextLeaderboard = [...leaderboard, {
    name,
    time: Math.max(0, Math.floor(scoreTime)),
    recordedAt: new Date().toISOString(),
  }]
    .sort((left, right) => left.time - right.time || left.recordedAt.localeCompare(right.recordedAt))
    .slice(0, MAX_LEADERBOARD_ENTRIES);

  writeLocalStorage(getLeaderboardKey(), JSON.stringify(nextLeaderboard));
  writeLocalStorage('lastPlayerName', name);
}

function getLeaderboardQualification(scoreTime) {
  const leaderboard = getLeaderboardEntries();
  const qualifies =
    leaderboard.length < MAX_LEADERBOARD_ENTRIES
    || scoreTime <= leaderboard[leaderboard.length - 1].time;

  if (!qualifies) {
    return null;
  }

  const projectedLeaderboard = [...leaderboard, {
    name: '',
    time: scoreTime,
    recordedAt: '',
  }]
    .sort((left, right) => left.time - right.time || left.recordedAt.localeCompare(right.recordedAt))
    .slice(0, MAX_LEADERBOARD_ENTRIES);

  const rank = projectedLeaderboard.findIndex((entry) => entry.time === scoreTime) + 1;
  return {
    rank,
    scoreTime,
  };
}

function configureWinPopup() {
  popupSubtext.classList.remove('hidden');

  if (!pendingLeaderboardEntry) {
    popupSubtext.textContent = `Finished in ${time}s on ${getDifficultyLabel()}.`;
    return;
  }

  popupSubtext.textContent = `Finished in ${pendingLeaderboardEntry.scoreTime}s. This is rank #${pendingLeaderboardEntry.rank} on the local leaderboard.`;
  scoreForm.classList.remove('hidden');
  playerNameInput.value = sanitizePlayerName(readLocalStorage('lastPlayerName') || '');
  window.requestAnimationFrame(() => {
    playerNameInput.focus();
    playerNameInput.select();
  });
}

function handleScoreSubmit(event) {
  event.preventDefault();

  if (!pendingLeaderboardEntry) {
    return;
  }

  const playerName = sanitizePlayerName(playerNameInput.value) || 'Anonymous';
  saveLeaderboardEntry(playerName, pendingLeaderboardEntry.scoreTime);
  const savedTime = pendingLeaderboardEntry.scoreTime;
  pendingLeaderboardEntry = null;
  displayLeaderboard();
  loadBestTime();
  popupSubtext.textContent = `Saved ${playerName} with ${savedTime}s.`;
  popupSubtext.classList.remove('hidden');
  scoreForm.classList.add('hidden');
}

function sanitizePlayerName(name = '') {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAYER_NAME_LENGTH);
}

function displayLeaderboard() {
  if (!leaderboardEl || !leaderboardContainer || !leaderboardSubtitleEl || !leaderboardEmptyEl) {
    return;
  }

  leaderboardSubtitleEl.textContent = getDifficultyLabel();
  leaderboardEl.innerHTML = '';

  const leaderboard = getLeaderboardEntries();
  leaderboardEmptyEl.classList.toggle('hidden', leaderboard.length > 0);

  leaderboard.forEach((entry, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'leaderboard-entry';

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `#${index + 1}`;

    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = entry.name;

    const score = document.createElement('span');
    score.className = 'leaderboard-time';
    score.textContent = `${entry.time}s`;

    listItem.append(rank, name, score);
    leaderboardEl.appendChild(listItem);
  });
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
