const board = document.getElementById('board');
const resetBtn = document.getElementById('resetBtn');
const difficultySelect = document.getElementById('difficulty');
const popupResetBtn = document.getElementById('popupResetBtn');


let boardSize, mineCount, cells = [], firstClickDone = false;

const difficulties = {
  easy:    { size: 8, mines: 10 },
  medium:  { size: 10, mines: 15 },
  hard:    { size: 14, mines: 30 }
};

resetBtn.addEventListener('click', init);
popupResetBtn.addEventListener('click', init);
difficultySelect.addEventListener('change', init);
let timerInterval = null;
let time = 0;


const timerEl = document.getElementById('timer');
const mineCounterEl = document.getElementById('mineCounter');
const bestTimeEl = document.getElementById('bestTime');

function updateBestTime() {
  const difficulty = difficultySelect.value;
  const bestKey = `minesweeperBestTime_${difficulty}`;
  const currentBest = localStorage.getItem(bestKey);

  if (!currentBest || time < currentBest) {
    localStorage.setItem(bestKey, time);
    bestTimeEl.textContent = time;
  } else {
    bestTimeEl.textContent = currentBest;
  }
}

function loadBestTime() {
  const difficulty = difficultySelect.value;
  const bestKey = `minesweeperBestTime_${difficulty}`;
  const currentBest = localStorage.getItem(bestKey);
  bestTimeEl.textContent = currentBest || '--';
}


function init() {
    board.innerHTML = '';
    cells = [];
    firstClickDone = false;
  
    clearInterval(timerInterval);
    time = 0;
    timerEl.textContent = time;
  
    const diff = difficulties[difficultySelect.value];
    boardSize = diff.size;
    mineCount = diff.mines;
    
    mineCounterEl.textContent = mineCount;
  
    board.style.setProperty('--cols', boardSize);
  
    const totalCells = boardSize * boardSize;

    loadBestTime();
  
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.index = i;
      board.appendChild(cell);
  
      cells.push({
        element: cell,
        mine: false,
        revealed: false,
        flagged: false,
        adjacent: 0
      });
  
      cell.addEventListener('click', () => handleClick(i));
      cell.addEventListener('contextmenu', e => {
        e.preventDefault();
        toggleFlag(i);
      });
    }
  }
  

function placeMines(firstIndex) {
    const total = boardSize * boardSize;
    const openingRadius = 2; // 2 means a 5x5 area around first click will be mine-free
  
    // Get x,y of first click
    const fx = firstIndex % boardSize;
    const fy = Math.floor(firstIndex / boardSize);
  
    // Calculate forbidden cells inside openingRadius
    const forbidden = new Set();
    for (let y = fy - openingRadius; y <= fy + openingRadius; y++) {
      for (let x = fx - openingRadius; x <= fx + openingRadius; x++) {
        if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
          forbidden.add(y * boardSize + x);
        }
      }
    }
  
    // Generate list of valid positions outside forbidden zone
    const candidates = [];
    for (let i = 0; i < total; i++) {
      if (!forbidden.has(i)) candidates.push(i);
    }
  
    // Shuffle candidates array
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
  
    // Pick first mineCount positions for mines
    for (let i = 0; i < mineCount; i++) {
      cells[candidates[i]].mine = true;
    }
  
    calculateAdjacents();
  }
  

function calculateAdjacents() {
  for (let i = 0; i < cells.length; i++) {
    const neighbors = getNeighbors(i);
    cells[i].adjacent = neighbors.filter(n => cells[n].mine).length;
  }
}

function getNeighbors(index) {
  const x = index % boardSize;
  const y = Math.floor(index / boardSize);
  const neighbors = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
        neighbors.push(ny * boardSize + nx);
      }
    }
  }

  return neighbors;
}

function handleClick(index) {
  if (!firstClickDone) {
    placeMines(index);
    firstClickDone = true;
    timerInterval = setInterval(() => {
        time++;
        timerEl.textContent = time;
      }, 1000);
  }

  const cell = cells[index];
  if (cell.revealed || cell.flagged) return;

  revealCell(index);

  if (cell.mine) {
    cell.element.textContent = '💣';
    cell.element.classList.add('mine');
    showPopup("Game Over!");
    revealAll();
  } else {
    checkWin();
  }
}

function revealCell(index) {
  const cell = cells[index];
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;
  cell.element.classList.add('revealed');

  if (cell.adjacent > 0) {
    cell.element.textContent = cell.adjacent;
  } else {
    getNeighbors(index).forEach(n => revealCell(n));
  }
}

function toggleFlag(index) {
    const cell = cells[index];
    if (cell.revealed) return;
  
    cell.flagged = !cell.flagged;
    cell.element.textContent = cell.flagged ? '🚩' : '';
    cell.element.classList.toggle('flagged', cell.flagged);
  
    // update mine counter
    const flaggedCount = cells.filter(c => c.flagged).length;
    mineCounterEl.textContent = mineCount - flaggedCount;
  
    checkWin();
  }
  

function revealAll() {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell.revealed) {
      cell.revealed = true;
      cell.element.classList.add('revealed');
      if (cell.mine) {
        cell.element.textContent = '💣';
        cell.element.classList.add('mine');
      } else if (cell.adjacent > 0) {
        cell.element.textContent = cell.adjacent;
      }
    }
  }
}

function checkWin() {
    const unrevealed = cells.filter(cell => !cell.revealed);
    const onlyMinesLeft = unrevealed.every(cell => cell.mine);
    if (onlyMinesLeft) {
      showPopup("You Win!");
      revealAll();
      updateBestTime();
      clearInterval(timerInterval);
    }
  }
  

init();

const popup = document.getElementById('popup');
const popupMessage = document.getElementById('popup-message');
const popupRestart = document.getElementById('popup-restart');
const popupReset = document.getElementById('popupResetBtn');


function showPopup(message) {
  popupMessage.textContent = message;
  popup.classList.remove('hidden');
  clearInterval(timerInterval);
}

function hidePopup() {
  popup.classList.add('hidden');
}

popupRestart.addEventListener('click', () => {
  hidePopup();
  resetGame();  // Your function to restart the game
});

popupReset.addEventListener('click', () => {
    hidePopup();
    resetGame();  // Your function to restart the game
  });

  let pressTimer;

  cell.addEventListener("touchstart", (e) => {
    pressTimer = setTimeout(() => {
      toggleFlag(cell); // your flag function
    }, 600);
  });
  
  cell.addEventListener("touchend", (e) => {
    clearTimeout(pressTimer);
  });