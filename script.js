const board = document.getElementById('board');
const resetBtn = document.getElementById('resetBtn');
const difficultySelect = document.getElementById('difficulty');
const popupResetBtn = document.getElementById('popupResetBtn');
const applyBtn = document.getElementById('applyBtn');



let boardSize, mineCount, cells = [], firstClickDone = false;



resetBtn.addEventListener('click', init);
popupResetBtn.addEventListener('click', init);
applyBtn.addEventListener('click', init);
difficultySelect.addEventListener('change', init);
let timerInterval = null;
let time = 0;
window.addEventListener('load', displayLeaderboard);

difficultySelect.addEventListener('change', displayLeaderboard);


const timerEl = document.getElementById('timer');
const mineCounterEl = document.getElementById('mineCounter');
const bestTimeEl = document.getElementById('bestTime');

function updateBestTime() {
  const bestKey = `minesweeperBestTime_${difficultySelect.value}`;
  

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

async function submitScoreOnline(name, difficulty, time) {
  try {
    localStorage.setItem('lastPlayerName', name);
    localStorage.setItem('lastTime', time);

    const response = await fetch('http://mpmc.ddns.net:3000/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, difficulty, time }),
    });

    if (!response.ok) {
      console.warn('Failed to submit score online');
    }
  } catch (error) {
    console.error('Error submitting score:', error);
  }
}


/*
const hardModeCheckbox = document.getElementById('hardModeCheckbox');
let hardMode = false;

hardModeCheckbox.addEventListener('change', () => {
  hardMode = hardModeCheckbox.checked;
});
*/

function getMaxBoardSize() {
  return 24;  // Always return 40 as max size
}






function init() {
  board.innerHTML = '';
  cells = [];
  firstClickDone = false;

  clearInterval(timerInterval);
  time = 0;
  timerEl.textContent = time;

  if (difficultySelect.value === 'custom') {
    const sizeInput = document.getElementById('customSize').value;
    const mineInput = document.getElementById('customMines').value;
    boardSize = parseInt(sizeInput, 10);
    mineCount = parseInt(mineInput, 10);
    customInputs.style.display = 'flex'; // or 'block', flex works well if you used flex styling

  if (difficultySelect.value === 'custom') {
      const maxSize = getMaxBoardSize();
      if (boardSize > 24) {
        alert('Board size too large, max allowed is 24. Adjusting automatically.');
        boardSize = 24;
        document.getElementById('customSize').value = 24;
      } else if (boardSize < 2) {
        alert('Board size too small, min allowed is 2. Adjusting automatically.');
        boardSize = 2;
        document.getElementById('customSize').value = 2;
      }
    }
    
  } else {
    const [customSize, customMines] = difficultySelect.value.split('x').map(Number);
    boardSize = customSize;
    mineCount = customMines;
    customInputs.style.display = 'none';

  }
  /*
  // Validate input
  if (isNaN(boardSize) || isNaN(mineCount) || boardSize <= 0 || mineCount <= 0 || mineCount >= boardSize * boardSize) {
    alert("Invalid board size or mine count.");
    return;
  }
  */
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

    let pressTimer = null;
    cell.addEventListener("touchstart", (e) => {
      pressTimer = setTimeout(() => {
        toggleFlag(i);
        pressTimer = null;
      }, 600);
    });

    cell.addEventListener("touchend", (e) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        handleClick(i);
      }
      pressTimer = null;
      e.preventDefault();
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
    cell.element.textContent = '';  // clear any text like the emoji
    const img = document.createElement('img');
    img.src = 'images/mine-nbg-w.png';  // path to your image file
    img.alt = 'bomb';
    img.style.width = '20px';  // size it properly
    img.style.height = '20px';
    cell.element.appendChild(img);
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
  cell.element.textContent = '';

  // Remove old image if it exists
  const oldFlagImg = cell.element.querySelector('img.flag-img');
  if (oldFlagImg) oldFlagImg.remove();

  if (cell.flagged) {
    const img = document.createElement('img');
    img.src = 'images/flag-nbg.png';
    img.alt = 'flag';
    img.classList.add('flag-img');
    img.style.width = '20px';
    img.style.height = '20px';
    cell.element.appendChild(img);

    // Vibrate on flag placement (only if supported)
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  }

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
          cell.element.textContent = '';  // clear any text like the emoji
          const img = document.createElement('img');
          img.src = 'images/mine-nbg-w.png';  // path to your image file
          img.alt = 'bomb';
          img.style.width = '20px';  // size it properly
          img.style.height = '20px';
          cell.element.appendChild(img);
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
      clearInterval(timerInterval);
  
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell.revealed && cell.mine) {
          cell.revealed = true;
          cell.element.classList.add('revealed');
          cell.element.textContent = '';  // clear any text like the emoji
          const img = document.createElement('img');
          img.src = 'images/mine-nbg-w.png';  // path to your image file
          img.alt = 'bomb';
          img.style.width = '20px';  // size it properly
          img.style.height = '20px';
          cell.element.appendChild(img);
          cell.element.classList.add('mine');
          
        }
      }
  
      setTimeout(() => {
        revealAll();
        updateBestTime();

        /*
        const playerName = prompt('You won! Enter your name for the leaderboard:') || 'Anonymous';
        const difficulty = difficultySelect.value;
  
        // ✅ FIXED ARG ORDER
        submitScoreOnline(playerName, difficulty, time);
        */
  
        showPopup("You Win!");
      }, 500);
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

  // Animate popup
  popup.classList.add('win-animate');

  // Only trigger fancy effects if the message is a win
  if (message.toLowerCase().includes('win')) {
    startConfetti();
    board.classList.add('board-win-pulse');

    // Sequential mine sparkle reveal
    let delay = 0;
    cells.forEach((cell) => {
      if (cell.mine) {
        setTimeout(() => {
          cell.element.classList.add('sparkle');
        }, delay);
        delay += 50;
      }
    });
  }
}



function hidePopup() {
  popup.classList.add('hidden');
  board.classList.remove('board-win-pulse');
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

  board.addEventListener('touchstart', (e) => {
    e.preventDefault();
  }, { passive: false });
  
  function launchConfetti() {
    for (let i = 0; i < 300; i++) {
      const confetto = document.createElement('div');
      confetto.className = 'confetto';
      confetto.style.left = `${Math.random() * 100}%`;
      confetto.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
      confetto.style.animationDelay = `${Math.random() * 1}s`;
      document.body.appendChild(confetto);
  
      setTimeout(() => confetto.remove(), 9000);
    }
  }

  function startConfetti() {
    const interval = setInterval(() => {
      for (let i = 0; i < 7; i++) { // spawn 7 confetti every 100ms
        const confetto = document.createElement('div');
        confetto.className = 'confetto';
        confetto.style.left = `${Math.random() * 100}%`;
        confetto.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
        confetto.style.animationDelay = `${Math.random() * 1}s`;
        document.body.appendChild(confetto);
  
        setTimeout(() => confetto.remove(), 5000);
      }
    }, 100);
    
    // stop after 10 seconds or remove this if you want infinite
    setTimeout(() => clearInterval(interval), 3000);
  }
  
  
  

  document.addEventListener('DOMContentLoaded', () => {
    const debugMenu = document.getElementById('debug-menu');
    const board = document.getElementById('board');
  
    document.addEventListener('keydown', (e) => {
      if (e.key === 'd') {
        debugMenu.classList.toggle('hidden');
      }
    });
  
    window.debugWin = function() {
      showWinPopup(); // your existing win popup function
      board.classList.add('board-win-pulse');
      confettiEffect();
    };
  
    window.debugLose = function() {
      alert("Loss triggered (stub). Replace with your actual loss logic.");
    };
  
    window.resetGame = function() {
      // your reset function code
    };
  
    window.confettiEffect = confettiEffect; // if it's a function already defined
  });
  


  document.getElementById("setCustomBtn").addEventListener("click", () => {
    const w = parseInt(document.getElementById("customWidth").value);
    const h = parseInt(document.getElementById("customHeight").value);
    const m = parseInt(document.getElementById("customMines").value);
  
    if (isNaN(w) || isNaN(h) || isNaN(m) || w < 5 || h < 5 || m <= 0 || m >= w * h) {
      alert("Invalid custom values.");
      return;
    }
  
    const customValue = `${w}x${h}x${m}`;
    const select = document.getElementById("difficulty");
  
    // Add custom option dynamically
    const option = document.createElement("option");
    option.value = customValue;
    option.textContent = `${w}x${h} (${m} mines)`;
    option.selected = true;
    select.appendChild(option);
  
    handleDifficulty(customValue);
  });
  
  document.getElementById("difficulty").addEventListener("change", (e) => {
    handleDifficulty(e.target.value);
  });
  
  function handleDifficulty(value) {
    const [w, h, m] = value.split("x").map(Number);
    if (isNaN(w) || isNaN(h) || isNaN(m)) return alert("Invalid difficulty value.");
    initGame(w, h, m); // Call your game init function
  }
  

  async function displayLeaderboard() {
    const difficulty = difficultySelect.value;
    const leaderboardEl = document.getElementById('leaderboard');
    const lastPlayerName = localStorage.getItem('lastPlayerName');
    const lastTime = parseInt(localStorage.getItem('lastTime'), 10);
  
    leaderboardEl.innerHTML = 'Loading...';
  
    try {
      const response = await fetch(`http://mpmc.ddns.net:3000/scores?difficulty=${difficulty}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const leaderboard = await response.json();
  
      if (leaderboard.length === 0) {
        leaderboardEl.textContent = 'No scores yet!';
        return;
      }
  
      // Sort by best time
      leaderboard.sort((a, b) => a.time - b.time);
  
      leaderboardEl.innerHTML = '';
  
      // Show top 5
      leaderboard.slice(0, 5).forEach(({ name, time }, index) => {
        const entry = document.createElement('div');
        entry.textContent = `${index + 1}. ${name} - ${time}s`;
        leaderboardEl.appendChild(entry);
      });
  
      // Find current user's position if available
      if (lastPlayerName && !isNaN(lastTime)) {
        const playerIndex = leaderboard.findIndex(
          entry => entry.name === lastPlayerName && entry.time === lastTime
        );
  
        if (playerIndex !== -1 && playerIndex >= 5) {
          const youEntry = document.createElement('div');
          youEntry.textContent = `${playerIndex + 1}. You - ${lastTime}s`;
          youEntry.style.marginTop = '0.5em';
          leaderboardEl.appendChild(youEntry);
        }
      }
  
    } catch (error) {
      leaderboardEl.textContent = 'Error loading leaderboard.';
      console.error(error);
    }
  }
  
  
  function positionLeaderboard() {
    const board = document.getElementById('boardContainer'); // your board container
    const leaderboard = document.getElementById('leaderboardContainer');
  
    const boardRect = board.getBoundingClientRect();
  
    // Distance from bottom of viewport to bottom of board
    const distanceFromBottom = window.innerHeight - (boardRect.bottom);
  
    // Let's say you want leaderboard 20px above the board's bottom
    const offset = 20;
  
    if(window.innerWidth <= 720) {
      // Small screen: fix leaderboard at bottom with offset from board bottom
      leaderboard.style.position = 'fixed';
      leaderboard.style.bottom = (distanceFromBottom + offset) + 'px';
      leaderboard.style.left = '0';
      leaderboard.style.width = '100%';
      leaderboard.style.maxWidth = 'none';
      // Add other styles you want here
    } else {
      // Large screen: reset to left fixed
      leaderboard.style.position = 'fixed';
      leaderboard.style.top = '80px';  // or whatever you want
      leaderboard.style.left = '10px';
      leaderboard.style.width = '220px'; // or your original width
      leaderboard.style.bottom = 'auto';
    }
  }
  
  // Run initially and on resize
  window.addEventListener('resize', positionLeaderboard);
  window.addEventListener('load', positionLeaderboard);
  