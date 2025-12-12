document.addEventListener('DOMContentLoaded', () => {
    if (typeof io === 'undefined') {
        alert("錯誤：無法連接到伺服器。此遊戲需要 Node.js 後端，無法在 GitHub Pages 等靜態託管服務上運行。\nError: Cannot connect to server. This game requires a Node.js backend and cannot run on static hosting like GitHub Pages.");
        return;
    }
    const socket = io();

    // Elements
    const gridContainer = document.querySelector('.grid-container');
    const tileContainer = document.querySelector('.tile-container');
    const scoreContainer = document.querySelector('.score-container');
    const bestContainer = document.querySelector('.best-container');
    const messageContainer = document.querySelector('.game-message');
    const messageP = messageContainer.querySelector('p');
    const retryButton = document.querySelector('.retry-button');
    const restartBtn = document.getElementById('restartBtn');
    const playerNameInput = document.getElementById('playerName');
    const leaderboardList = document.getElementById('leaderboard');

    // Game state
    let size = 4;
    let grid = [];
    let score = 0;
    let bestScore = 0;
    let won = false;
    let over = false;
    let myId = null;

    // Initialize
    setupInput();
    setupSocket();
    initGame();

    function initGame() {
        grid = Array(size).fill().map(() => Array(size).fill(null));
        score = 0;
        won = false;
        over = false;

        clearTiles();
        updateScore(0);
        messageContainer.classList.remove('game-over');
        messageContainer.classList.remove('game-won');

        addRandomTile();
        addRandomTile();
        updateView();
    }

    function clearTiles() {
        tileContainer.innerHTML = '';
    }

    function addRandomTile() {
        if (!cellsAvailable()) return;

        const value = Math.random() < 0.9 ? 2 : 4;
        const cell = randomAvailableCell();

        grid[cell.x][cell.y] = {
            x: cell.x,
            y: cell.y,
            value: value,
            id: Date.now() + Math.random() // unique ID for transition
        };
    }

    function cellsAvailable() {
        return !!availableCells().length;
    }

    function availableCells() {
        const cells = [];
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                if (!grid[x][y]) {
                    cells.push({ x: x, y: y });
                }
            }
        }
        return cells;
    }

    function randomAvailableCell() {
        const cells = availableCells();
        if (cells.length) {
            return cells[Math.floor(Math.random() * cells.length)];
        }
    }

    // Move logic
    function move(direction) {
        // 0: up, 1: right, 2: down, 3: left
        if (over || won) return;

        let cell, tile;

        const vector = getVector(direction);
        const traversals = buildTraversals(vector);
        let moved = false;

        // Save merged status to avoid double merge in one turn
        prepareTiles();

        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                cell = { x: x, y: y };
                tile = grid[x][y];

                if (tile) {
                    const positions = findFarthestPosition(cell, vector);
                    const next = positions.next;

                    // Only one merger per row traversal?
                    if (withinBounds(next) && grid[next.x][next.y] &&
                        grid[next.x][next.y].value === tile.value &&
                        !grid[next.x][next.y].mergedFrom) {

                        const merged = {
                            x: next.x,
                            y: next.y,
                            value: tile.value * 2,
                            mergedFrom: [tile, grid[next.x][next.y]],
                            id: Date.now() + Math.random()
                        };

                        grid[next.x][next.y] = merged;
                        grid[x][y] = null;

                        // Converge the two tiles' positions
                        tile.x = next.x;
                        tile.y = next.y;

                        // Update score
                        score += merged.value;
                        if (merged.value === 2048) won = true;

                        moved = true;
                    } else {
                        moveTile(tile, positions.farthest);
                        if (x !== positions.farthest.x || y !== positions.farthest.y) {
                            moved = true;
                        }
                    }
                }
            });
        });

        if (moved) {
            addRandomTile();
            updateScore(score);
            updateView();

            if (!movesAvailable()) {
                over = true; // Game Over!
                messageP.textContent = 'Game Over!';
                messageContainer.classList.add('game-over');
            }

            if (won) {
                 messageP.textContent = 'You Win!';
                 messageContainer.classList.add('game-won');
            }
        }
    }

    function prepareTiles() {
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                if (grid[x][y]) {
                    grid[x][y].mergedFrom = null;
                    grid[x][y].savePosition = { x: x, y: y };
                }
            }
        }
    }

    function moveTile(tile, cell) {
        grid[tile.x][tile.y] = null;
        grid[cell.x][cell.y] = tile;
        tile.x = cell.x;
        tile.y = cell.y;
    }

    function getVector(direction) {
        const map = {
            0: { x: 0,  y: -1 }, // Up
            1: { x: 1,  y: 0 },  // Right
            2: { x: 0,  y: 1 },  // Down
            3: { x: -1, y: 0 }   // Left
        };
        return map[direction];
    }

    function buildTraversals(vector) {
        const traversals = { x: [], y: [] };

        for (let pos = 0; pos < size; pos++) {
            traversals.x.push(pos);
            traversals.y.push(pos);
        }

        // Always traverse from the farthest cell in the chosen direction
        if (vector.x === 1) traversals.x = traversals.x.reverse();
        if (vector.y === 1) traversals.y = traversals.y.reverse();

        return traversals;
    }

    function findFarthestPosition(cell, vector) {
        let previous;

        // Progress towards the vector direction until an obstacle is found
        do {
            previous = cell;
            cell = { x: previous.x + vector.x, y: previous.y + vector.y };
        } while (withinBounds(cell) && !grid[cell.x][cell.y]);

        return {
            farthest: previous,
            next: cell // Used to check if a merge is required
        };
    }

    function withinBounds(position) {
        return position.x >= 0 && position.x < size &&
               position.y >= 0 && position.y < size;
    }

    function movesAvailable() {
        return cellsAvailable() || tileMatchesAvailable();
    }

    function tileMatchesAvailable() {
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const tile = grid[x][y];
                if (tile) {
                    for (let direction = 0; direction < 4; direction++) {
                        const vector = getVector(direction);
                        const cell = { x: x + vector.x, y: y + vector.y };
                        if (withinBounds(cell)) {
                            const other = grid[cell.x][cell.y];
                            if (other && other.value === tile.value) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    // View updates
    function updateView() {
        window.requestAnimationFrame(() => {
            tileContainer.innerHTML = '';

            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const tile = grid[x][y];
                    if (tile) {
                        addTileToDom(tile);
                        // Removed mergedFrom rendering to prevent visual glitches where old tiles obscure new ones
                    }
                }
            }
        });
    }

    function addTileToDom(tile) {
        const element = document.createElement('div');
        const inner = document.createElement('div');
        const position = { x: tile.x, y: tile.y };

        // Map x, y to pixel positions (15px margin + 106.25px width)
        // grid-cell margin-right 15px
        // grid-cell width 106.25px
        // gap = 15
        // size = 106.25
        // pos = x * (size + gap)

        // Wait, the grid CSS uses float left.
        // Row 1: y=0. x=0,1,2,3
        // Position top/left is easier if I know the exact pixels.
        // width: 106.25px; height: 106.25px; margin-right: 15px; margin-bottom: 15px
        // Top calculation: y * (106.25 + 15)
        // Left calculation: x * (106.25 + 15)

        const xPos = position.x * (106.25 + 15);
        const yPos = position.y * (106.25 + 15);

        element.classList.add('tile');
        element.classList.add(`tile-${tile.value}`);
        if (tile.value > 2048) element.classList.add('tile-super');

        element.style.transform = `translate(${xPos}px, ${yPos}px)`;

        inner.classList.add('tile-inner');
        inner.textContent = tile.value;

        element.appendChild(inner);
        tileContainer.appendChild(element);
    }

    function updateScore(newScore) {
        score = newScore;
        scoreContainer.textContent = score;
        if (score > bestScore) {
            bestScore = score;
            bestContainer.textContent = bestScore;
        }

        // Emit score to server
        socket.emit('updateScore', score);
    }

    // Input
    function setupInput() {
        document.addEventListener('keydown', (event) => {
            const modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
            const map = {
                38: 0, // Up
                39: 1, // Right
                40: 2, // Down
                37: 3, // Left
                75: 0, // Vim up
                76: 1, // Vim right
                74: 2, // Vim down
                72: 3, // Vim left
                87: 0, // W
                68: 1, // D
                83: 2, // S
                65: 3  // A
            };

            if (!modifiers && map[event.which] !== undefined) {
                event.preventDefault();
                move(map[event.which]);
            }
        });

        retryButton.addEventListener('click', (e) => {
            e.preventDefault();
            initGame();
        });

        restartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            initGame();
        });

        playerNameInput.addEventListener('change', () => {
            const name = playerNameInput.value;
            socket.emit('setName', name);
        });
    }

    // Socket.io
    function setupSocket() {
        socket.on('connect', () => {
            myId = socket.id;
        });

        socket.on('updateLeaderboard', (players) => {
            leaderboardList.innerHTML = '';
            players.forEach(player => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${escapeHtml(player.name)}</span> <span>${escapeHtml(String(player.score))}</span>`;
                if (player.id === myId) {
                    li.classList.add('me');
                }
                leaderboardList.appendChild(li);
            });
        });
    }

    function escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
